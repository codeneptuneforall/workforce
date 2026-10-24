import type * as React from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AuthUser, Result } from '@shared/types';
import { ApiError, api } from '../api/client';

interface AuthValue {
  user: AuthUser | null;
  /** True while the initial "who am I" request is still running. */
  initialising: boolean;
  login: (email: string, password: string, lateReason?: string) => Promise<Result & {user?: AuthUser;code?: string;}>;
  logout: () => Promise<void>;
  expire: () => void;
  changePassword: (current: string, next: string) => Promise<Result>;
  resetPassword: (email: string, token: string, next: string) => Promise<Result>;
  forgotPassword: (email: string) => Promise<Result & {devToken?: string;}>;
  refresh: () => Promise<void>;
}

const AUTH_CHANNEL = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('workforce-auth') : null;

const AuthContext = createContext<AuthValue | null>(null);

export function validatePassword(pw: string): string | null {
  if (!pw) return 'Enter a password.';
  if (pw.length < 8) return 'Use at least 8 characters.';
  if (!/[A-Z]/.test(pw) || !/[a-z]/.test(pw)) return 'Include upper- and lower-case letters.';
  if (!/\d/.test(pw)) return 'Include at least one number.';
  return null;
}

export function AuthProvider({ children }: {children: React.ReactNode;}) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [initialising, setInitialising] = useState(true);
  const navigate = useNavigate();
  const broadcastRef = useRef(false);

  /** Restores the session from the httpOnly cookie on a page reload. */
  const refresh = useCallback(async () => {
    try {
      const res = await api.me();
      setUser(res.user);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      await refresh();
      if (active) setInitialising(false);
    })();
    return () => {
      active = false;
    };
  }, [refresh]);

  useEffect(() => {
    if (!AUTH_CHANNEL) return;
    const handler = (ev: MessageEvent) => {
      const data = ev.data;
      if (data?.type === 'login' && data?.user && !broadcastRef.current) {
        setUser(data.user);
      } else if (data?.type === 'logout') {
        setUser(null);
        navigate('/login', { replace: true, state: { signedOut: true } });
      }
    };
    AUTH_CHANNEL.addEventListener('message', handler);
    return () => AUTH_CHANNEL.removeEventListener('message', handler);
  }, [navigate]);

  const expire = useCallback(() => {
    setUser(null);
    if (AUTH_CHANNEL) AUTH_CHANNEL.postMessage({ type: 'logout' });
    navigate('/session-expired', { replace: true });
  }, [navigate]);

  const login = useCallback(async (email: string, password: string, lateReason?: string) => {
    try {
      const res = await api.login(email, password, lateReason);
      setUser(res.user);
      broadcastRef.current = true;
      if (AUTH_CHANNEL) AUTH_CHANNEL.postMessage({ type: 'login', user: res.user });
      setTimeout(() => { broadcastRef.current = false; }, 100);
      return { ok: true, user: res.user };
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Sign-in failed. Please try again.';
      const code = err instanceof ApiError ? err.code || err.data?.code : undefined;
      return { ok: false, error: message, code };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // The cookie is cleared on the next successful request either way.
    }
    setUser(null);
    if (AUTH_CHANNEL) AUTH_CHANNEL.postMessage({ type: 'logout' });
    navigate('/login', { replace: true, state: { signedOut: true } });
  }, [navigate]);

  const changePassword = useCallback(async (current: string, next: string) => {
    const invalid = validatePassword(next);
    if (invalid) return { ok: false, error: invalid };
    try {
      await api.changePassword(current, next);
      setUser((u) => (u ? { ...u, mustChangePassword: false } : u));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof ApiError ? err.message : 'Could not update the password.' };
    }
  }, []);

  const forgotPassword = useCallback(async (email: string) => {
    try {
      const res = await api.forgotPassword(email);
      return { ok: true, devToken: res.devToken };
    } catch (err) {
      return { ok: false, error: err instanceof ApiError ? err.message : 'Could not start the reset.' };
    }
  }, []);

  const resetPassword = useCallback(async (email: string, token: string, next: string) => {
    const invalid = validatePassword(next);
    if (invalid) return { ok: false, error: invalid };
    try {
      await api.resetPassword(email, token, next);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof ApiError ? err.message : 'Could not reset the password.' };
    }
  }, []);

  const value = useMemo(
    () => ({ user, initialising, login, logout, expire, changePassword, resetPassword, forgotPassword, refresh }),
    [user, initialising, login, logout, expire, changePassword, resetPassword, forgotPassword, refresh]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
