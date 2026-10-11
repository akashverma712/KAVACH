import nodemailer from 'nodemailer';
import { env, isSmtpConfigured, smtpConfig } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { printBox } from './console.js';

let cache = { key: null, transporter: null };

function transporter() {
  const c = smtpConfig();
  const key = `${c.host}|${c.port}|${c.user}|${c.pass}`;
  if (cache.key !== key) {
    cache.transporter?.close?.();
    cache = {
      key,
      transporter: nodemailer.createTransport({
        host: c.host,
        port: c.port,
        secure: c.port === 465,
        auth: { user: c.user, pass: c.pass },
        pool: true,
        maxConnections: 3,
        connectionTimeout: 15_000,
      }),
    };
  }
  return cache.transporter;
}

/**
 * Send an email. Without SMTP credentials the message is printed in the terminal instead.
 * @returns {{ delivered: boolean, via: 'smtp' | 'console' }}
 */
export async function sendMail({ to, subject, text, html, consoleLines }) {
  if (!isSmtpConfigured()) {
    printBox(`✉  EMAIL (SMTP not configured — shown here instead)`, [
      `To:      ${to}`,
      `Subject: ${subject}`,
      '',
      ...(consoleLines || text.split('\n')),
    ], 'cyan');
    return { delivered: false, via: 'console' };
  }
  try {
    await transporter().sendMail({ from: smtpConfig().from, to, subject, text, html });
    return { delivered: true, via: 'smtp' };
  } catch (err) {
    console.error(`✖ SMTP delivery to ${to} failed: ${err.message}`);
    if (!env.isProd) {
      printBox('✉  EMAIL (SMTP failed — development fallback)', [`To: ${to}`, `Subject: ${subject}`, '', ...(consoleLines || text.split('\n'))], 'yellow');
      return { delivered: false, via: 'console' };
    }
    throw new AppError(502, 'We could not send the email right now. Try again or use your phone number.', 'EMAIL_FAILED');
  }
}

const shell = (inner) => `<!doctype html><html><body style="margin:0;background:#eef1f6;font-family:Arial,Helvetica,sans-serif;color:#14213d">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #d8dee9">
<tr><td style="background:#14213d;padding:20px 28px;color:#fff;font-size:18px;font-weight:bold">Kavach <span style="font-weight:normal;opacity:.75">· BIT Sindri</span></td></tr>
<tr><td style="padding:28px">${inner}</td></tr>
<tr><td style="padding:16px 28px;background:#f6f8fb;font-size:12px;color:#5b6b88">Campus safety &amp; wellbeing. If you did not request this, you can ignore this email.</td></tr>
</table></td></tr></table></body></html>`;

export const otpEmailHtml = ({ heading, code, minutes }) => shell(`
  <p style="margin:0 0 8px;font-size:16px">${heading}</p>
  <p style="margin:0 0 20px;color:#5b6b88;font-size:14px">Enter this code to continue. It expires in ${minutes} minutes.</p>
  <div style="font-size:34px;letter-spacing:10px;font-weight:bold;background:#eef1f6;border-radius:12px;padding:16px;text-align:center">${code}</div>
  <p style="margin:20px 0 0;color:#5b6b88;font-size:13px">Never share this code. Kavach staff will never ask for it.</p>`);

export const alertEmailHtml = ({ heading, lines, link }) => shell(`
  <p style="margin:0 0 12px;font-size:18px;font-weight:bold;color:#d6243a">${heading}</p>
  ${lines.map((l) => `<p style="margin:0 0 6px;font-size:14px">${l}</p>`).join('')}
  ${link ? `<p style="margin:18px 0 0"><a href="${link}" style="display:inline-block;background:#d6243a;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:bold">Open location in Google Maps</a></p>` : ''}`);
