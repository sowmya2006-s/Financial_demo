// src/server.ts
// HTTP server entry point.
// Loads environment variables, starts the Express app, handles graceful shutdown.

import { env } from './config/env';
import app from './app';
import prisma from './config/prisma';

const server = app.listen(env.port, () => {
  console.log(`[server] Moolah Minds backend running on port ${env.port} (${env.nodeEnv})`);
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
// Closes open connections cleanly on SIGTERM / SIGINT (e.g. Docker stop, Ctrl+C)

async function shutdown(): Promise<void> {
  console.log('[server] Shutting down gracefully...');
  server.close(async () => {
    await prisma.$disconnect();
    console.log('[server] Database disconnected. Exiting.');
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default server;
