import { ZodError } from 'zod';
import { badRequest } from '../utils/errors.js';

export const formatZod = (err) => err.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));

/** Validate req[source] against a zod schema and replace it with the parsed value. */
export const validate = (schema, source = 'body') => (req, _res, next) => {
  try {
    const parsed = schema.parse(req[source] ?? {});
    if (source === 'query') req.validatedQuery = parsed;
    else if (source === 'params') req.validParams = parsed;
    else req[source] = parsed;
    next();
  } catch (err) {
    if (err instanceof ZodError) {
      const details = formatZod(err);
      return next(badRequest(details[0]?.message || 'Invalid input', 'VALIDATION_ERROR', details));
    }
    next(err);
  }
};
