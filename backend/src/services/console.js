const C = { reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m', cyan: '\x1b[36m', yellow: '\x1b[33m', magenta: '\x1b[35m', red: '\x1b[31m', green: '\x1b[32m' };

/** Print a highlighted box in the terminal — used when SMTP/Twilio are not configured. */
export function printBox(title, lines, color = 'cyan') {
  const width = Math.max(title.length + 4, ...lines.map((l) => String(l).length + 4), 56);
  const c = C[color] || C.cyan;
  const bar = '─'.repeat(width);
  const out = [
    '',
    `${c}┌${bar}┐${C.reset}`,
    `${c}│${C.reset} ${C.bold}${title.padEnd(width - 2)}${C.reset} ${c}│${C.reset}`,
    `${c}├${bar}┤${C.reset}`,
    ...lines.map((l) => `${c}│${C.reset} ${String(l).padEnd(width - 2)} ${c}│${C.reset}`),
    `${c}└${bar}┘${C.reset}`,
    '',
  ];
  console.log(out.join('\n'));
}

export const colors = C;
