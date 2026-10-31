import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}. Copy .env.example to .env and fill it in.`);
  }
  return value;
}

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProduction = nodeEnv === 'production';

const devSecret = 'dev-only-insecure-secret-change-me';

export const config = {
  nodeEnv,
  isProduction,
  port: Number(process.env.PORT ?? 4000),
  mongoUri: required('MONGODB_URI', 'mongodb://127.0.0.1:27017/workforce'),
  jwtSecret: process.env.JWT_SECRET ?? (isProduction ? '' : devSecret),
  sessionHours: Number(process.env.SESSION_HOURS ?? 12),
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS ?? 12),
  cookieName: 'wf_session',
  resetTokenTtlMinutes: Number(process.env.RESET_TOKEN_TTL_MINUTES ?? 30),
  clientOrigins: (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  seedAdminEmail: process.env.SEED_ADMIN_EMAIL ?? 'admin@codeneptune.in',
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345',
  /** A second management login with its own password and no forced change. */
  seedManagerEmail: process.env.SEED_MANAGER_EMAIL ?? 'info@codeneptune.com',
  seedManagerPassword: process.env.SEED_MANAGER_PASSWORD ?? 'CodeNeptune',
  seedDefaultPassword: process.env.SEED_DEFAULT_PASSWORD ?? 'Welcome@123',
  /** Serve the built client from the API server (single-origin production deployment). */
  serveClient: process.env.SERVE_CLIENT !== 'false',
  /** Enable the integrated Bug Tracker module. Defaults to enabled. */
  bugTrackerEnabled: process.env.BUG_TRACKER_ENABLED !== 'false'
};

if (isProduction && config.jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters in production.');
}
