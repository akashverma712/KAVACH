export class AppError extends Error {
  constructor(status, message, code = 'ERROR', details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (msg, code = 'BAD_REQUEST', details) => new AppError(400, msg, code, details);
export const unauthorized = (msg = 'Please sign in to continue', code = 'UNAUTHORIZED') => new AppError(401, msg, code);
export const forbidden = (msg = 'You do not have access to this', code = 'FORBIDDEN') => new AppError(403, msg, code);
export const notFound = (msg = 'Not found', code = 'NOT_FOUND') => new AppError(404, msg, code);
export const conflict = (msg, code = 'CONFLICT') => new AppError(409, msg, code);
export const tooMany = (msg, code = 'RATE_LIMITED', details) => new AppError(429, msg, code, details);

/** Wrap async route handlers so rejected promises reach the error middleware. */
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
