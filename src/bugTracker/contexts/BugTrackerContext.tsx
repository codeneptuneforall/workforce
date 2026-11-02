import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type * as React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { bugTrackerApi } from '../api/bugTrackerApi';
import { toast } from 'sonner';
import type {
  AppNotification,
  Attachment,
  CommentKind,
  Employee,
  Issue,
  IssueDraft,
  IssueEditablePatch,
  Priority,
  Project,
  Role,
  RolePermissions,
  Team } from
'../types/bugTracker';
import { nowIso } from '../utils/dates';
import { createId } from '../utils/issueService';
import { canViewIssue, rolePermissions } from '../utils/permissions';
import { getTransition, type TransitionId } from '../utils/workflow';

interface AssignOptions {
  assigneeId: string;
  dueDate: string | null;
  priority?: Priority;
}

interface BugTrackerContextValue {
  issues: Issue[];
  visibleIssues: Issue[];
  scopedIssues: Issue[];
  employees: Employee[];
  projects: Project[];
  teams: Team[];
  role: Role;
  setRole: (role: Role) => void;
  currentUser: Employee;
  permissions: RolePermissions;
  accessibleProjects: Project[];
  projectScope: string;
  setProjectScope: (projectId: string) => void;
  getEmployee: (id: string | null | undefined) => Employee | undefined;
  getProject: (id: string) => Project | undefined;
  getIssueByKey: (key: string) => Issue | undefined;
  getIssue: (key: string) => Promise<Issue | null>;
  notifications: AppNotification[];
  markNotificationsRead: () => void;
  createIssue: (draft: IssueDraft) => Promise<Issue | null>;
  updateIssue: (id: string, patch: IssueEditablePatch) => Promise<void>;
  assignIssue: (id: string, options: AssignOptions) => Promise<void>;
  runTransition: (id: string, transitionId: TransitionId, note?: string) => Promise<void>;
  addComment: (id: string, body: string, kind: CommentKind) => Promise<void>;
  addAttachments: (id: string, attachments: Attachment[]) => Promise<void>;
  deleteIssue: (key: string) => Promise<void>;
  resetPreviewData: () => void;
  loading: boolean;
}

const BugTrackerContext = createContext<BugTrackerContextValue | null>(null);

/** Map a Workforce auth role to a Bug Tracker role. */
function mapWorkforceRoleToBt(role: string, canManagePayroll: boolean): Role {
  if (role === 'management' && canManagePayroll) return 'admin';
  if (role === 'management') return 'manager';
  return 'developer';
}

