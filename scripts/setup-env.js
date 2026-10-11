// Creates backend/.env from .env.example with strong random secrets (safe to re-run: never overwrites).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const example = path.join(root, 'backend', '.env.example');
const target = path.join(root, 'backend', '.env');

if (fs.existsSync(target)) {
  console.log('✔ backend/.env already exists — left unchanged.');
  process.exit(0);
}
const secret = () => crypto.randomBytes(48).toString('hex');
let text = fs.readFileSync(example, 'utf8');
text = text
  .replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${secret()}`)
  .replace(/^ADMIN_JWT_SECRET=.*$/m, `ADMIN_JWT_SECRET=${secret()}`);
fs.writeFileSync(target, text);
console.log('✔ Created backend/.env with freshly generated JWT secrets.');
console.log('  Add SMTP / Twilio credentials there whenever you are ready — no code changes needed.');
