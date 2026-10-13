import { assertSecureConfig, env, isSmtpConfigured, isTwilioConfigured, chatbotConfig } from './config/env.js';
import { createApp } from './app.js';
import { migrate } from './db/migrate.js';
import { pool, waitForDb } from './db/pool.js';
import { seed } from './db/seed.js';
import { startRateLimitJanitor } from './middleware/rateLimit.js';
import { startOtpJanitor } from './services/otp.service.js';
import { closeRealtime } from './services/realtime.service.js';
import { colors as c } from './services/console.js';

async function main() {
  assertSecureConfig();
  await waitForDb();
  await migrate();
  await seed({ quiet: true });

  const app = createApp();
  const server = app.listen(env.port, () => {
    const mode = (ok, on, off) => (ok ? `${c.green}${on}${c.reset}` : `${c.yellow}${off}${c.reset}`);
    console.log(`
${c.bold}🛡  Kavach API${c.reset} running on ${c.cyan}http://localhost:${env.port}${c.reset}  (${env.nodeEnv})
   Email delivery : ${mode(isSmtpConfigured(), 'SMTP', 'terminal (add SMTP_* to .env to send real emails)')}
   SMS delivery   : ${mode(isTwilioConfigured(), 'Twilio', 'terminal (add TWILIO_* to .env to send real SMS)')}
   Chatbot        : ${mode(Boolean(chatbotConfig().apiKey), 'AI + knowledge base', 'knowledge base')}
   Admin login    : ${env.admin.email}
`);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') console.error(`\n✖ Port ${env.port} is already in use. Stop the other process or set PORT in backend/.env.\n`);
    else console.error(err);
    process.exit(1);
  });
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  startRateLimitJanitor();
  startOtpJanitor();

  const shutdown = (signal) => {
    console.log(`\n${signal} received — shutting down gracefully`);
    server.close(async () => {
      await closeRealtime().catch(() => {});
      await pool.end().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (err) => console.error('Unhandled rejection', err));
}

main().catch((err) => {
  console.error(`\n✖ Failed to start Kavach API:\n${err.message}\n`);
  if (err.code === 'ECONNREFUSED' || /ECONNREFUSED|connect/.test(err.message)) {
    console.error('Is PostgreSQL running? Start it with:  docker compose up -d db   (from the project root)\n');
  }
  process.exit(1);
});
