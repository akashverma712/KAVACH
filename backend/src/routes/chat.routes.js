import { Router } from 'express';
import { z } from 'zod';
import { chatLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { STARTERS, answerQuestion } from '../services/chatbot.service.js';
import { ah } from '../utils/errors.js';

const router = Router();

router.get('/suggestions', (_req, res) => res.json({ suggestions: STARTERS }));

router.post('/', chatLimiter, validate(z.object({
  message: z.string().trim().min(1, 'Type a question').max(500, 'Keep questions under 500 characters'),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(2000),
  })).max(8).optional().default([]),
}).strict()), ah(async (req, res) => {
  // Anthropic requires alternating turns starting with "user"
  const history = [];
  for (const m of req.body.history) {
    if (!history.length && m.role !== 'user') continue;
    if (history.length && history[history.length - 1].role === m.role) continue;
    history.push(m);
  }
  if (history.length && history[history.length - 1].role === 'user') history.pop();
  const reply = await answerQuestion(req.body.message, history);
  res.json(reply);
}));

export default router;
