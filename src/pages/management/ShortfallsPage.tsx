import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, startOfMonth, subMonths } from 'date-fns';
import { CheckCircle2Icon } from 'lucide-react';
import { ShortfallDrawer } from '../../components/compliance/ShortfallDrawer';
import { StatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Field, Input, Select, Textarea } from '../../components/ui/Field';
import { Banner, EmptyState, PageHeader, Panel } from '../../components/ui/Primitives';
import { Table, Td, Th, Tr } from '../../components/ui/Table';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { useNow } from '../../hooks/useNow';
import { useMutation } from '../../hooks/useMutation';
import { isPendingReview, useShortfallDays } from '../../hooks/useShortfallDays';
import type { DayCompliance } from '@shared/domain/compliance';
import { fmtINR } from '@shared/domain/currency';
import { monthLabel, proposeShortfallDeduction } from '@shared/domain/payroll';
import { fmtDate, fmtMin, fromDateKey, todayKey } from '@shared/domain/time';
import { cmd } from '../../utils/commands';

type Filter = 'pending' | 'all' | 'Confirmed' | 'Correction Requested' | 'Approved Exception' | 'Adjusted' | 'Waived';

type BulkAction = 'confirm' | 'waive' | 'correction';

const bulkActions: {value: BulkAction;label: string;needsAmount: boolean;}[] = [
  { value: 'confirm', label: 'Confirm shortfall for payroll', needsAmount: true },
  { value: 'waive', label: 'Waive shortfall (no deduction)', needsAmount: false },
  { value: 'correction', label: 'Request time-log correction', needsAmount: false }
];

