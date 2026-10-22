import type { AppState, Employee, Holiday, Project, ProjectStatus, SalaryStructure, Settings, Task, TaskStatus, Team } from '../types';
import { LEARNING_PROJECT_ID } from './learning';
import { uid } from './random';
import { fail, withAudit, withNotification } from './stateHelpers';
import type { Mutation } from './stateHelpers';
import { fmtDate } from './time';

export function saveEmployee(s: AppState, emp: Employee, actor: string, now: number): Mutation {
  const isNew = !s.employees.some((e) => e.id === emp.id);
  if (s.employees.some((e) => e.id !== emp.id && e.code.toLowerCase() === emp.code.toLowerCase())) return fail('Employee code is already in use.');
  if (s.employees.some((e) => e.id !== emp.id && e.email.toLowerCase() === emp.email.toLowerCase())) return fail('Email is already used by another employee.');
  const prev = s.employees.find((e) => e.id === emp.id);
  const employees = isNew ? [...s.employees, emp] : s.employees.map((e) => e.id === emp.id ? emp : e);
  const changed = prev ?
  (Object.keys(emp) as (keyof Employee)[]).filter((k) => JSON.stringify(prev[k]) !== JSON.stringify(emp[k])).join(', ') :
  undefined;
  return withAudit({ ...s, employees }, now, {
    actor,
    action: isNew ? 'Employee created' : 'Employee updated',
    entity: 'Employee',
    entityId: `${emp.name} (${emp.code})`,
    previous: changed ? `Changed: ${changed}` : undefined,
    next: isNew ? `${emp.designation} · target ${emp.dailyTargetMinutes / 60}h` : undefined
  });
}

export function setEmployeeStatus(s: AppState, id: string, status: Employee['status'], reason: string, actor: string, now: number): Mutation {
  const emp = s.employees.find((e) => e.id === id);
  if (!emp) return fail('Employee not found.');
  if (!reason.trim()) return fail('Add a reason for this change.');
  if (status === 'Inactive' && s.sessions.some((x) => x.employeeId === id && x.status === 'Working'))
  return fail('This employee has a running timer. Ask them to end it before deactivating.');
  return withAudit({ ...s, employees: s.employees.map((e) => e.id === id ? { ...e, status } : e) }, now, {
    actor, action: status === 'Active' ? 'Employee activated' : 'Employee deactivated', entity: 'Employee', entityId: `${emp.name} (${emp.code})`, previous: emp.status, next: status, reason: reason.trim()
  });
}

export function saveTeam(s: AppState, team: Team, memberIds: string[], actor: string, now: number): Mutation {
  if (s.teams.some((t) => t.id !== team.id && t.name.toLowerCase() === team.name.toLowerCase())) return fail('A team with this name already exists.');
  const isNew = !s.teams.some((t) => t.id === team.id);
  const teams = isNew ? [...s.teams, team] : s.teams.map((t) => t.id === team.id ? team : t);
  const employees = s.employees.map((e) => memberIds.includes(e.id) ? { ...e, teamId: team.id } : e);
  return withAudit({ ...s, teams, employees }, now, { actor, action: isNew ? 'Team created' : 'Team updated', entity: 'Team', entityId: team.name, next: `${memberIds.length} member(s) · ${team.status}` });
}

export function saveProject(s: AppState, p: Project, actor: string, now: number): Mutation {
  if (s.projects.some((x) => x.id !== p.id && x.code.toLowerCase() === p.code.toLowerCase())) return fail('Project code is already in use.');
  const prev = s.projects.find((x) => x.id === p.id);
  // The system learning project always stays open to the whole company.
  const project: Project = p.id === LEARNING_PROJECT_ID ?
    { ...p, kind: 'Learning', availableToAll: true } :
    p;
  const projects = prev ? s.projects.map((x) => x.id === p.id ? project : x) : [...s.projects, project];
  return withAudit({ ...s, projects }, now, { actor, action: prev ? 'Project updated' : 'Project created', entity: 'Project', entityId: `${p.name} (${p.code})`, previous: prev?.status, next: project.status });
}

export function setProjectStatus(s: AppState, id: string, status: ProjectStatus, actor: string, now: number): Mutation {
  const p = s.projects.find((x) => x.id === id);
  if (!p) return fail('Project not found.');
  if (id === LEARNING_PROJECT_ID)
  return fail('The learning project is a system project and stays available to every employee.');
  if (status === 'Archived' && s.sessions.some((x) => x.projectId === id && (x.status === 'Working' || x.status === 'Paused')))
  return fail('Someone is tracking time on this project. Ask them to end their session before archiving.');
  return withAudit({ ...s, projects: s.projects.map((x) => x.id === id ? { ...x, status } : x) }, now, {
    actor, action: status === 'Archived' ? 'Project archived' : 'Project status changed', entity: 'Project', entityId: `${p.name} (${p.code})`, previous: p.status, next: status, reason: status === 'Archived' ? 'Historical time records preserved.' : undefined
  });
}

export function saveTask(s: AppState, t: Task, actor: string, now: number): Mutation {
  const prev = s.tasks.find((x) => x.id === t.id);
  // Learning tasks are shared with everyone, so they never carry an owner.
  const task: Task = t.kind === 'Learning' ? { ...t, assigneeId: undefined, teamId: undefined } : t;
  const tasks = prev ? s.tasks.map((x) => x.id === t.id ? task : x) : [...s.tasks, task];
  let next: AppState = { ...s, tasks };
  if (!prev && task.assigneeId)
  next = withNotification(next, now, { audience: task.assigneeId, title: 'New task assigned', body: `You were assigned “${task.title}”.`, link: '/employee/projects', tone: 'info' });
  return withAudit(next, now, { actor, action: prev ? 'Task updated' : 'Task created', entity: 'Task', entityId: task.title, previous: prev?.status, next: task.status });
}

