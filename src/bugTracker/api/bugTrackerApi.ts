/**
 * Bug Tracker data access layer for Workforce integration.
 *
 * All calls go through the existing Workforce API at /api/bug-tracker/*,
 * which is backed by MongoDB and protected by the same JWT session cookie.
 */
import type {
  AppNotification,
  Attachment,
  CommentKind,
  Employee,
  Issue,
  IssueDraft,
  IssueEditablePatch,
  Project,
  Team
} from '../types/bugTracker';
import type { TransitionId } from '../utils/workflow';

const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');
const BASE = `${API_BASE}/api/bug-tracker`;

function normalizeIssue<T>(issue: any): T {
  if (!issue || typeof issue !== 'object') return issue;
  if (issue._id !== undefined && issue.id === undefined) issue.id = issue._id;
  return issue as T;
}
function normalizeResponse<T>(data: any): T {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data.issues)) data.issues = data.issues.map(normalizeIssue);
  if (data.issue) data.issue = normalizeIssue(data.issue);
  return data as T;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {})
    }
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(text || `Request failed (${response.status})`);
  }

  if (!text) return {} as T;
  return normalizeResponse(JSON.parse(text)) as T;
}

export const bugTrackerApi = {
  getIssues: (filters?: Record<string, string>) => {
    const params = new URLSearchParams(filters ?? {});
    return request<{ issues: Issue[] }>(`/issues${params.toString() ? '?' + params.toString() : ''}`);
  },

  getIssue: (key: string) => request<{ issue: Issue }>(`/issues/${key}`),

  createIssue: (draft: IssueDraft) =>
    request<{ issue: Issue }>('/issues', { method: 'POST', body: JSON.stringify(draft) }),

  updateIssue: (key: string, patch: IssueEditablePatch) =>
    request<{ issue: Issue }>(`/issues/${key}`, { method: 'PATCH', body: JSON.stringify(patch) }),

  transitionIssue: (key: string, transitionId: TransitionId, toStatus: string, note?: string) =>
    request<{ issue: Issue }>(`/issues/${key}/transition`, {
      method: 'POST',
      body: JSON.stringify({ transitionId, toStatus, note })
    }),

  addComment: (key: string, body: string, kind: CommentKind) =>
    request<{ comment: { id: string; authorId: string; body: string; createdAt: string; kind: CommentKind } }>(
      `/issues/${key}/comments`,
      { method: 'POST', body: JSON.stringify({ body, kind }) }
    ),

  addAttachments: (key: string, attachments: Attachment[]) =>
    request<{ issue: Issue }>(`/issues/${key}/attachments`, {
      method: 'POST',
      body: JSON.stringify({ attachments })
    }),

  getEmployees: () => request<{ employees: Employee[] }>('/employees'),

  getProjects: () => request<{ projects: Project[] }>('/projects'),

  getTeams: () => request<{ teams: Team[] }>('/teams'),

  getNotifications: () => request<{ notifications: AppNotification[] }>('/notifications'),

  markNotificationsRead: () =>
    request<{ ok: boolean }>('/notifications/read', { method: 'POST' })
};