export function ShortfallsPage() {
  const { user } = useAuth();
  const { state, team } = useData();
  const now = useNow(60000);
  const today = todayKey(now);
  const all = useShortfallDays();
  const months = [0, 1, 2].map((n) => format(startOfMonth(subMonths(fromDateKey(today), n)), 'yyyy-MM'));
  const [month, setMonth] = useState('');
  const [filter, setFilter] = useState<Filter>('pending');
  const [teamId, setTeamId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [open, setOpen] = useState<DayCompliance | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<BulkAction>('confirm');
  const [bulkReason, setBulkReason] = useState('');
  const [bulkAmount, setBulkAmount] = useState('');
  const canPay = !!user?.canManagePayroll;
  const s = state.settings;

  const rows = useMemo(() => all.filter((d) => {
    const e = state.employees.find((x) => x.id === d.employeeId);
    if (month && !d.date.startsWith(month)) return false;
    if (teamId && e?.teamId !== teamId) return false;
    if (employeeId && d.employeeId !== employeeId) return false;
    if (filter === 'pending') return isPendingReview(d);
    if (filter === 'all') return true;
    return d.review?.status === filter;
  }), [all, month, teamId, employeeId, filter, state.employees]);

  const openDay = open ? all.find((d) => d.employeeId === open.employeeId && d.date === open.date) ?? open : null;
  const pendingCount = all.filter(isPendingReview).length;
  const isSelected = (d: DayCompliance) => selected.has(`${d.employeeId}-${d.date}`);
  const allSelected = rows.length > 0 && rows.every((d) => isSelected(d));
  const { mutate, pending: bulkPending } = useMutation();

  const toggleSelect = (d: DayCompliance) => {
    const key = `${d.employeeId}-${d.date}`;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rows.map((d) => `${d.employeeId}-${d.date}`)));
    }
  };

  const applyBulk = async () => {
    if (!bulkReason.trim()) return;
    const amount = bulkAmount.trim() === '' ? null : Number(bulkAmount);
    if (bulkAction === 'confirm' && (amount === null || Number.isNaN(amount) || amount < 0)) return;

    const decision = {
      status: bulkAction === 'confirm' ? 'Confirmed' : bulkAction === 'waive' ? 'Waived' : 'Correction Requested',
      category: bulkAction === 'waive' ? 'Management-approved waiver' as const : undefined,
      reason: bulkReason,
      finalDeduction: bulkAction === 'confirm' ? amount : undefined,
      canManagePayroll: canPay,
      proposedDeduction: null
    };

    for (const d of rows) {
      if (!isSelected(d)) continue;
      const e = state.employees.find((x) => x.id === d.employeeId)!;
      const ok = await mutate(cmd.reviewShortfall(e.id, d.date, decision), 'Bulk decision recorded');
      if (!ok) return;
    }

    setSelected(new Set());
    setBulkReason('');
    setBulkAmount('');
  };

  return (
    <div>
      <PageHeader title="Shortfall Review" back={{ to: '/management/attendance', label: 'Attendance & Working Hours' }}
      description="Every ended working day below target. Shortfalls are calculated automatically; payroll treatment needs a recorded management decision." />

      {s.deductionMethod === 'not_configured' || !s.deductionEnabled ?
      <Banner tone="warn" title="Shortfall deduction policy not configured" className="mb-4" action={canPay && <Link to="/management/settings?tab=deductions" className="text-sm font-medium underline">Configure policy</Link>}>
          No deduction amounts are calculated automatically. Confirmed shortfalls need a manually entered, management-approved amount — or can be waived or excepted.
        </Banner> :

      <Banner tone="info" className="mb-4">Proposed deductions use the approved method: <strong>{s.deductionMethod === 'daily_amount' ? 'daily payable amount ÷ daily target' : s.deductionMethod === 'monthly_proration' ? 'monthly salary ÷ payroll basis' : 'manual entry'}</strong>{s.policyApprovedBy && ` (approved by ${s.policyApprovedBy})`}.</Banner>
      }

      <div className="mb-4 grid gap-2 sm:grid-cols-4">
        <Select aria-label="Review status" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
          <option value="pending">Awaiting review ({pendingCount})</option>
          <option value="all">All statuses</option>
          <option value="Confirmed">Confirmed</option>
          <option value="Correction Requested">Correction requested</option>
          <option value="Approved Exception">Approved exception</option>
          <option value="Adjusted">Manually adjusted</option>
          <option value="Waived">Waived</option>
        </Select>
        <Select aria-label="Month" value={month} onChange={(e) => setMonth(e.target.value)}>
          <option value="">Last 3 months</option>
          {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </Select>
        <Select aria-label="Team" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
          <option value="">All teams</option>
          {state.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
        <Select aria-label="Employee" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
          <option value="">All employees</option>
          {state.employees.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.code})</option>)}
        </Select>
      </div>

      {selected.size > 0 && (
        <Panel title={`Bulk action — ${selected.size} day(s) selected`} className="mb-4">
        <div className="space-y-3">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Action">{(id) => <Select id={id} value={bulkAction} onChange={(e) => setBulkAction(e.target.value as BulkAction)}>{bulkActions.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}</Select>}</Field>
            <Field label="Reason" required error={!bulkReason.trim() ? 'A reason is required.' : undefined}>{(id) => <Textarea id={id} value={bulkReason} onChange={(e) => setBulkReason(e.target.value)} rows={2} placeholder="e.g. Approved after reviewing time logs" />}</Field>
            {bulkAction === 'confirm' && (
              <Field label="Final deduction (₹)" required error={!bulkAmount.trim() || isNaN(Number(bulkAmount)) || Number(bulkAmount) < 0 ? 'Enter a valid amount.' : undefined}>{(id) => <Input id={id} type="number" min={0} step="0.01" value={bulkAmount} onChange={(e) => setBulkAmount(e.target.value)} className="tnum" placeholder="0.00" />}</Field>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setSelected(new Set())}>Cancel</Button>
            <Button loading={bulkPending} disabled={bulkPending} onClick={applyBulk}>Apply to selected</Button>
          </div>
        </div>
        </Panel>
      )}

      <Panel flush>
        {rows.length === 0 ?
        <EmptyState icon={CheckCircle2Icon} title={filter === 'pending' ? 'No shortfalls awaiting review' : 'No shortfalls match these filters'} body="Days still in progress never appear here — only days that have ended below target." /> :

        <Table>
            <thead><tr>
              <Th className="w-10"><input type="checkbox" checked={allSelected} onChange={toggleSelectAll} /></Th>
              <Th>Employee</Th><Th>Work date</Th><Th align="right">Expected</Th><Th align="right">Completed</Th><Th align="right">Shortfall</Th><Th>Leave / holiday</Th><Th>Proposed payroll treatment</Th><Th>Review</Th><Th>Reviewer</Th><Th className="hidden xl:table-cell">Notes</Th>
            </tr></thead>
            <tbody>
              {rows.map((d) => {
              const e = state.employees.find((x) => x.id === d.employeeId)!;
              const ss = state.salary.find((x) => x.employeeId === e.id);
              const p = proposeShortfallDeduction(s, e, ss, d.date.slice(0, 7), state.holidays, d.unapprovedShortfallMin);
              const sel = isSelected(d);
              return (
                <Tr key={`${d.employeeId}-${d.date}`} onClick={() => setOpen(d)}>
                    <Td className="w-10"><input type="checkbox" checked={sel} onChange={(ev) => {ev.stopPropagation();toggleSelect(d);}} /></Td>
                    <Td><p className="font-medium">{e.name}</p><p className="text-xs text-ink-muted">{team(e.teamId)?.name}</p></Td>
                    <Td className="whitespace-nowrap">{fmtDate(d.date, 'EEE d MMM')}</Td>
                    <Td align="right">{fmtMin(d.expectedMin)}</Td>
                    <Td align="right">{fmtMin(d.completedMin)}</Td>
                    <Td align="right" className="font-medium text-bad">{fmtMin(d.shortfallMin)}</Td>
                    <Td className="text-xs">{d.pendingLeave ? <span className="text-warn">Leave pending (not an exception)</span> : d.hasIncomplete ? <span className="text-warn">Incomplete session</span> : '—'}</Td>
                    <Td className="text-xs">
                      {d.review && !isPendingReview(d) ?
                    canPay ? d.review.finalDeduction != null ? `Final ${fmtINR(d.review.finalDeduction)}` : '—' : 'Restricted' :
                    !canPay ? 'Restricted' : p.amount != null ? `Deduct ${fmtINR(p.amount)} (proposed)` : p.manual ? 'Manual amount required' : <StatusBadge status="Needs Review" />}
                    </Td>
                    <Td><StatusBadge status={d.review?.status ?? 'Pending Review'} /></Td>
                    <Td className="whitespace-nowrap text-xs text-ink-muted">{d.review?.reviewedBy ?? '—'}</Td>
                    <Td className="hidden max-w-[220px] truncate text-xs text-ink-muted xl:table-cell">{d.review?.reason ?? '—'}</Td>
                  </Tr>);

            })}
            </tbody>
          </Table>
        }
      </Panel>
      <ShortfallDrawer day={openDay} onClose={() => setOpen(null)} />
    </div>);

}