export function BugTrackerProvider({ children }: {children: React.ReactNode;}) {
  const { user } = useAuth();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [role, setRole] = useState<Role>(() => {
    if (!user) return 'developer';
    return mapWorkforceRoleToBt(user.role, user.canManagePayroll);
  });
  const [projectScope, setProjectScope] = useState('all');
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const employeeMap = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);
  const mountedRef = useRef(true);
  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const currentUser = useMemo(() => {
    if (!user) return employees[0] ?? { id: '', name: '', initials: '', title: '', email: '', teamId: '', role: 'developer', projectIds: [], userId: '' };
    const btEmployee = employees.find((e) => e.id === user.employeeId || e.email.toLowerCase() === user.email.toLowerCase() || e.userId === user.id);
    if (btEmployee) return btEmployee;
    return {
      id: user.id,
      name: user.name,
      initials: user.name.split(' ').map((n) => n[0]).join('').toUpperCase(),
      title: user.title,
      email: user.email,
      teamId: '',
      role: mapWorkforceRoleToBt(user.role, user.canManagePayroll),
      projectIds: [],
      userId: user.id
    };
  }, [user, employees]);

  const permissions = rolePermissions[role];

  // QA engineers (Workforce employees whose designation contains "QA"/"quality")
  // resolve to the 'qa' Bug Tracker role on the server. Mirror that here so the
  // client UI (including assign-on-create) matches the server-side role.
  useEffect(() => {
    if (currentUser?.role === 'qa' && role !== 'qa') setRole('qa');
  }, [currentUser]);
  const accessibleProjects = useMemo(() => {
    // Users with no project memberships (e.g. management) oversee all projects.
    if (currentUser.projectIds.length === 0) {
      return projects;
    }
    const filtered = projects.filter((p) => currentUser.projectIds.includes(p.id));
    // Fall back to all projects if the membership list is stale/empty-match,
    // so dropdowns are never blank.
    return filtered.length ? filtered : projects;
  }, [currentUser, projects]);

  const refreshNotifications = useCallback(async () => {
    try {
      const notifRes = await bugTrackerApi.getNotifications();
      const mapped = (notifRes.notifications ?? []).map((n: any) => {
        if (n.issueKey) return n;
        const link = n.link || '';
        const mm = link.match(/\/issues\/([^/?#]+)/);
        return mm ? { ...n, issueKey: mm[1] } : n;
      });
      setNotifications(mapped);
    } catch (err) {
      console.error('[bugTracker] notification refresh failed', err);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      try {
        const [empRes, projRes, teamRes, notifRes] = await Promise.all([
          bugTrackerApi.getEmployees(),
          bugTrackerApi.getProjects(),
          bugTrackerApi.getTeams(),
          bugTrackerApi.getNotifications()
        ]);
        if (!mountedRef.current) return;
        setEmployees(empRes.employees ?? []);
        let projects = projRes.projects ?? [];
        // Fallback to the verified Workforce state source if the bug-tracker
        // endpoint returns nothing (e.g. split deployment / stale backend).
        if (!projects.length) {
          try {
            const apiBase = (import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');
            const stateRes = await fetch(`${apiBase}/api/state`, { credentials: 'include' });
            if (stateRes.ok) {
              const stateData = await stateRes.json();
              const wfProjects = stateData?.state?.projects ?? [];
              projects = wfProjects.map((p: any) => ({
                id: p.id ?? p._id,
                name: p.name,
                code: p.code,
                leadId: p.managerId ?? p.leadId
              }));
            }
          } catch (e) {
            console.error('[bugTracker] state fallback failed', e);
          }
        }
        setProjects(projects);
        setTeams(teamRes.teams ?? []);
        const mapped = (notifRes.notifications ?? []).map((n: any) => {
          if (n.issueKey) return n;
          // Workforce notifications carry a `link` like /bug-tracker/issues/WF-123
          const link = n.link || '';
          const m = link.match(/\/issues\/([^/?#]+)/);
          return m ? { ...n, issueKey: m[1] } : n;
        });
        setNotifications(mapped);
      } catch (err) {
        console.error('[bugTracker] initial data load failed', err);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();
    return () => { mountedRef.current = false; };
  }, []);

  const refreshIssues = useCallback(async (): Promise<void> => {
    try {
      const res = await bugTrackerApi.getIssues();
      if (!mountedRef.current) return;
      const incoming = res.issues ?? [];
      setIssues((prev) => {
        const byId = new Map(prev.map((i) => [i.id, i]));
        for (const issue of incoming) {
          byId.set(issue.id, issue);
        }
        return Array.from(byId.values());
      });
    } catch (err) {
      console.error('[bugTracker] issues refresh failed', err);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      try {
        const res = await bugTrackerApi.getIssues();
        if (mountedRef.current) setIssues(res.issues ?? []);
      } catch (err) {
        console.error('[bugTracker] issues load failed', err);
      }
    })();
    return () => { mountedRef.current = false; };
  }, []);

  // Poll for issue changes so every screen sees live status updates
  // from other users without a manual page refresh.
  useEffect(() => {
    const poll = async () => {
      if (document.visibilityState === 'visible') await refreshIssues();
    };
    const id = window.setInterval(poll, 15000);
    poll();
    return () => window.clearInterval(id);
  }, [refreshIssues]);

  // Socket.io: push issue updates instantly (sub-second) without polling.
  useEffect(() => {
    const apiBase = (import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');
    const socket = io(apiBase, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    socket.on('connect', () => {
      console.log('[bugTracker] socket connected');
    });

    socket.on('disconnect', () => {
      console.log('[bugTracker] socket disconnected');
    });

    socket.on('connect_error', (err: Error) => {
      console.error('[bugTracker] socket connect error', err.message);
    });

    // New issue created by anyone
    socket.on('issue:created', (issue: Issue) => {
      setIssues((prev) => {
        if (prev.some((i) => i.id === issue.id)) return prev;
        return [issue, ...prev];
      });
    });

    // Issue fields updated (edit, assign, priority, etc.)
    socket.on('issue:updated', (issue: Issue) => {
      setIssues((prev) => prev.map((i) => i.id === issue.id ? issue : i));
    });

    // Status transition (start, submit-qa, pass-qa, etc.)
    socket.on('issue:transitioned', (issue: Issue) => {
      setIssues((prev) => prev.map((i) => i.id === issue.id ? issue : i));
    });

    // Issue deleted
    socket.on('issue:deleted', (data: { key: string; id: string }) => {
      setIssues((prev) => prev.filter((i) => i.key !== data.key && i.id !== data.id));
    });

    // New comment added
    socket.on('issue:commented', (data: { issueKey: string; comment: any }) => {
      setIssues((prev) => prev.map((i) => {
        if (i.id !== data.issueKey && i.key !== data.issueKey) return i;
        return {
          ...i,
          updatedAt: new Date().toISOString(),
          comments: [...i.comments, data.comment],
        };
      }));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => { refreshNotifications(); }, 30000);
    return () => window.clearInterval(id);
  }, [refreshNotifications]);

  const visibleIssues = useMemo(() => issues.filter((i) => canViewIssue(i, currentUser)), [issues, currentUser]);
  const scopedIssues = useMemo(
    () => projectScope === 'all' ? visibleIssues : visibleIssues.filter((i) => i.projectId === projectScope),
    [visibleIssues, projectScope]
  );

  const getEmployee = useCallback((id: string | null | undefined) => id ? employeeMap.get(id) : undefined, [employeeMap]);
  const getProject = useCallback((id: string) => projectMap.get(id), [projectMap]);
  const getIssueByKey = useCallback((key: string) => issues.find((i) => i.key === key), [issues]);

  const getIssue = useCallback(async (key: string): Promise<Issue | null> => {
    try {
      const res = await bugTrackerApi.getIssue(key);
      return res.issue ?? null;
    } catch {
      return null;
    }
  }, []);

  const notify = useCallback((recipientIds: (string | null | undefined)[], title: string, body: string, issueKey?: string) => {
    const unique = Array.from(new Set(recipientIds.filter((id): id is string => Boolean(id))));
    if (!unique.length) return;
    setNotifications((prev) => [
      ...unique.map((recipientId) => ({ id: createId('ntf'), recipientId, title, body, issueKey, createdAt: nowIso(), read: false })),
      ...prev
    ]);
  }, []);

  const createIssue = useCallback(async (draft: IssueDraft): Promise<Issue | null> => {
    try {
      const res = await bugTrackerApi.createIssue(draft);
      const issue = res.issue;
      if (!issue) return null;
      setIssues((prev) => [issue, ...prev]);
      notify([draft.assigneeId], 'Assigned to you', `${issue.key} ${issue.title}`, issue.key);
      await refreshIssues();
      return issue;
    } catch (err: any) {
      console.error('[bugTracker] createIssue failed', err);
      throw new Error(err.message || 'Failed to report issue');
    }
  }, [notify, refreshIssues]);

  const updateIssue = useCallback(async (id: string, patch: IssueEditablePatch): Promise<void> => {
    try {
      const issue = issues.find((i) => i.id === id);
      if (!issue) return;
      const res = await bugTrackerApi.updateIssue(issue.key, patch);
      if (res.issue) {
        setIssues((prev) => prev.map((i) => i.id === id ? res.issue! : i));
      }
      await refreshIssues();
    } catch (err) {
      console.error('[bugTracker] updateIssue failed', err);
    }
  }, [issues, refreshIssues]);

  const assignIssue = useCallback(async (id: string, { assigneeId, dueDate, priority }: AssignOptions): Promise<void> => {
    try {
      const issue = issues.find((i) => i.id === id);
      if (!issue) return;
      const assignee = employeeMap.get(assigneeId);
      const movesToAssigned = issue.status === 'New' || issue.status === 'Triaged';
      const res = await bugTrackerApi.updateIssue(issue.key, {
        assigneeId,
        dueDate,
        priority: priority ?? issue.priority,
        status: movesToAssigned ? 'Assigned' : issue.status
      });
      if (res.issue) {
        setIssues((prev) => prev.map((i) => i.id === id ? res.issue! : i));
        notify([assignee?.id ?? assigneeId], 'Assigned to you', `${issue.key} ${issue.title}`, issue.key);
      } else {
        toast.error('Failed to assign issue. Please try again.');
      }
      await refreshIssues();
    } catch (err) {
      console.error('[bugTracker] assignIssue failed', err);
      throw err;
    }
  }, [issues, employeeMap, notify, refreshIssues]);

  const runTransition = useCallback(async (id: string, transitionId: TransitionId, note?: string): Promise<void> => {
    try {
      const target = issues.find((i) => i.id === id);
      if (!target) return;
      const t = getTransition(transitionId);
      const res = await bugTrackerApi.transitionIssue(target.key, transitionId, t.to, note);
      if (res.issue) {
        setIssues((prev) => prev.map((i) => i.id === id ? res.issue! : i));
      }
      await refreshIssues();
      const label = `${target.key} ${target.title}`;
      if (transitionId === 'submit-qa') notify(['emp-sneha', 'emp-vikram'], 'Ready for QA', label, target.key);
      if (transitionId === 'fail-qa' || transitionId === 'reopen') notify([target.assigneeId, target.reporterId], 'Issue reopened', label, target.key);
      if (transitionId === 'pass-qa') notify([target.reporterId, target.assigneeId], 'Fix verified', label, target.key);
    } catch (err) {
      console.error('[bugTracker] runTransition failed', err);
      throw err;
    }
  }, [issues, notify, refreshIssues]);

  const addComment = useCallback(async (id: string, body: string, kind: CommentKind): Promise<void> => {
    try {
      const issue = issues.find((i) => i.id === id);
      if (!issue) return;
      const res = await bugTrackerApi.addComment(issue.key, body, kind);
      if (res.comment) {
        setIssues((prev) => prev.map((i) => i.id === id ? ({
          ...i,
          updatedAt: nowIso(),
          comments: [...i.comments, res.comment as any]
        }) : i));
      }
      await refreshIssues();
    } catch (err) {
      console.error('[bugTracker] addComment failed', err);
    }
  }, [issues, refreshIssues]);

  const addAttachments = useCallback(async (id: string, attachments: Attachment[]): Promise<void> => {
    try {
      const issue = issues.find((i) => i.id === id);
      if (!issue) return;
      const res = await bugTrackerApi.addAttachments(issue.key, attachments);
      if (res.issue) {
        setIssues((prev) => prev.map((i) => i.id === id ? res.issue! : i));
      }
      await refreshIssues();
    } catch (err) {
      console.error('[bugTracker] addAttachments failed', err);
    }
  }, [issues, refreshIssues]);

  const deleteIssue = useCallback(async (key: string): Promise<void> => {
    try {
      await bugTrackerApi.deleteIssue(key);
      setIssues((prev) => prev.filter((i) => i.key !== key));
      await refreshIssues();
    } catch (err: any) {
      console.error('[bugTracker] deleteIssue failed', err);
      throw new Error(err.message || 'Failed to delete issue');
    }
  }, [refreshIssues]);

  const markNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n: AppNotification) => n.recipientId === currentUser.id ? { ...n, read: true } : n));
  }, [currentUser]);

  const resetPreviewData = useCallback(() => {
    // No-op in production integration; data comes from the API.
  }, []);

  const userNotifications = useMemo(() => notifications.filter((n) => n.recipientId === currentUser.id), [notifications, currentUser]);

  const value: BugTrackerContextValue = {
    issues,
    visibleIssues,
    scopedIssues,
    employees,
    projects,
    teams,
    role,
    setRole,
    currentUser,
    permissions,
    accessibleProjects,
    projectScope,
    setProjectScope,
    getEmployee,
    getProject,
    getIssueByKey,
    getIssue,
    notifications: userNotifications,
    markNotificationsRead,
    createIssue,
    updateIssue,
    assignIssue,
    runTransition,
    addComment,
    addAttachments,
    deleteIssue,
    resetPreviewData,
    loading
  };

  return <BugTrackerContext.Provider value={value}>{children}</BugTrackerContext.Provider>;
}

export function useBugTracker(): BugTrackerContextValue {
  const ctx = useContext(BugTrackerContext);
  if (!ctx) throw new Error('useBugTracker must be used inside BugTrackerProvider');
  return ctx;
}
