const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export function timeAgo(date) {
  const d = new Date(date);
  const s = Math.round((d.getTime() - Date.now()) / 1000);
  const abs = Math.abs(s);
  if (abs < 45) return 'just now';
  if (abs < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  if (abs < 7 * 86400) return rtf.format(Math.round(s / 86400), 'day');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}

export const dateTime = (date) => new Date(date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

export const rupees = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(n) || 0);

export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';

export const SEVERITY = {
  1: { label: 'Low', tone: 'neem', bar: 'bg-neem' },
  2: { label: 'Medium', tone: 'muted', bar: 'bg-muted/40' },
  3: { label: 'High', tone: 'brass', bar: 'bg-brass' },
  4: { label: 'Critical', tone: 'signal', bar: 'bg-signal' },
};

export const STATUS = {
  open: { label: 'Open', tone: 'muted' },
  marked_for_solving: { label: 'Marked for solving', tone: 'brass' },
  in_progress: { label: 'In progress', tone: 'glacial' },
  under_review: { label: 'Under review', tone: 'brass' },
  solved: { label: 'Solved', tone: 'neem' },
  closed: { label: 'Closed', tone: 'muted' },
};

export const CATEGORIES = {
  safety: 'Safety',
  hostel: 'Hostel',
  academics: 'Academics',
  infrastructure: 'Infrastructure',
  health: 'Health',
  harassment: 'Harassment',
  transport: 'Transport',
  food: 'Mess & food',
  other: 'Other',
};

export const REACTIONS = [
  { type: 'like', emoji: '👍', label: 'Like' },
  { type: 'support', emoji: '🤝', label: 'Me too' },
  { type: 'love', emoji: '❤️', label: 'Love' },
  { type: 'wow', emoji: '😮', label: 'Wow' },
  { type: 'sad', emoji: '😢', label: 'Sad' },
  { type: 'angry', emoji: '😠', label: 'Angry' },
];

export const REPORT_REASONS = {
  spam: 'Spam or advertising',
  abusive: 'Abusive or hateful language',
  harassment: 'Harassment or targeting someone',
  false_info: 'False or misleading information',
  inappropriate: 'Inappropriate images or content',
  other: 'Something else',
};
