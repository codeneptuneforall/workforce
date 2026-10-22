import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LockIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { useMutation } from '../../hooks/useMutation';
import type { AdjustmentCategory, ReviewStatus } from '@shared/types';
import type { DayCompliance } from '@shared/domain/compliance';
import { cn } from '../../utils/cn';
import { fmtINR } from '@shared/domain/currency';
import { proposeShortfallDeduction } from '@shared/domain/payroll';
import { fmtDate, fmtDateTime, fmtMin, parseHM, toHM } from '@shared/domain/time';
import { cmd } from '../../utils/commands';
import { DayBreakdown } from '../shared/DayBreakdown';
import { StatusBadge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Field, Input, Select, Textarea } from '../ui/Field';
import { Drawer } from '../ui/Overlay';
import { Banner } from '../ui/Primitives';

const outcomes: {value: ReviewStatus;label: string;body: string;payroll: boolean;category?: AdjustmentCategory;}[] = [
{ value: 'Confirmed', label: 'Confirm shortfall for payroll', body: 'The recorded shortfall stands. Enter the final approved deduction.', payroll: true },
{ value: 'Correction Requested', label: 'Request a time-log correction', body: 'Ask the employee to fix or explain their records. Stays pending.', payroll: false },
{ value: 'Approved Exception', label: 'Mark as approved exception', body: 'Policy permits this day to be excused. No deduction.', payroll: true, category: 'Approved exception' },
{ value: 'Adjusted', label: 'Adjust payable hours', body: 'Set the hours that should count as payable. Original records stay unchanged.', payroll: true, category: 'Incorrect/missing time log' },
{ value: 'Waived', label: 'Waive the deduction', body: 'Shortfall is acknowledged but no deduction applies.', payroll: true, category: 'Management-approved waiver' }];

const categories: AdjustmentCategory[] = ['Approved exception', 'Incorrect/missing time log', 'Management-approved waiver', 'Approved schedule change', 'Other'];
const LOCKED = ['Approved', 'Salary Credited', 'Payslips Generated', 'Released'];

