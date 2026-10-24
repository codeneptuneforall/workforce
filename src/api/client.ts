import type { AppState, AuthUser, Credentials, Role } from '@shared/types';

/** A user account as seen by management account pickers. */
export interface AccountSummary {
  id: string;
  name: string;
  email: string;
  role: Role;
  title: string;
  employeeId?: string;
  canManagePayroll: boolean;
}

/**
 * Thin fetch wrapper around the Express API.
 *
 * The session lives in an httpOnly cookie, so every request sends credentials and no
 * token is ever written to localStorage.
 */

const BASE = (import.meta.env?.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  status: number;
  code?: string;
  data?: any;
  constructor(message: string, status: number, code?: string, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE}/api${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers ?? {})
      }
    });
  } catch {
    throw new ApiError('The server is unreachable. Check your connection and try again.', 0);
  }

  const text = await response.text();
  let payload: Record<string, unknown> = {};
  if (text) {
    // A proxy or gateway can answer with HTML (or plain text) instead of our JSON.
    // Falling back to an empty object keeps the status-based message below intact.
    try {
      payload = JSON.parse(text) as Record<string, unknown>;
    } catch {
      payload = {};
    }
  }

  if (!response.ok) {
    const gateway = response.status === 502 || response.status === 503 || response.status === 504;
    const message =
      (payload.error as string) ??
      (gateway
        ? 'The API server is not responding. Start it with "npm run dev" and try again.'
        : `Request failed (${response.status}).`);
    throw new ApiError(message, response.status, (payload.code as string) || (payload as any).code, payload);
  }
  return payload as T;
}

export const api = {
  login: (email: string, password: string, lateReason?: string) =>
    request<{ user: AuthUser }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password, lateReason }) }),

  logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),

  me: () => request<{ user: AuthUser }>('/auth/me'),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: boolean }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword })
    }),

  forgotPassword: (email: string) =>
    request<{ ok: boolean; message: string; devToken?: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email })
    }),

  resetPassword: (email: string, token: string, newPassword: string) =>
    request<{ ok: boolean }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, token, newPassword })
    }),

  state: () => request<{ state: AppState }>('/state'),

  accounts: () => request<{ accounts: AccountSummary[] }>('/accounts'),

  mutate: (op: string, args: Record<string, unknown> = {}) =>
    request<{ state: AppState; credentials?: Credentials }>('/state/mutate', { method: 'POST', body: JSON.stringify({ op, args }) })
};
