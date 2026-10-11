import twilio from 'twilio';
import { env, isTwilioConfigured, twilioConfig } from '../config/env.js';
import { toE164 } from '../utils/phone.js';
import { AppError } from '../utils/errors.js';
import { printBox } from './console.js';

let cache = { key: null, client: null };

function client() {
  const c = twilioConfig();
  const key = `${c.sid}|${c.token}`;
  if (cache.key !== key) cache = { key, client: twilio(c.sid, c.token) };
  return cache.client;
}

/**
 * Send an SMS. Without Twilio credentials the message is printed in the terminal instead.
 * @param {{ to: string, body: string, kind?: string, throwOnFail?: boolean }} opts
 * @returns {{ delivered: boolean, via: 'twilio' | 'console', sid?: string, error?: string }}
 */
export async function sendSms({ to, body, kind = 'SMS', throwOnFail = true, consoleLines = [] }) {
  const e164 = toE164(to);
  if (!isTwilioConfigured()) {
    printBox(`📱 ${kind} (Twilio not configured — shown here instead)`, [`To: ${e164}`, ...consoleLines, '', ...body.split('\n')], kind.includes('SOS') ? 'red' : 'magenta');
    return { delivered: false, via: 'console' };
  }
  try {
    const msg = await client().messages.create({ to: e164, from: twilioConfig().from, body });
    return { delivered: true, via: 'twilio', sid: msg.sid };
  } catch (err) {
    console.error(`✖ Twilio delivery to ${e164} failed: ${err.message}`);
    if (!throwOnFail) return { delivered: false, via: 'twilio', error: err.message };
    if (!env.isProd) {
      printBox(`📱 ${kind} (Twilio failed — development fallback)`, [`To: ${e164}`, '', ...body.split('\n')], 'yellow');
      return { delivered: false, via: 'console', error: err.message };
    }
    throw new AppError(502, 'We could not send the SMS right now. Try again or use your email.', 'SMS_FAILED');
  }
}
