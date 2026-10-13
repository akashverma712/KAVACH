/**
 * Problem priority, so the admin can see which problems matter most.
 *
 *   priority score = severity × 10  +  likes × 2  +  comments × 3
 *
 * Severity (1–4, chosen by the student) carries the most weight; each student who likes the problem
 * ("I face this too") and each comment adds evidence that it affects many people. Admin-only
 * problems have no likes or comments, so they rank on severity alone — which is why sensitive,
 * high-severity private problems still surface near the top.
 */
export const PRIORITY_WEIGHTS = { severity: 10, like: 2, comment: 3 };

/** SQL expression over columns `severity`, `like_count`, `comment_count` of the given alias. */
export const prioritySql = (a) => `(${a}.severity * ${PRIORITY_WEIGHTS.severity} + ${a}.like_count * ${PRIORITY_WEIGHTS.like} + ${a}.comment_count * ${PRIORITY_WEIGHTS.comment})`;

export const PRIORITY_LEVELS = [
  { min: 50, level: 'critical' },
  { min: 35, level: 'high' },
  { min: 20, level: 'medium' },
  { min: 0, level: 'low' },
];

export const priorityLevel = (score) => PRIORITY_LEVELS.find((l) => score >= l.min).level;

export const priorityFormula = {
  weights: PRIORITY_WEIGHTS,
  levels: PRIORITY_LEVELS,
  text: `severity × ${PRIORITY_WEIGHTS.severity} + likes × ${PRIORITY_WEIGHTS.like} + comments × ${PRIORITY_WEIGHTS.comment}`,
};
