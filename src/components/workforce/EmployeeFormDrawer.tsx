import { useEffect, useState } from 'react';
import { useData } from '../../contexts/DataContext';
import { useMutation } from '../../hooks/useMutation';
import { useAccounts } from '../../hooks/useAccounts';
import type { Credentials, Employee } from '@shared/types';
import { uid } from '@shared/domain/random';
import { parseHM, toHM, todayKey } from '@shared/domain/time';
import { cmd } from '../../utils/commands';
import { Button } from '../ui/Button';
import { Field, Input, Select } from '../ui/Field';
import { DatePicker } from '../ui/DatePicker';
import { Drawer } from '../ui/Overlay';
import { Banner } from '../ui/Primitives';
import { CredentialsDialog } from './CredentialsDialog';
import { cn } from '../../utils/cn';

const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const schedules = ['General shift · 09:30–18:30', 'Early shift · 07:30–16:30', 'Late shift · 12:00–21:00', 'Flexible hours'];

export function blankEmployee(): Employee {
  return { id: uid('e'), code: '', name: '', email: '', phone: '', designation: '', teamId: '', joiningDate: todayKey(), managerId: '', status: 'Active', schedule: schedules[0], dailyTargetMinutes: 480, workingDays: [1, 2, 3, 4, 5] };
}

