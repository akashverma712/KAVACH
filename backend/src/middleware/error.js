import multer from 'multer';
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { cleanupTemp } from './upload.js';
import { formatZod } from './validate.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.originalUrl}` } });
}

// eslint-disable-next-line no-unused-vars
export async function errorHandler(err, req, res, _next) {
  await cleanupTemp(req).catch(() => {});

  let status = 500;
  let body = { code: 'INTERNAL', message: 'Something went wrong on our side. Please try again.' };

  if (err instanceof AppError) {
    status = err.status;
    body = { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) };
  } else if (err instanceof ZodError) {
    status = 400;
    const details = formatZod(err);
    body = { code: 'VALIDATION_ERROR', message: details[0]?.message || 'Invalid input', details };
  } else if (err instanceof multer.MulterError) {
    status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    const messages = {
      LIMIT_FILE_SIZE: `Each file must be smaller than ${env.maxUploadMb} MB`,
      LIMIT_FILE_COUNT: 'Too many files',
      LIMIT_UNEXPECTED_FILE: 'Too many files or an unexpected file field',
    };
    body = { code: err.code, message: messages[err.code] || err.message };
  } else if (err?.type === 'entity.parse.failed') {
    status = 400;
    body = { code: 'INVALID_JSON', message: 'Request body is not valid JSON' };
  } else if (err?.type === 'entity.too.large') {
    status = 413;
    body = { code: 'PAYLOAD_TOO_LARGE', message: 'Request is too large' };
  } else if (err?.code === '23505') {
    status = 409;
    body = { code: 'DUPLICATE', message: 'That record already exists' };
  } else if (err?.code === '22P02') {
    status = 400;
    body = { code: 'INVALID_ID', message: 'Invalid identifier' };
  }

  if (status >= 500) console.error(`✖ ${req.method} ${req.originalUrl}`, err);
  if (status >= 500 && !env.isProd) body.debug = err?.message;
  res.status(status).json({ error: body });
}
