import { useEffect, useState } from 'react';
import { LockIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { useMutation } from '../../hooks/useMutation';
import type { LeaveTreatment, Settings } from '@shared/types';
import { cmd } from '../../utils/commands';
import { Button } from '../ui/Button';
import { Checkbox, Field, Input, Select, Textarea } from '../ui/Field';
import { Banner, Panel } from '../ui/Primitives';

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const treatments: {value: LeaveTreatment;label: string;}[] = [
{ value: 'not_configured', label: 'Not configured — flag payroll for review' },
{ value: 'paid', label: 'Paid — no salary impact' },
{ value: 'unpaid', label: 'Unpaid — counts as LOP' }];


export function LeaveSettingsForm() {
  const { user } = useAuth();
  const { state } = useData();
  const { mutate, pending, error } = useMutation();
  const canPay = !!user?.canManagePayroll;
  const [f, setF] = useState<Settings>(state.settings);
  const [allowance, setAllowance] = useState(state.settings.casualAllowance === null ? '' : String(state.settings.casualAllowance));
  useEffect(() => {setF(state.settings);setAllowance(state.settings.casualAllowance === null ? '' : String(state.settings.casualAllowance));}, [state.settings]);
  const allowanceErr = allowance && (Number.isNaN(Number(allowance)) || Number(allowance) < 0) ? 'Enter zero or a positive number, or leave blank.' : undefined;

  const save = () => {
    if (allowanceErr) return;
    const patch: Partial<Settings> = {
      casualAllowance: allowance === '' ? null : Number(allowance),
      emergencyRetrospective: f.emergencyRetrospective,
      leaveYearStartMonth: f.leaveYearStartMonth,
      carryForward: f.carryForward,
      cancellationPolicy: f.cancellationPolicy,
      leaveApprover: f.leaveApprover,
      attachmentsEnabled: f.attachmentsEnabled,
      ...(canPay ? { casualTreatment: f.casualTreatment, emergencyTreatment: f.emergencyTreatment } : {})
    };
    mutate(cmd.updateSettings(patch, 'Leave policy'), 'Leave policy saved');
  };

  return (
    <div className="space-y-6">
      <Panel title="Notice & requests">
        <div className="space-y-4">
          <div className="rounded-lg border border-line bg-canvas p-4">
            <p className="text-sm font-medium">Casual Leave advance notice: {f.casualAdvanceDays} calendar days</p>
            <p className="mt-0.5 text-xs text-ink-muted">Mandatory company rule, enforced from the actual submission date in {f.timezone}. Requests that are too early are blocked and show the earliest eligible date. Casual Leave is never converted to Emergency Leave automatically.</p>
          </div>
          <Checkbox label="Allow past-dated (retrospective) Emergency Leave" description="Requires a reason and is flagged for management review. Never auto-approved." checked={f.emergencyRetrospective} onChange={(v) => setF({ ...f, emergencyRetrospective: v })} />
          <Checkbox label="Allow attachments on leave requests" checked={f.attachmentsEnabled} onChange={(v) => setF({ ...f, attachmentsEnabled: v })} />
          <Field label="Approval authority">{(id) => <Select id={id} value={f.leaveApprover} onChange={(e) => setF({ ...f, leaveApprover: e.target.value })}><option>Any management user</option><option>Reporting manager, then HR</option><option>HR & Payroll only</option></Select>}</Field>
        </div>
      </Panel>
      <Panel title="Allowances & balances">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Casual Leave allowance (days per leave year)" hint="Leave blank if not yet decided — no balance will be shown." error={allowanceErr}>{(id) => <Input id={id} type="number" min={0} value={allowance} onChange={(e) => setAllowance(e.target.value)} placeholder="Not configured" invalid={!!allowanceErr} />}</Field>
          <Field label="Leave year starts in">{(id) => <Select id={id} value={f.leaveYearStartMonth} onChange={(e) => setF({ ...f, leaveYearStartMonth: Number(e.target.value) })}>{months.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</Select>}</Field>
          <Field label="Carry-forward rule" className="sm:col-span-2">{(id) => <Input id={id} value={f.carryForward} onChange={(e) => setF({ ...f, carryForward: e.target.value })} />}</Field>
          <Field label="Cancellation policy" className="sm:col-span-2">{(id) => <Textarea id={id} value={f.cancellationPolicy} onChange={(e) => setF({ ...f, cancellationPolicy: e.target.value })} />}</Field>
        </div>
        <p className="mt-4 text-xs text-ink-muted">Balance deductions: only approved Casual Leave reduces the configured allowance. Leave duration counts scheduled working days ({f.workingDays.filter((d) => d !== 6).map((d) => dayNames[d].slice(0, 3)).join(', ')}, plus the company working Saturdays) and excludes non-working days and published holidays.</p>
      </Panel>
      <Panel title={<span className="flex items-center gap-2">Paid / unpaid treatment {!canPay && <LockIcon className="h-3.5 w-3.5 text-ink-muted" />}</span>} description="Determines whether approved leave creates Loss of Pay in payroll. Pending leave never affects payroll.">
        {!canPay && <Banner tone="neutral" className="mb-4">Only payroll managers can change payroll-impacting leave rules.</Banner>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Casual Leave">{(id) => <Select id={id} disabled={!canPay} value={f.casualTreatment} onChange={(e) => setF({ ...f, casualTreatment: e.target.value as LeaveTreatment })}>{treatments.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select>}</Field>
          <Field label="Emergency Leave">{(id) => <Select id={id} disabled={!canPay} value={f.emergencyTreatment} onChange={(e) => setF({ ...f, emergencyTreatment: e.target.value as LeaveTreatment })}>{treatments.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select>}</Field>
        </div>
      </Panel>
      {error && <Banner tone="bad" title="Not saved">{error}</Banner>}
      <div className="flex justify-end"><Button loading={pending} onClick={save}>Save leave policy</Button></div>
    </div>);

}