export function setTaskStatus(s: AppState, id: string, status: TaskStatus, actor: string, now: number): Mutation {
  const t = s.tasks.find((x) => x.id === id);
  if (!t) return fail('Task not found.');
  return withAudit({ ...s, tasks: s.tasks.map((x) => x.id === id ? { ...x, status } : x) }, now, { actor, action: 'Task status changed', entity: 'Task', entityId: t.title, previous: t.status, next: status });
}

export function saveHoliday(s: AppState, h: Holiday, actor: string, now: number): Mutation {
  if (!h.name.trim() || !h.date) return fail('Name and date are required.');
  const prev = s.holidays.find((x) => x.id === h.id);
  const holidays = prev ? s.holidays.map((x) => x.id === h.id ? h : x) : [...s.holidays, h];
  let next: AppState = { ...s, holidays };
  if (h.status === 'Published')
  for (const e of s.employees.filter((x) => x.status === 'Active'))
  next = withNotification(next, now, { audience: e.id, title: 'Holiday calendar updated', body: `${h.name} on ${fmtDate(h.date, 'EEE, d MMM yyyy')} (${h.type}).`, link: '/employee/holidays', tone: 'info' });
  return withAudit(next, now, { actor, action: prev ? 'Holiday updated' : 'Holiday added', entity: 'Holiday', entityId: `${h.name} · ${fmtDate(h.date)}`, previous: prev ? `${prev.name} · ${prev.date} · ${prev.status}` : undefined, next: `${h.name} · ${h.date} · ${h.status}` });
}

export function deleteHoliday(s: AppState, id: string, actor: string, now: number): Mutation {
  const h = s.holidays.find((x) => x.id === id);
  if (!h) return fail('Holiday not found.');
  return withAudit({ ...s, holidays: s.holidays.filter((x) => x.id !== id) }, now, { actor, action: 'Holiday deleted', entity: 'Holiday', entityId: `${h.name} · ${fmtDate(h.date)}`, previous: h.status });
}

export function copyHolidayYear(s: AppState, from: number, to: number, actor: string, now: number): Mutation {
  const source = s.holidays.filter((h) => h.date.startsWith(String(from)));
  if (!source.length) return fail(`No holidays found for ${from}.`);
  const existing = new Set(s.holidays.filter((h) => h.date.startsWith(String(to))).map((h) => h.name));
  const copies: Holiday[] = source.
  filter((h) => !existing.has(h.name)).
  map((h) => ({ ...h, id: uid('h'), date: `${to}${h.date.slice(4)}`, status: 'Draft', description: 'Copied as draft — verify the official date before publishing.' }));
  if (!copies.length) return fail(`All ${from} holidays already exist in ${to}.`);
  return withAudit({ ...s, holidays: [...s.holidays, ...copies] }, now, { actor, action: 'Holiday year copied as draft', entity: 'Holiday calendar', entityId: String(to), next: `${copies.length} draft holiday(s)` });
}

export function publishHolidayYear(s: AppState, year: number, actor: string, now: number): Mutation {
  const drafts = s.holidays.filter((h) => h.date.startsWith(String(year)) && h.status === 'Draft');
  if (!drafts.length) return fail('No draft holidays to publish.');
  return withAudit({ ...s, holidays: s.holidays.map((h) => drafts.includes(h) ? { ...h, status: 'Published', description: h.description?.startsWith('Copied') ? undefined : h.description } : h) }, now, {
    actor, action: 'Holiday calendar published', entity: 'Holiday calendar', entityId: String(year), next: `${drafts.length} holiday(s) published`, reason: 'Dates verified by management.'
  });
}

export function updateSettings(s: AppState, patch: Partial<Settings>, section: string, actor: string, now: number): Mutation {
  const changed = (Object.keys(patch) as (keyof Settings)[]).filter((k) => JSON.stringify(s.settings[k]) !== JSON.stringify(patch[k]));
  if (!changed.length) return fail('No changes to save.');
  const prevVals = changed.map((k) => `${k}: ${JSON.stringify(s.settings[k])}`).join('; ');
  const nextVals = changed.map((k) => `${k}: ${JSON.stringify(patch[k])}`).join('; ');
  return withAudit({ ...s, settings: { ...s.settings, ...patch } }, now, { actor, action: `${section} settings updated`, entity: 'Settings', entityId: section, previous: prevVals, next: nextVals });
}

export function saveSalary(s: AppState, ss: SalaryStructure, reason: string, actor: string, now: number): Mutation {
  if (!reason.trim()) return fail('A reason is required for salary structure changes.');
  const values = [...Object.values(ss.earnings), ...Object.values(ss.deductions), ss.employerContribution, ss.ctcAnnual];
  if (values.some((v) => Number.isNaN(v) || v < 0)) return fail('Amounts must be zero or positive numbers.');
  const prev = s.salary.find((x) => x.employeeId === ss.employeeId);
  const salary = prev ? s.salary.map((x) => x.employeeId === ss.employeeId ? ss : x) : [...s.salary, ss];
  const emp = s.employees.find((e) => e.id === ss.employeeId);
  return withAudit({ ...s, salary }, now, {
    actor, action: 'Salary structure updated', entity: 'Salary structure', entityId: `${emp?.name} (${emp?.code})`,
    previous: prev ? `Effective ${prev.effectiveFrom} · CTC ${prev.ctcAnnual}` : 'None', next: `Effective ${ss.effectiveFrom} · CTC ${ss.ctcAnnual}`, reason: reason.trim()
  });
}