export function EmployeeFormDrawer({ employee, onClose, onSaved }: {employee: Employee | null;onClose: () => void;onSaved?: (e: Employee) => void;}) {
  const { state } = useData();
  const { mutateWithResult, pending, error, setError } = useMutation();
  const { accounts } = useAccounts(true);
  const [f, setF] = useState<Employee | null>(employee);
  const [target, setTarget] = useState('8:00');
  const [touched, setTouched] = useState(false);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [createdName, setCreatedName] = useState('');
  const [createdEmployee, setCreatedEmployee] = useState<Employee | null>(null);
  useEffect(() => {
    setF(employee);
    setTarget(toHM(employee?.dailyTargetMinutes ?? 480));
    setTouched(false);
    setError(null);
  }, [employee, setError]);
  if (!f) return <Drawer open={false} onClose={onClose} title=""><div /></Drawer>;
  const isNew = !state.employees.some((e) => e.id === f.id);
  const targetMin = parseHM(target);
  const errs: Record<string, string | undefined> = {
    name: !f.name.trim() ? 'Enter the full name.' : undefined,
    code: !f.code.trim() ? 'Enter an employee code.' : undefined,
    email: !/^\S+@\S+\.\S+$/.test(f.email) ? 'Enter a valid email.' : undefined,
    designation: !f.designation.trim() ? 'Enter a designation.' : undefined,
    teamId: !f.teamId ? 'Choose a team.' : undefined,
    joiningDate: !f.joiningDate ? 'Enter the joining date.' : undefined,
    target: targetMin === null || targetMin < 60 || targetMin > 720 ? 'Enter a target between 1:00 and 12:00.' : undefined,
    workingDays: !f.workingDays.length ? 'Select at least one working day.' : undefined
  };
  const show = (k: string) => touched ? errs[k] : undefined;
  const set = (patch: Partial<Employee>) => setF({ ...f, ...patch });
  const managers = [...accounts.filter((u) => u.role === 'management').map((u) => ({ id: u.id, name: `${u.name} (${u.title})` })), ...state.employees.filter((e) => e.id !== f.id && e.status === 'Active').map((e) => ({ id: e.id, name: e.name }))];

  const save = async () => {
    setTouched(true);
    if (Object.values(errs).some(Boolean)) return;
    const next = { ...f, name: f.name.trim(), code: f.code.trim(), email: f.email.trim(), dailyTargetMinutes: targetMin as number, phone: f.phone?.trim() || undefined, workingDays: f.workingDays.filter((d) => d !== 6) };
    const res = await mutateWithResult(cmd.saveEmployee(next), isNew ? 'Employee created' : 'Employee updated');
    if (!res.ok) return;
    if (res.credentials) {
      // Keep this drawer (and the page behind it) mounted until the password has been
      // acknowledged. The parent navigates to the new profile only after the dialog closes.
      setCreatedName(next.name);
      setCreatedEmployee(next);
      setCredentials(res.credentials);
      return;
    }
    onSaved?.(next);
    onClose();
  };

  return (
    <>
    <Drawer open onClose={onClose} title={isNew ? 'Add employee' : `Edit ${employee?.name}`} size="lg"
    footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={pending} onClick={save}>{isNew ? 'Create employee' : 'Save changes'}</Button></>}>
      <div className="space-y-6">
        <section className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" required error={show('name')}>{(id) => <Input id={id} value={f.name} onChange={(e) => set({ name: e.target.value })} invalid={!!show('name')} />}</Field>
          <Field label="Employee code" required error={show('code')}>{(id) => <Input id={id} value={f.code} onChange={(e) => set({ code: e.target.value })} placeholder="CN-1040" invalid={!!show('code')} />}</Field>
          <Field label="Work email" required error={show('email')}>{(id) => <Input id={id} type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} invalid={!!show('email')} />}</Field>
          <Field label="Phone" hint="Optional">{(id) => <Input id={id} value={f.phone ?? ''} onChange={(e) => set({ phone: e.target.value })} />}</Field>
          <Field label="Designation" required error={show('designation')}>{(id) => <Input id={id} value={f.designation} onChange={(e) => set({ designation: e.target.value })} invalid={!!show('designation')} />}</Field>
          <Field label="Team" required error={show('teamId')}>{(id) => <Select id={id} value={f.teamId} onChange={(e) => set({ teamId: e.target.value })} invalid={!!show('teamId')}><option value="">Select team</option>{state.teams.filter((t) => t.status === 'Active').map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>}</Field>
          <Field label="Joining date" required error={show('joiningDate')}>{(id) => <DatePicker id={id} value={f.joiningDate} onChange={(v) => set({ joiningDate: v })} invalid={!!show('joiningDate')} />}</Field>
          <Field label="Reporting manager">{(id) => <Select id={id} value={f.managerId ?? ''} onChange={(e) => set({ managerId: e.target.value })}><option value="">None</option>{managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select>}</Field>
        </section>

        <section className="border-t border-line pt-5">
          <h3 className="mb-3 text-sm font-semibold">Work schedule</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Schedule">{(id) => <Select id={id} value={f.schedule} onChange={(e) => set({ schedule: e.target.value })}>{schedules.map((s) => <option key={s}>{s}</option>)}</Select>}</Field>
            <Field label="Expected daily working hours" required hint="Company default is 8:00. Other values need an approved exception." error={show('target')}>
              {(id) => <Input id={id} value={target} onChange={(e) => setTarget(e.target.value)} className="tnum" invalid={!!show('target')} />}
            </Field>
          </div>
          {targetMin !== null && targetMin !== state.settings.dailyTargetMinutes && <Banner tone="warn" className="mt-3">This employee will have a {toHM(targetMin)} target instead of the company default. Make sure this exception is approved — the change is recorded in the audit log.</Banner>}
          <fieldset className="mt-4">
            <legend className="mb-2 text-sm font-medium">Working days</legend>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 0].map((d) => {
                const on = f.workingDays.includes(d);
                return (
                  <button key={d} type="button" aria-pressed={on} onClick={() => set({ workingDays: on ? f.workingDays.filter((x) => x !== d) : [...f.workingDays, d].sort() })}
                  className={cn('h-9 w-12 rounded-lg border text-sm font-medium transition-colors duration-150', on ? 'border-brand-600 bg-brand-700 text-white' : 'border-line-strong bg-white text-ink-2 hover:bg-canvas')}>
                    {dayLabels[d]}
                  </button>);

              })}
            </div>
            {show('workingDays') && <p className="mt-1 text-xs text-bad">{show('workingDays')}</p>}
            <p className="mt-2 text-xs text-ink-muted">Saturdays follow the company policy in Settings (currently the 1st and 3rd Saturday of the month).</p>
          </fieldset>
        </section>
        {isNew && <Banner tone="info">A sign-in account is created for this employee with a generated temporary password. Copy it from the dialog shown right after you save — it is never displayed again.</Banner>}
        {error && <Banner tone="bad" title="Not saved">{error}</Banner>}
      </div>
    </Drawer>
    <CredentialsDialog open={!!credentials} credentials={credentials} employeeName={createdName} onClose={() => {
      const created = createdEmployee;
      setCredentials(null);
      setCreatedEmployee(null);
      if (created) onSaved?.(created);
      onClose();
    }} />
    </>);

}