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
import { LateLoginModel, PasswordResetModel, UserModel, WfhHistoryModel } from '../models';
import { invalidateCache } from '../store';
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
  // Render runs in UTC; the office operates in IST (UTC+5:30). Shift the clock to IST
  // before checking the 10:15 AM late cutoff, otherwise a 10:51 AM IST login reads as
  // 5:21 AM UTC and is never flagged as late.
  const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  const hour = istNow.getUTCHours();
  const minute = istNow.getUTCMinutes();
  const isLate = hour > 10 || (hour === 10 && minute >= 15);

  // Use IST date boundaries expressed in UTC (MongoDB stores dates as UTC).
  const istYear = istNow.getUTCFullYear();
  const istMonth = istNow.getUTCMonth();
  const istDay = istNow.getUTCDate();
  const startOfIstDay = new Date(Date.UTC(istYear, istMonth, istDay, 0, 0, 0, 0));
  const endOfIstDay = new Date(Date.UTC(istYear, istMonth, istDay, 23, 59, 59, 999));

  const alreadyLoggedInToday = !!user.lastLoginAt &&
    new Date(user.lastLoginAt) >= startOfIstDay &&
    new Date(user.lastLoginAt) <= endOfIstDay;

  const alreadyDeclaredWfhToday = !!user.workFromHomeAt &&
    new Date(user.workFromHomeAt) >= startOfIstDay &&
    new Date(user.workFromHomeAt) <= endOfIstDay;

  const workFromHome = req.body?.workFromHome === true || req.body?.workFromHome === 'true';

  // Ask for WFH status only on the first login of the day (in IST).
  if (!alreadyDeclaredWfhToday && user.role === 'employee') {
    if (req.body?.workFromHome === undefined) {
      res.status(400).json({ error: 'Are you working from home today?', code: 'wfh_required' });
      return;
    }
    await UserModel.updateOne({ _id: user._id }, { $set: { workFromHome, workFromHomeAt: now } });

    // Append a WFH history record for this employee / IST date. The existing
    // User fields are left untouched for backward compatibility; this record is
    // the source of truth for historical WFH reporting.
    const wfhDate = `${istYear}-${String(istMonth + 1).padStart(2, '0')}-${String(istDay).padStart(2, '0')}`;
    const existing = await WfhHistoryModel.findOne({ employeeId: user.employeeId ?? user._id, date: wfhDate, isLatest: true }).lean();
    if (!existing) {
      await WfhHistoryModel.create({
        _id: `wfh-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        employeeId: user.employeeId ?? user._id,
        employeeName: user.name,
        date: wfhDate,
        workFromHome,
        declaredAt: now,
        createdAt: now,
        updatedAt: now,
        source: 'login',
        isLatest: true
      });
      invalidateCache();
    }
  }

  if (isLate && user.role === 'employee' && !alreadyLoggedInToday) {
    if (!lateReason) {
      res.status(400).json({ error: 'You are late. Please provide a reason for being late.', code: 'late_reason_required' });
      return;
    }
    await UserModel.updateOne({ _id: user._id }, { $set: { lastLoginAt: now, lateLoginReason: lateReason, lateLoginAt: now } });
    await LateLoginModel.create({ _id: `ll-${Date.now()}-${Math.random().toString(36).slice(2)}`, employeeId: user.employeeId ?? user._id, name: user.name, reason: lateReason, at: now });
    invalidateCache();
  } else if (!alreadyLoggedInToday) {
    await UserModel.updateOne({ _id: user._id }, { $set: { lastLoginAt: now } });
    invalidateCache();
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
