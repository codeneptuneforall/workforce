import { Router } from 'express';
import { validatePassword } from '../../shared/domain/password';
import {
  clearSessionCookie,
  createResetToken,
  hashPassword,
  hashResetToken,
  requireAuth,
  setSessionCookie,
  signSessionToken,
  toAuthUser,
  verifyPassword
} from '../auth';
import { config } from '../config';
import { PasswordResetModel, UserModel } from '../models';
import type { UserDocument } from '../auth';

export const authRouter = Router();

const findUser = async (email: string): Promise<UserDocument | null> =>
  (await UserModel.findOne({ email: email.trim().toLowerCase() }).lean()) as unknown as UserDocument | null;

/** Sign in with email + password. The session is an httpOnly cookie, never localStorage. */
authRouter.post('/login', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  const lateReason = String(req.body?.lateReason ?? '').trim();
  if (!email || !password) {
    res.status(400).json({ error: 'Enter your work email and password.' });
    return;
  }
  const user = await findUser(email);
  if (!user || !user.active || !(await verifyPassword(password, user.passwordHash))) {
    res.status(401).json({ error: 'The email or password is incorrect.' });
    return;
  }
  
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const isLate = hour > 10 || (hour === 10 && minute >= 15);

  // Ask for a late reason at most once per calendar day.
  const alreadyLateToday = !!user.lateLoginAt && new Date(user.lateLoginAt).toDateString() === now.toDateString();

  if (isLate && user.role === 'employee' && !alreadyLateToday) {
    if (!lateReason) {
      res.status(400).json({ error: 'You are late. Please provide a reason for being late.', code: 'late_reason_required' });
      return;
    }
    await UserModel.updateOne({ _id: user._id }, { $set: { lastLoginAt: now, lateLoginReason: lateReason, lateLoginAt: now } });
  } else {
    await UserModel.updateOne({ _id: user._id }, { $set: { lastLoginAt: now } });
  }
  
  const authUser = toAuthUser(user);
  const token = signSessionToken(authUser);
  setSessionCookie(res, token);
  res.json({ user: authUser, token });
});

/** Sign out and clear the session cookie. */
authRouter.post('/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

/** The signed-in account, or 401 when the session is missing or expired. */
authRouter.get('/me', (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Not signed in.' });
    return;
  }
  res.json({ user: req.user });
});

/** Change the password of the signed-in account. */
authRouter.post('/change-password', requireAuth, async (req, res) => {
  const currentPassword = String(req.body?.currentPassword ?? '');
  const newPassword = String(req.body?.newPassword ?? '');
  const user = await findUser(req.user!.email);
  if (!user) {
    res.status(401).json({ error: 'Your account is no longer available.' });
    return;
  }
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    res.status(400).json({ error: 'Your current password is incorrect.' });
    return;
  }
  const invalid = validatePassword(newPassword);
  if (invalid) {
    res.status(400).json({ error: invalid });
    return;
  }
  if (currentPassword === newPassword) {
    res.status(400).json({ error: 'Choose a password you have not just used.' });
    return;
  }
  await UserModel.updateOne(
    { _id: user._id },
    { $set: { passwordHash: await hashPassword(newPassword), mustChangePassword: false, passwordChangedAt: new Date() } }
  );
  res.json({ ok: true });
});

/**
 * Start a password reset.
 *
 * There is no mail provider wired up, so the reset link is written to the server log.
 * The token is only returned to the browser outside production, which keeps local
 * development usable without ever leaking a reset token in a real deployment.
 */
authRouter.post('/forgot-password', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const user = await findUser(email);
  if (!user || !user.active) {
    // Always answer the same way so the endpoint cannot be used to enumerate accounts.
    res.json({ ok: true, message: 'If an account exists for that address, a reset link has been issued.' });
    return;
  }
  const token = createResetToken();
  await PasswordResetModel.deleteMany({ userId: user._id });
  await PasswordResetModel.create({
    _id: createResetToken(),
    userId: user._id,
    tokenHash: hashResetToken(token),
    expiresAt: new Date(Date.now() + config.resetTokenTtlMinutes * 60 * 1000)
  });
  const link = `${config.clientOrigins[0] ?? ''}/reset-password?email=${encodeURIComponent(user.email)}&token=${token}`;
  console.log(`[password-reset] ${user.email}: ${link}`);
  res.json({
    ok: true,
    message: 'If an account exists for that address, a reset link has been issued.',
    ...(config.isProduction ? {} : { devToken: token })
  });
});

/** Complete a password reset using the emailed token. */
authRouter.post('/reset-password', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const token = String(req.body?.token ?? '');
  const newPassword = String(req.body?.newPassword ?? '');
  const invalid = validatePassword(newPassword);
  if (invalid) {
    res.status(400).json({ error: invalid });
    return;
  }
  const user = await findUser(email);
  if (!user) {
    res.status(400).json({ error: 'This reset link is no longer valid. Request a new one.' });
    return;
  }
  const record = await PasswordResetModel.findOne({
    userId: user._id,
    tokenHash: hashResetToken(token),
    usedAt: { $exists: false }
  }).lean();
  if (!record || new Date(record.expiresAt).getTime() < Date.now()) {
    res.status(400).json({ error: 'This reset link is no longer valid. Request a new one.' });
    return;
  }
  await PasswordResetModel.updateOne({ _id: record._id }, { $set: { usedAt: new Date() } });
  await UserModel.updateOne(
    { _id: user._id },
    {
      $set: {
        passwordHash: await hashPassword(newPassword),
        mustChangePassword: false,
        passwordChangedAt: new Date()
      }
    }
  );
  res.json({ ok: true });
});
