import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LockIcon } from 'lucide-react';
import { LeaveSettingsForm } from '../../components/settings/LeaveSettingsForm';
import { Button } from '../../components/ui/Button';
import { Checkbox, Field, Input, Select, Textarea } from '../../components/ui/Field';
import { Banner, PageHeader, Panel, Tabs } from '../../components/ui/Primitives';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { useMutation } from '../../hooks/useMutation';
import type { DeductionMethod, PayrollBasis, Settings } from '@shared/types';
import { cmd } from '../../utils/commands';
import { fmtDateTime, parseHM, toHM } from '@shared/domain/time';

type Tab = 'company' | 'hours' | 'deductions' | 'leave' | 'payroll';
const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function SettingsPage() {
  const { user } = useAuth();
  const { state } = useData();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') as Tab || 'company';
  const { mutate, pending, error } = useMutation();
  const canPay = !!user?.canManagePayroll;
  const [f, setF] = useState<Settings>(state.settings);
  const [target, setTarget] = useState(toHM(state.settings.dailyTargetMinutes));
  const [ack, setAck] = useState(false);
  const [touched, setTouched] = useState(false);
  useEffect(() => {setF(state.settings);setTarget(toHM(state.settings.dailyTargetMinutes));setAck(false);setTouched(false);}, [state.settings, tab]);

  const save = (section: string, patch: Partial<Settings>) => mutate(cmd.updateSettings(patch, section), `${section} saved`);
  const saturdays = [...(f.workingSaturdays ?? [1, 3])].sort();
  const targetMin = parseHM(target);
  const targetErr = targetMin === null || targetMin < 60 || targetMin > 720 ? 'Enter a target between 1:00 and 12:00.' : undefined;
  const methodNeedsBasis = f.deductionMethod === 'monthly_proration';
  const deductionErr = f.deductionEnabled && f.deductionMethod === 'not_configured' ? 'Select an approved method before enabling deductions.' : methodNeedsBasis && f.payrollBasis === 'not_configured' ? 'Select the approved payroll basis.' : f.payrollBasis === 'fixed_days' && methodNeedsBasis && !f.fixedBasisDays ? 'Enter the fixed number of days.' : undefined;

  return (
    <div>
      <PageHeader title="Settings" description="Company policies. Nothing payroll-impacting is assumed — every rule applies only once configured here, and every change is audited." />
      <div className="mb-6">
        <Tabs<Tab> value={tab} onChange={(v) => setParams({ tab: v })} tabs={[{ id: 'company', label: 'Company' }, { id: 'hours', label: 'Working hours' }, { id: 'deductions', label: 'Shortfall deductions' }, { id: 'leave', label: 'Leave policy' }, { id: 'payroll', label: 'Payroll' }]} />
      </div>
      <div className="max-w-3xl space-y-6">
        {error && <Banner tone="bad" title="Not saved">{error}</Banner>}

        {tab === 'company' &&
        <Panel title="Company details" description="Shown on payslips and throughout the app.">
            <div className="space-y-4">
              <Field label="Company name" required>{(id) => <Input id={id} value={f.companyName} onChange={(e) => setF({ ...f, companyName: e.target.value })} />}</Field>
              <Field label="Address">{(id) => <Textarea id={id} value={f.companyAddress} onChange={(e) => setF({ ...f, companyAddress: e.target.value })} />}</Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Currency">{(id) => <Input id={id} value={f.currency} readOnly />}</Field>
                <Field label="Time zone" hint="Used for day boundaries and leave notice.">{(id) => <Input id={id} value={f.timezone} readOnly />}</Field>
              </div>
              <Field label="Payslip confidentiality note" hint="Use company-approved wording only.">{(id) => <Textarea id={id} value={f.confidentialityNote} onChange={(e) => setF({ ...f, confidentialityNote: e.target.value })} />}</Field>
              <p className="text-xs text-ink-muted">Company logo uploads are not available; the Code Neptune mark is used.</p>
              <div className="flex justify-end"><Button loading={pending} disabled={!f.companyName.trim()} onClick={() => save('Company settings', { companyName: f.companyName.trim(), companyAddress: f.companyAddress, confidentialityNote: f.confidentialityNote })}>Save company details</Button></div>
            </div>
          </Panel>
        }

        {tab === 'hours' &&
        <Panel title="Working-hour policy">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Default daily target" required hint="Company rule: 8:00. Employee exceptions are set on their profile." error={targetErr}>{(id) => <Input id={id} value={target} onChange={(e) => setTarget(e.target.value)} className="tnum" invalid={!!targetErr} />}</Field>
                <Field label="Day ends at" hint="Shortfalls become final only after this time. Use 23:59 for a fully flexible day.">{(id) => <Input id={id} type="time" value={f.dayEndTime} onChange={(e) => setF({ ...f, dayEndTime: e.target.value })} />}</Field>
                <Field label="Approaching-target warning (minutes remaining)">{(id) => <Input id={id} type="number" min={0} value={f.approachingWarningMinutes} onChange={(e) => setF({ ...f, approachingWarningMinutes: Number(e.target.value) || 0 })} />}</Field>
                <Field label="No time recorded on a working day">{(id) => <Select id={id} value={f.absentPolicy} onChange={(e) => setF({ ...f, absentPolicy: e.target.value as Settings['absentPolicy'] })}><option value="not_recorded">Show as Not Recorded (review)</option><option value="mark_absent">Mark as Absent</option></Select>}</Field>
              </div>
              <fieldset>
                <legend className="mb-2 text-sm font-medium">Company working days</legend>
                <div className="flex flex-wrap gap-3">{[1, 2, 3, 4, 5, 0].map((d) => <Checkbox key={d} label={dayNames[d]} checked={f.workingDays.includes(d)} onChange={(v) => setF({ ...f, workingDays: v ? [...f.workingDays.filter((x) => x !== 6), d].sort() : f.workingDays.filter((x) => x !== d) })} />)}</div>
                <p className="mt-2 text-xs text-ink-muted">Saturdays are configured separately below, so they are not part of this list.</p>
              </fieldset>
              <fieldset>
                <legend className="mb-2 text-sm font-medium">Working Saturdays</legend>
                <div className="flex flex-wrap gap-3">{[1, 2, 3, 4, 5].map((n) => <Checkbox key={n} label={`${n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`} Saturday`} checked={saturdays.includes(n)} onChange={(v) => setF({ ...f, workingSaturdays: v ? [...saturdays, n].sort() : saturdays.filter((x) => x !== n) })} />)}</div>
                <p className="mt-2 text-xs text-ink-muted">Company-wide: this applies to every employee. Unchecked Saturdays are non-working days. The current policy is the 1st and 3rd Saturday.</p>
              </fieldset>
              <Checkbox label="Require project and task before starting a timer" checked={f.requireTask} onChange={(v) => setF({ ...f, requireTask: v })} />
              <Checkbox label="Allow a general work category" checked={f.generalCategory} onChange={(v) => setF({ ...f, generalCategory: v })} />
              <Checkbox label="Allow overlapping active timers" description="Not recommended — overlapping time is never double-counted." checked={f.allowOverlap} onChange={(v) => setF({ ...f, allowOverlap: v })} />
              <Checkbox label="Timesheets require management approval" checked={f.timesheetApprovalRequired} onChange={(v) => setF({ ...f, timesheetApprovalRequired: v })} />
              <Field label="Correction-request policy">{(id) => <Textarea id={id} value={f.correctionPolicy} onChange={(e) => setF({ ...f, correctionPolicy: e.target.value })} />}</Field>
              <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-900">
                Working hours are flexible: employees may start and stop their timers at any time of the day. By the end of the day each employee must have completed the daily target — {toHM(state.settings.dailyTargetMinutes)} — or the shortfall is sent for management review.
              </p>
              <div className="flex justify-end"><Button loading={pending} disabled={!!targetErr || !f.workingDays.filter((d) => d !== 6).length} onClick={() => save('Working-hour policy', { dailyTargetMinutes: targetMin as number, dayEndTime: f.dayEndTime, approachingWarningMinutes: f.approachingWarningMinutes, absentPolicy: f.absentPolicy, workingDays: f.workingDays.filter((d) => d !== 6), workingSaturdays: saturdays, requireTask: f.requireTask, generalCategory: f.generalCategory, allowOverlap: f.allowOverlap, timesheetApprovalRequired: f.timesheetApprovalRequired, correctionPolicy: f.correctionPolicy })}>Save working-hour policy</Button></div>
            </div>
          </Panel>
        }

        {tab === 'deductions' && (!canPay ?
        <Banner tone="neutral" title="Restricted"><span className="flex items-center gap-1.5"><LockIcon className="h-3.5 w-3.5" /> Only payroll managers can configure shortfall deductions.</span></Banner> :

        <Panel title="Shortfall deduction policy" description="Shortfalls are always calculated. Amounts are proposed only with an approved method, and applied only after management review.">
            <div className="space-y-4">
              {state.settings.policyApprovedBy && <Banner tone="info">Current policy approved by {state.settings.policyApprovedBy}{state.settings.policyApprovedAt && ` on ${fmtDateTime(state.settings.policyApprovedAt)}`}.</Banner>}
              <Checkbox label="Enable payroll deductions for unapproved shortfalls" checked={f.deductionEnabled} onChange={(v) => setF({ ...f, deductionEnabled: v })} />
              <Field label="Approved calculation method" error={touched ? deductionErr : undefined}>{(id) =>
              <Select id={id} value={f.deductionMethod} onChange={(e) => setF({ ...f, deductionMethod: e.target.value as DeductionMethod })}>
                  <option value="not_configured">Not configured</option>
                  <option value="daily_amount">Daily payable amount ÷ daily target × shortfall hours</option>
                  <option value="monthly_proration">Monthly salary ÷ payroll basis ÷ daily target × shortfall hours</option>
                  <option value="manual">Manually entered amount, approved per day</option>
                </Select>
              }</Field>
              {methodNeedsBasis &&
            <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Payroll basis">{(id) => <Select id={id} value={f.payrollBasis} onChange={(e) => setF({ ...f, payrollBasis: e.target.value as PayrollBasis })}><option value="not_configured">Not configured</option><option value="calendar_days">Calendar days in month</option><option value="scheduled_working_days">Scheduled working days</option><option value="fixed_days">Fixed number of days</option></Select>}</Field>
                  {f.payrollBasis === 'fixed_days' && <Field label="Fixed days">{(id) => <Input id={id} type="number" min={1} value={f.fixedBasisDays ?? ''} onChange={(e) => setF({ ...f, fixedBasisDays: e.target.value ? Number(e.target.value) : null })} />}</Field>}
                </div>
            }
              {f.deductionMethod === 'daily_amount' && <p className="text-xs text-ink-muted">Uses each employee’s configured daily payable amount from their salary structure. Employees without one are flagged Needs Review.</p>}
              <Field label="Rounding">{(id) => <Select id={id} value={f.rounding} onChange={(e) => setF({ ...f, rounding: e.target.value as Settings['rounding'] })}><option value="nearest_rupee">Nearest rupee</option><option value="two_decimals">Two decimals</option></Select>}</Field>
              <Checkbox label="Show shortfall deduction amounts to employees on their dashboard" checked={f.showDeductionToEmployee} onChange={(v) => setF({ ...f, showDeductionToEmployee: v })} />
              <Checkbox label="I confirm this method is approved by company management and has been checked against applicable legal requirements" checked={ack} onChange={setAck} />
              {touched && !ack && <p className="text-xs text-bad">Confirmation is required.</p>}
              <div className="flex justify-end"><Button loading={pending} onClick={() => {
                setTouched(true);
                if (deductionErr || !ack) return;
                save('Shortfall deduction policy', { deductionEnabled: f.deductionEnabled, deductionMethod: f.deductionMethod, payrollBasis: f.payrollBasis, fixedBasisDays: f.fixedBasisDays, rounding: f.rounding, showDeductionToEmployee: f.showDeductionToEmployee, policyApprovedBy: user?.name, policyApprovedAt: new Date().toISOString() });
              }}>Save deduction policy</Button></div>
            </div>
          </Panel>)
        }

        {tab === 'leave' && <LeaveSettingsForm />}

        {tab === 'payroll' &&
        <>
            <Panel title="Payroll policy">
              <div className="space-y-4">
                <Checkbox label="Require salary credit confirmation before payslips are generated or released" description="Turning this off is an authorised exception and is recorded in the audit log." checked={f.releaseRequiresCredit} onChange={(v) => setF({ ...f, releaseRequiresCredit: v })} />
                <p className="text-xs text-ink-muted">Salary components, statutory deductions and effective dates are configured per employee under Payroll → Salary structures. No statutory rates are built in.</p>
                <div className="flex justify-end"><Button loading={pending} disabled={!canPay} onClick={() => save('Payroll policy', { releaseRequiresCredit: f.releaseRequiresCredit })}>Save payroll policy</Button></div>
              </div>
            </Panel>

          </>
        }
      </div>
    </div>);

}