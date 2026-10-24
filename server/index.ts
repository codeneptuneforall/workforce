import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { attachUser } from './auth';
import { config } from './config';
import { connectDatabase, disconnectDatabase } from './db';
import { apiRouter } from './routes/api';
import { authRouter } from './routes/auth';
import uploadRouter from './routes/upload';

const dir = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.resolve(dir, '../dist/client');

const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(
  cors((req, callback) => {
    // The API also serves the built client, so its own origin is always allowed.
    const selfOrigin = req.headers.host ? `${req.protocol}://${req.headers.host}` : '';
    const origins = config.clientOrigins.includes(selfOrigin)
      ? config.clientOrigins
      : [...config.clientOrigins, selfOrigin].filter(Boolean);
    callback(null, { origin: origins, credentials: true });
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

/**
 * API responses belong to one session and must never be stored by a browser or a proxy.
 *
 * Without this, the 401 that /api/auth/me returns before sign-in is cached, and after
 * signing in the browser replays that stale body instead of the live session — which
 * logs the user straight back out on the next page load.
 */
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.vary('Cookie');
  next();
});

/** Brute-force protection on the credential endpoints. */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' }
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'workforce-api', time: new Date().toISOString() });
});

app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/forgot-password', loginLimiter);
app.use('/api/auth/reset-password', loginLimiter);

// The session is attached to every API request, including the auth routes — the
// "who am I" and "change my password" endpoints need the signed-in account.
app.use('/api', attachUser);
app.use('/api/auth', authRouter);
app.use('/api/upload', uploadRouter);
app.use('/uploads', express.static(path.resolve(dir, '../uploads')));
app.use('/api', apiRouter);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Unknown API endpoint.' });
});

// Serve the built client when it exists, so the whole app runs on one origin.
if (config.serveClient) {
  app.use(express.static(clientDir, { index: false, maxAge: '1h' }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    // The shell must never be cached, otherwise a redeploy keeps serving the old bundle.
    res.set('Cache-Control', 'no-store');
    res.sendFile(path.join(clientDir, 'index.html'), (err) => {
      if (err) next();
    });
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // Malformed JSON, oversized bodies and similar client mistakes carry their own status.
  const status = Number(err?.status ?? err?.statusCode);
  if (Number.isInteger(status) && status >= 400 && status < 500) {
    res.status(status).json({ error: 'The request could not be read. Please check the data and try again.' });
    return;
  }
  console.error('[server] unhandled error', err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

async function start(): Promise<void> {
  await connectDatabase();
  // Bind to all interfaces: hosted platforms (Render, Railway, Koyeb, Fly) reach
  // the container from outside, so 127.0.0.1 would be unreachable.
  app.listen(config.port, '0.0.0.0', () => {
    console.log(`[server] workforce API listening on http://0.0.0.0:${config.port}`);
    if (config.serveClient) console.log(`[server] serving client from ${clientDir}`);
  });
}

async function shutdown(signal: string): Promise<void> {
  console.log(`[server] ${signal} received, shutting down`);
  await disconnectDatabase();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

start().catch((err) => {
  console.error('[server] failed to start', err);
  process.exit(1);
});

export { app };
