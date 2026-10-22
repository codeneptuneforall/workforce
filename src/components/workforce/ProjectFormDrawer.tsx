import { useEffect, useState } from 'react';
import { useData } from '../../contexts/DataContext';
import { useMutation } from '../../hooks/useMutation';
import type { Project, ProjectStatus } from '@shared/types';
import { uid } from '@shared/domain/random';
import { LEARNING_PROJECT_ID } from '@shared/domain/learning';
import { cmd } from '../../utils/commands';
import { todayKey } from '@shared/domain/time';
import { Button } from '../ui/Button';
import { Checkbox, Field, Input, Select, Textarea } from '../ui/Field';
import { DatePicker } from '../ui/DatePicker';
import { Drawer } from '../ui/Overlay';
import { Banner } from '../ui/Primitives';

export const projectStatuses: ProjectStatus[] = ['Planned', 'Active', 'On Hold', 'Completed', 'Archived'];
export const blankProject = (): Project => ({ id: uid('p'), name: '', code: '', description: '', client: '', managerId: '', teamIds: [], employeeIds: [], startDate: todayKey(), endDate: '', status: 'Planned', availableToAll: true, kind: 'Work', notes: '' });

export function ProjectFormDrawer({ project, onClose }: {project: Project | null;onClose: () => void;}) {
  const { state } = useData();
  const { mutate, pending, error, setError } = useMutation();
  const [f, setF] = useState<Project | null>(project);
  const [est, setEst] = useState('');
  const [touched, setTouched] = useState(false);
  useEffect(() => {setF(project);setEst(project?.estimatedHours ? String(project.estimatedHours) : '');setTouched(false);setError(null);}, [project, setError]);
  if (!f) return <Drawer open={false} onClose={onClose} title=""><div /></Drawer>;
  const isNew = !state.projects.some((p) => p.id === f.id);
  const errs: Record<string, string | undefined> = {
    name: !f.name.trim() ? 'Enter a project name.' : undefined,
    code: !f.code.trim() ? 'Enter a project code.' : undefined,
    managerId: !f.managerId ? 'Choose a project manager.' : undefined,
    endDate: !f.endDate ? 'Enter a target end date.' : f.endDate < f.startDate ? 'End date must be after the start date.' : undefined,
    est: est && (Number.isNaN(Number(est)) || Number(est) < 0) ? 'Enter a positive number.' : undefined
  };
  const show = (k: string) => touched ? errs[k] : undefined;
  const toggle = (key: 'teamIds' | 'employeeIds', id: string, on: boolean) => setF({ ...f, [key]: on ? [...f[key], id] : f[key].filter((x) => x !== id) });
  const isLearning = f.id === LEARNING_PROJECT_ID;
  const save = async () => {
    setTouched(true);
    if (Object.values(errs).some(Boolean)) return;
    const next: Project = { ...f, name: f.name.trim(), code: f.code.trim().toUpperCase(), client: f.client?.trim() || undefined, estimatedHours: est ? Number(est) : undefined, availableToAll: isLearning ? true : f.availableToAll !== false };
    if (await mutate(cmd.saveProject(next), isNew ? 'Project created' : 'Project updated')) onClose();
  };
  return (
    <Drawer open onClose={onClose} size="lg" title={isNew ? 'Create project' : `Edit ${project?.name}`}
    footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={pending} onClick={save}>{isNew ? 'Create project' : 'Save changes'}</Button></>}>
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Project name" required error={show('name')}>{(id) => <Input id={id} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} invalid={!!show('name')} />}</Field>
          <Field label="Project code" required error={show('code')}>{(id) => <Input id={id} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="NHR" invalid={!!show('code')} />}</Field>
        </div>
        <Field label="Description">{(id) => <Textarea id={id} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />}</Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Client" hint="Optional">{(id) => <Input id={id} value={f.client ?? ''} onChange={(e) => setF({ ...f, client: e.target.value })} />}</Field>
          <Field label="Project manager" required error={show('managerId')}>{(id) => <Select id={id} value={f.managerId} onChange={(e) => setF({ ...f, managerId: e.target.value })} invalid={!!show('managerId')}><option value="">Select manager</option>{state.employees.filter((e) => e.status === 'Active').map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</Select>}</Field>
          <Field label="Start date" required>{(id) => <DatePicker id={id} value={f.startDate} onChange={(v) => setF({ ...f, startDate: v })} />}</Field>
          <Field label="Target end date" required error={show('endDate')}>{(id) => <DatePicker id={id} value={f.endDate} min={f.startDate || undefined} onChange={(v) => setF({ ...f, endDate: v })} invalid={!!show('endDate')} />}</Field>
          <Field label="Estimated hours" hint="Optional" error={show('est')}>{(id) => <Input id={id} type="number" min={0} value={est} onChange={(e) => setEst(e.target.value)} invalid={!!show('est')} />}</Field>
          <Field label="Status">{(id) => <Select id={id} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as ProjectStatus })}>{projectStatuses.map((s) => <option key={s}>{s}</option>)}</Select>}</Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <fieldset><legend className="mb-2 text-sm font-medium">Assigned teams</legend><div className="space-y-2 rounded-lg border border-line p-3">{state.teams.map((t) => <Checkbox key={t.id} label={t.name} checked={f.teamIds.includes(t.id)} onChange={(v) => toggle('teamIds', t.id, v)} />)}</div></fieldset>
          <fieldset><legend className="mb-2 text-sm font-medium">Assigned employees</legend><div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-line p-3">{state.employees.filter((e) => e.status === 'Active').map((e) => <Checkbox key={e.id} label={e.name} checked={f.employeeIds.includes(e.id)} onChange={(v) => toggle('employeeIds', e.id, v)} />)}</div></fieldset>
        </div>
        <div className="rounded-lg border border-line p-3">
          <p className="text-sm font-medium">{isLearning ? 'System learning project' : 'Open to the whole company'}</p>
          <p className="mt-1 text-xs text-ink-muted">
            {isLearning ?
            'This is the system learning project — it stays open to the whole company and is always available for learning time.' :
            'Every employee can see this project and record time on it. The assigned teams and employees above mark who is working on it.'}
          </p>
        </div>
        <Field label="Notes">{(id) => <Textarea id={id} value={f.notes ?? ''} onChange={(e) => setF({ ...f, notes: e.target.value })} />}</Field>
        {error && <Banner tone="bad" title="Not saved">{error}</Banner>}
      </div>
    </Drawer>);

}