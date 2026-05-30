// src/app.ts
// Express application setup.
// Registers middleware and mounts all routers.
// Kept separate from server.ts so tests can import the app without starting a port listener.

import express from 'express';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import healthRouter from './api/healthController';
import authRouter from './api/authController';
import profileRouter from './api/profileController';
import gameRouter from './api/gameController';
import financeRouter from './api/financeController';
import leaderboardRouter from './api/leaderboardController';
import loanRouter from './api/loanController';
import insuranceRouter from './api/insuranceController';
import investRouter from './api/investController';
import spendRouter from './api/spendController';
import dashboardRouter from './api/dashboardController';
import path from 'path';

const app = express();

// ─── Global Middleware ────────────────────────────────────────────────────────

app.use(express.json()); // parse JSON request bodies
app.use(express.urlencoded({ extended: false })); // parse URL-encoded bodies

// Allow browser-based frontend testing from any local origin.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

if (process.env['NODE_ENV'] !== 'test') {
  app.use(requestLogger);
}

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/health', healthRouter);
app.use('/auth', authRouter);
app.use('/profiles', profileRouter);
app.use('/game', gameRouter);
app.use('/finance', financeRouter);
app.use('/cohorts', leaderboardRouter);
app.use('/api/loan', loanRouter);
app.use('/api/insurance', insuranceRouter);
app.use('/api/invest', investRouter);
app.use('/api/spend', spendRouter);
app.use('/api/dashboard', dashboardRouter);

// Serve static files from the project root (where .html files are located)
app.use(express.static(path.join(__dirname, '..')));

// ─── 404 Handler ─────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found', code: 'NOT_FOUND' });
});

// ─── Global Error Handler (must be last) ─────────────────────────────────────

app.use(errorHandler);

export default app;
