import { chatbotConfig } from '../config/env.js';
import { query } from '../db/pool.js';

const GREETING = /^(hi+|hello|hey|namaste|hola|yo|good (morning|afternoon|evening))\b/i;
const THANKS = /\b(thanks|thank you|thx|dhanyavad|shukriya)\b/i;
const DISTRESS = /\b(suicid\w*|kill myself|end my life|want to die|self[- ]?harm|hurt myself|no reason to live)\b/i;

const STARTERS = [
  'How do I send an SOS alert?',
  'I am feeling stressed or low. Where can I get help?',
  'How do I report a problem on campus?',
  'Where is BIT Sindri located?',
];

/** Full-text search over the admin-managed knowledge base (prefix match, any term). */
export async function searchKnowledge(text, limit = 5) {
  const words = (text.toLowerCase().match(/[a-z0-9]+/g) || []).filter((w) => w.length > 1);
  const terms = [...new Set(words)].slice(0, 12);
  if (!terms.length) return [];
  const tsq = terms.map((t) => `${t}:*`).join(' | ');
  const { rows } = await query(
    `SELECT id, question, answer, category, ts_rank_cd(search, q) AS rank
       FROM faqs, to_tsquery('english', $1) q
      WHERE search @@ q
      ORDER BY rank DESC, updated_at DESC
      LIMIT $2`,
    [tsq, limit],
  );
  return rows;
}

async function askModel(question, history, context) {
  const { apiKey, model } = chatbotConfig();
  const kb = context.map((c, i) => `[${i + 1}] Q: ${c.question}\nA: ${c.answer}`).join('\n\n') || '(no matching entries)';
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: 500,
      system: [
        'You are Kavach Assistant, the campus help assistant for students of BIT Sindri (Birsa Institute of Technology Sindri, Dhanbad, Jharkhand).',
        'Answer using the knowledge base entries below. If they do not contain the answer, say so plainly and suggest the official website bitsindri.ac.in or the relevant office. Never invent dates, fees, names or phone numbers.',
        'Keep answers under 120 words, friendly and practical. Plain text only.',
        'If the student seems unsafe or in emotional distress, share Tele-MANAS (14416), emergency number 112 and remind them about the SOS button.',
        '',
        'Knowledge base:',
        kb,
      ].join('\n'),
      messages: [...history, { role: 'user', content: question }],
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}`);
  const data = await res.json();
  const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
  if (!text) throw new Error('Empty model response');
  return text;
}

export async function answerQuestion(question, history = []) {
  const q = question.trim();

  if (DISTRESS.test(q)) {
    return {
      source: 'safety',
      answer: 'I\'m really glad you reached out. You don\'t have to handle this alone. Please call Tele-MANAS on 14416 (free, 24×7) to talk to a counsellor now. If you might act on these thoughts or are in danger, call 112 or press the SOS button so your contacts and the campus admin can reach you. Talking to someone you trust nearby, a friend, warden or faculty member, can help too.',
      suggestions: ['I am feeling stressed or low. Where can I get help?', 'How do I send an SOS alert?'],
    };
  }
  if (GREETING.test(q) && q.split(/\s+/).length <= 4) {
    return { source: 'smalltalk', answer: 'Hi! I can help with campus information, using Kavach, and finding support. What would you like to know?', suggestions: STARTERS };
  }
  if (THANKS.test(q) && q.split(/\s+/).length <= 5) {
    return { source: 'smalltalk', answer: 'Happy to help. Stay safe!', suggestions: [] };
  }

  const matches = await searchKnowledge(q, 5);

  if (chatbotConfig().apiKey) {
    try {
      const answer = await askModel(q, history, matches);
      return { source: 'ai', answer, suggestions: matches.slice(0, 3).map((m) => m.question) };
    } catch (err) {
      console.error('Chatbot AI fallback to knowledge base:', err.message);
    }
  }

  if (matches.length) {
    return {
      source: 'knowledge_base',
      matched: matches[0].question,
      answer: matches[0].answer,
      suggestions: matches.slice(1, 4).map((m) => m.question),
    };
  }
  return {
    source: 'fallback',
    answer: 'I couldn\'t find that in the campus knowledge base yet. Try rephrasing, or check bitsindri.ac.in. You can also ask in Community, and for anything urgent use SOS.',
    suggestions: STARTERS,
  };
}

export { STARTERS };
