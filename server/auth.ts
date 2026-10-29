import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import type { AuthUser, Role } from '../shared/types';
import { config } from './config';
import { UserModel } from './models';

export interface UserDocument {
  _id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  title: string;
  employeeId?: string;
  canManagePayroll: boolean;
  mustChangePassword: boolean;
  active: boolean;
  passwordChangedAt?: Date;
  lastLoginAt?: Date;
  lateLoginReason?: string;
  lateLoginAt?: Date;
}

export const toAuthUser = (user: UserDocument): AuthUser => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  title: user.title,
  employeeId: user.employeeId,
  canManagePayroll: user.canManagePayroll,
  mustChangePassword: user.mustChangePassword
});

export const hashPassword = (plain: string): Promise<string> =>
  bcrypt.hash(plain, config.bcryptRounds);

export const verifyPassword = (plain: string, hash: string): Promise<boolean> =>
  bcrypt.compare(plain, hash);

export function signSessionToken(user: AuthUser): string {
  return jwt.sign({ sub: user.id, role: user.role, email: user.email }, config.jwtSecret, {
    expiresIn: `${config.sessionHours}h`
  });
}

export function readSessionToken(req: Request): string | null {
  const cookie = (req.cookies as Record<string, string> | undefined)?.[config.cookieName];
  if (cookie) return cookie;
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return null;
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(config.cookieName, token, {
    httpOnly: true,
    // The client is hosted separately from the API in production (e.g. Cloudflare
    // Pages -> Render), so the session cookie must be accepted on cross-site
    // requests. Browsers only allow that with SameSite=None + Secure.
    sameSite: config.isProduction ? 'none' : 'lax',
    secure: config.isProduction,
    maxAge: config.sessionHours * 60 * 60 * 1000,
    path: '/'
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(config.cookieName, {
    httpOnly: true,
    sameSite: config.isProduction ? 'none' : 'lax',
    secure: config.isProduction,
    path: '/'
  });
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      userDoc?: UserDocument;
    }
  }
}

/** Verifies the session token and loads the live account from MongoDB. */
export async function attachUser(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = readSessionToken(req);
    if (!token) return next();
    const payload = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload;
    const user = (await UserModel.findById(payload.sub).lean()) as unknown as UserDocument | null;
    if (!user || !user.active) return next();
    req.userDoc = user;
    req.user = toAuthUser(user);
    next();
  } catch {
    next();
  }
}

/** Rejects the request when there is no valid session. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    return;
  }
  next();
}

/**
 * Rejects the request while the account still uses its issued password.
 *
 * The account can sign in and change the password, but no business data is served and no
 * mutation is applied until the password is replaced.
 */
export function requirePasswordChanged(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    return;
  }
  if (req.user.mustChangePassword) {
    res.status(403).json({ error: 'Change your password to continue.', code: 'must_change_password' });
    return;
  }
  next();
}

/** Rejects the request unless the account holds the required role. */
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'You do not have permission to perform this action.' });
      return;
    }
    next();
  };
}

/** Rejects the request unless the account may run payroll. */
export function requirePayroll(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    return;
  }
  if (req.user.role !== 'management' || !req.user.canManagePayroll) {
    res.status(403).json({ error: 'You do not have permission to perform this action.' });
    return;
  }
  next();
}

export function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