export function ShortfallDrawer({ day, onClose }: {day: DayCompliance | null;onClose: () => void;}) {
  const { user } = useAuth();
  const { state, employee, team } = useData();
  const { mutate, pending, error, setError } = useMutation();
  const canPay = !!user?.canManagePayroll;
  const emp = employee(day?.employeeId);
  const [status, setStatus] = useState<ReviewStatus>('Confirmed');
  const [category, setCategory] = useState<AdjustmentCategory | ''>('');
  const [payable, setPayable] = useState('');
  const [finalStr, setFinalStr] = useState('');
  const [finalTouched, setFinalTouched] = useState(false);
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!day) return;
    const r = day.review;
    const initial: ReviewStatus = canPay ? r && r.status !== 'Pending Review' ? r.status : 'Confirmed' : 'Correction Requested';
    setStatus(initial);
    setCategory(r?.category ?? '');
    setPayable(r?.adjustedPayableMinutes !== undefined ? toHM(r.adjustedPayableMinutes) : toHM(day.completedMin));
    setFinalStr(r?.finalDeduction != null ? String(r.finalDeduction) : '');
    setFinalTouched(r?.finalDeduction != null);
    setReason('');
    setTouched(false);
    setError(null);
  }, [day, canPay, setError]);

  const month = day?.date.slice(0, 7) ?? '';
  const run = state.payrollRuns.find((r) => r.month === month);
  const locked = !!run && LOCKED.includes(run.status);
  const ss = state.salary.find((s) => s.employeeId === day?.employeeId);
  const payableMin = parseHM(payable);
  const adjustedShortfall = day ? status === 'Adjusted' && payableMin !== null ? Math.max(day.expectedMin - payableMin, 0) : status === 'Approved Exception' || status === 'Waived' ? 0 : day.shortfallMin : 0;
  const originalProposal = useMemo(() => day && emp ? proposeShortfallDeduction(state.settings, emp, ss, month, state.holidays, day.shortfallMin) : null, [day, emp, ss, month, state.settings, state.holidays]);
  const proposal = useMemo(() => day && emp ? proposeShortfallDeduction(state.settings, emp, ss, month, state.holidays, adjustedShortfall) : null, [day, emp, ss, month, state.settings, state.holidays, adjustedShortfall]);

  useEffect(() => {
    if (!finalTouched && proposal?.amount != null) setFinalStr(String(proposal.amount));
  }, [proposal?.amount, finalTouched]);

  if (!day || !emp) return <Drawer open={false} onClose={onClose} title=""><div /></Drawer>;

  const needsFinal = status === 'Confirmed' || status === 'Adjusted';
  const needsCategory = status === 'Adjusted' || status === 'Approved Exception' || status === 'Waived';
  const finalVal = finalStr.trim() === '' ? null : Number(finalStr);
  const errs = {
    reason: !reason.trim() ? 'A reason is required for every decision.' : undefined,
    category: needsCategory && !category ? 'Choose a category.' : undefined,
    payable: status === 'Adjusted' && (payableMin === null || payableMin > 24 * 60) ? 'Enter hours as h:mm, e.g. 7:30.' : undefined,
    final: needsFinal && (finalVal === null || Number.isNaN(finalVal) || finalVal < 0) ? 'Enter the final approved amount (0 if none).' : undefined,
    other: category === 'Other' && reason.trim().length < 15 ? 'Explain “Other” in at least 15 characters.' : undefined
  };
  const hasErr = Object.values(errs).some(Boolean);
  const finalShown = status === 'Approved Exception' || status === 'Waived' ? 0 : status === 'Correction Requested' ? null : finalVal;

  const save = async () => {
    setTouched(true);
    if (hasErr) return;
    const ok = await mutate(cmd.reviewShortfall(emp.id, day.date, {
      status,
      category: needsCategory ? category as AdjustmentCategory : undefined,
      reason,
      adjustedPayableMinutes: status === 'Adjusted' ? payableMin as number : undefined,
      proposedDeduction: proposal?.amount ?? null,
      finalDeduction: needsFinal ? finalVal : undefined
    }), 'Decision recorded');
    if (ok) onClose();
  };

  return (
    <Drawer open={!!day} onClose={onClose} size="lg" title={`${emp.name} · ${fmtDate(day.date, 'EEE, d MMM yyyy')}`}
    description={<span className="flex flex-wrap items-center gap-2">{team(emp.teamId)?.name} · {emp.code} <StatusBadge status={day.status} /> <StatusBadge status={day.review?.status ?? 'Pending Review'} /></span>}
    footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={pending} disabled={locked} onClick={save}>Record decision</Button></>}>
      <div className="space-y-6">
        <section>
          <h3 className="mb-3 text-sm font-semibold">Calculation</h3>
          <DayBreakdown day={day} />
        </section>

        {locked && <Banner tone="warn" title={`Payroll for ${fmtDate(`${month}-01`, 'MMMM yyyy')} is ${run?.status.toLowerCase()}`}>Changes now require the payroll correction workflow. Revise payslips from the Payslips page.</Banner>}

        <section>
          <h3 className="mb-3 text-sm font-semibold">Decision</h3>
          {!canPay && <Banner tone="neutral" className="mb-3" title="Limited permissions">You can request a time-log correction. Confirming, adjusting, waiving or excepting payroll-impacting shortfalls requires payroll authorisation.</Banner>}
          <div className="space-y-2" role="radiogroup" aria-label="Outcome">
            {outcomes.map((o) => {
              const disabled = locked || o.payroll && !canPay;
              return (
                <label key={o.value} className={cn('flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors duration-150', status === o.value ? 'border-brand-500 bg-brand-50' : 'border-line hover:border-line-strong', disabled && 'cursor-not-allowed opacity-50')}>
                  <input type="radio" name="outcome" className="mt-1 h-4 w-4 text-brand-700 focus:ring-brand-500" checked={status === o.value} disabled={disabled}
                  onChange={() => {setStatus(o.value);if (o.category && !category) setCategory(o.category);setFinalTouched(false);}} />
                  <span>
                    <span className="flex items-center gap-1.5 text-sm font-medium">{o.label}{o.payroll && !canPay && <LockIcon className="h-3.5 w-3.5" />}</span>
                    <span className="block text-xs text-ink-muted">{o.body}</span>
                  </span>
                </label>);

            })}
          </div>
        </section>

        {needsCategory &&
        <Field label="Adjustment category" required error={touched ? errs.category : undefined}>
            {(id) => <Select id={id} value={category} onChange={(e) => setCategory(e.target.value as AdjustmentCategory)} invalid={touched && !!errs.category}><option value="">Select category</option>{categories.map((c) => <option key={c}>{c}</option>)}</Select>}
          </Field>
        }
        {status === 'Adjusted' &&
        <Field label="Adjusted payable hours" required hint={`Recorded: ${toHM(day.completedMin)} · Expected: ${toHM(day.expectedMin)}`} error={touched ? errs.payable : undefined}>
            {(id) => <Input id={id} value={payable} onChange={(e) => setPayable(e.target.value)} placeholder="7:30" className="max-w-[160px] tnum" invalid={touched && !!errs.payable} />}
          </Field>
        }

        {canPay && status !== 'Correction Requested' &&
        <section>
            <h3 className="mb-3 text-sm font-semibold">Original vs adjusted</h3>
            <div className="overflow-hidden rounded-lg border border-line">
              <table className="w-full text-sm">
                <thead className="bg-canvas text-xs text-ink-muted"><tr><th className="px-3 py-2 text-left font-medium" /><th className="px-3 py-2 text-right font-medium">Original</th><th className="px-3 py-2 text-right font-medium">After this decision</th></tr></thead>
                <tbody className="divide-y divide-line tnum">
                  <tr><td className="px-3 py-2 text-ink-muted">Expected hours</td><td className="px-3 py-2 text-right">{fmtMin(day.expectedMin)}</td><td className="px-3 py-2 text-right">{fmtMin(day.expectedMin)}</td></tr>
                  <tr><td className="px-3 py-2 text-ink-muted">Recorded / payable hours</td><td className="px-3 py-2 text-right">{fmtMin(day.completedMin)}</td><td className="px-3 py-2 text-right">{status === 'Adjusted' && payableMin !== null ? fmtMin(payableMin) : fmtMin(day.completedMin)}</td></tr>
                  <tr><td className="px-3 py-2 text-ink-muted">Shortfall</td><td className="px-3 py-2 text-right text-bad">{fmtMin(day.shortfallMin)}</td><td className="px-3 py-2 text-right">{fmtMin(adjustedShortfall)}</td></tr>
                  <tr><td className="px-3 py-2 text-ink-muted">Proposed deduction</td><td className="px-3 py-2 text-right">{originalProposal?.amount != null ? fmtINR(originalProposal.amount) : '—'}</td><td className="px-3 py-2 text-right">{proposal?.amount != null ? fmtINR(proposal.amount) : '—'}</td></tr>
                  <tr className="font-semibold"><td className="px-3 py-2">Final approved deduction</td><td className="px-3 py-2 text-right">{day.review?.finalDeduction != null ? fmtINR(day.review.finalDeduction) : '—'}</td><td className="px-3 py-2 text-right">{finalShown != null && !Number.isNaN(finalShown) ? fmtINR(finalShown) : '—'}</td></tr>
                </tbody>
              </table>
            </div>
            {proposal?.missing ?
          <Banner tone="warn" title="Needs review — no approved calculation basis" className="mt-3">
                {proposal.missing} No amount has been calculated. {needsFinal && 'Enter a management-approved amount, or '}<Link to="/management/settings?tab=deductions" className="font-medium underline">configure the deduction policy</Link>.
              </Banner> :
          proposal?.breakdown ?
          <p className="mt-2 text-xs text-ink-muted">{proposal.breakdown}</p> :
          null}
            {needsFinal &&
          <Field label="Final approved deduction (₹)" required className="mt-4" hint="Separate from all other deductions. Applied to payroll only after this approval." error={touched ? errs.final : undefined}>
                {(id) => <Input id={id} type="number" min={0} step="0.01" value={finalStr} onChange={(e) => {setFinalStr(e.target.value);setFinalTouched(true);}} className="max-w-[200px] tnum" invalid={touched && !!errs.final} />}
              </Field>
          }
          </section>
        }

        <Field label="Reason" required hint="Recorded in the audit log with the previous and new values." error={touched ? errs.reason ?? errs.other : undefined}>
          {(id) => <Textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} invalid={touched && !!(errs.reason || errs.other)} />}
        </Field>
        {error && <Banner tone="bad" title="Not saved">{error}</Banner>}

        {day.review && day.review.history.length > 0 &&
        <section>
            <h3 className="mb-2 text-sm font-semibold">Review history</h3>
            <ol className="space-y-3 border-l border-line pl-4">
              {[...day.review.history].reverse().map((h, i) =>
            <li key={i} className="text-sm">
                  <p><span className="font-medium">{h.from} → {h.to}</span> <span className="text-ink-muted">by {h.by}</span></p>
                  <p className="text-xs text-ink-faint">{fmtDateTime(h.at)}{canPay && h.newDeduction != null && ` · final ${fmtINR(h.newDeduction)}`}</p>
                  <p className="mt-0.5 text-xs text-ink-2">{h.reason}</p>
                </li>
            )}
            </ol>
          </section>
        }
      </div>
    </Drawer>);

}