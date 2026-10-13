/**
 * Keyword matcher for Kavach Voice SOS.
 * Handles English and Hindi (Latin + Devanagari), interim speech variants,
 * and common Chrome SpeechRecognition misrecognitions (e.g. "hell", "hel p", "yelp" for "help").
 *
 * Modes:
 *   - 'trigger': detects calls for help
 *   - 'cancel': cancels the countdown (e.g. "cancel", "I'm safe").
 *               Deliberately ignores "stop" because a victim might shout "stop" at an attacker.
 */

function clean(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/['’]/g, '') // collapse apostrophes: "i'm" -> "im"
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"।]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const TRIGGER_PHRASES = [
  'help me',
  'please help',
  'somebody help',
  'someone help',
  'need help',
  'save me',
  'madad karo',
  'madad kijiye',
  'bachao bachao',
  'मदद करो',
  'मदद कीजिए',
  'बचाओ बचाओ',
];

const TRIGGER_WORDS = new Set([
  'help',
  'helps',
  'bachao',
  'bchao',
  'madad',
  'हेल्प',
  'बचाओ',
  'मदद',
]);

const TRIGGER_FUZZY = new Set([
  'hell',
  'yelp',
  'halp',
]);

const CANCEL_PHRASES = [
  'im safe',
  'i am safe',
  'safe now',
  'im fine',
  'i am fine',
  'all good',
  'false alarm',
  'by mistake',
  'theek hu',
  'thik hu',
  'galti se',
  'सुरक्षित हूँ',
  'सुरक्षित हूं',
  'ठीक हूँ',
  'ठीक हूं',
  'गलती से',
];

const CANCEL_WORDS = new Set([
  'cancel',
  'cancle',
  'safe',
  'surakshit',
  'radd',
  'रद्द',
  'सुरक्षित',
]);

/**
 * Finds if a transcript contains any recognized keyword for the current mode.
 * @param {string} text - The raw speech recognition transcript.
 * @param {'trigger' | 'cancel'} mode - The recognition mode.
 * @param {{ fuzzy?: boolean }} [options] - Whether to use tolerant/fuzzy matching.
 * @returns {string | null} The matched keyword or null.
 */
export function findKeyword(text, mode = 'trigger', { fuzzy = true } = {}) {
  const norm = clean(text);
  if (!norm) return null;

  if (mode === 'trigger') {
    // 1. Multi-word phrase matches
    for (const phrase of TRIGGER_PHRASES) {
      if (norm.includes(phrase)) return phrase;
    }

    // 2. Split words variant: "hel p" -> "help"
    if (fuzzy && (/\bhel\s+p\b/.test(norm) || /\bbac\s+hao\b/.test(norm) || /\bma\s+dad\b/.test(norm))) {
      return 'help';
    }

    // 3. Exact word tokens
    const tokens = norm.split(' ');
    for (const token of tokens) {
      if (TRIGGER_WORDS.has(token)) return token;
      if (fuzzy && TRIGGER_FUZZY.has(token)) return 'help';
    }

    // 4. Devanagari script substring check
    if (norm.includes('बचाओ')) return 'bachao';
    if (norm.includes('मदद')) return 'madad';
    if (norm.includes('हेल्प')) return 'help';

    return null;
  }

  if (mode === 'cancel') {
    // 1. Multi-word phrase matches
    for (const phrase of CANCEL_PHRASES) {
      if (norm.includes(phrase)) return phrase;
    }

    // 2. Exact word tokens
    const tokens = norm.split(' ');
    for (const token of tokens) {
      if (CANCEL_WORDS.has(token)) return token;
    }

    // 3. Devanagari script substring check
    if (norm.includes('सुरक्षित')) return 'safe';
    if (norm.includes('रद्द')) return 'cancel';

    return null;
  }

  return null;
}
