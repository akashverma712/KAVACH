export function paginate(q, { defaultLimit = 20, maxLimit = 100 } = {}) {
  const page = Math.max(1, Number.parseInt(q.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number.parseInt(q.limit, 10) || defaultLimit));
  return { page, limit, offset: (page - 1) * limit };
}
