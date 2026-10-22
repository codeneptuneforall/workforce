import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, startOfMonth, subMonths } from 'date-fns';
import { CheckCircle2Icon } from 'lucide-react';
import { ShortfallDrawer } from '../../components/compliance/ShortfallDrawer';
import { StatusBadge } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Field';
import { Banner, EmptyState, PageHeader, Panel } from '../../components/ui/Primitives';
import { Table, Td, Th, Tr } from '../../components/ui/Table';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { useNow } from '../../hooks/useNow';
import { isPendingReview, useShortfallDays } from '../../hooks/useShortfallDays';
import type { DayCompliance } from '@shared/domain/compliance';
import { fmtINR } from '@shared/domain/currency';
import { monthLabel, proposeShortfallDeduction } from '@shared/domain/payroll';
import { fmtDate, fmtMin, fromDateKey, todayKey } from '@shared/domain/time';

type Filter = 'pending' | 'all' | 'Confirmed' | 'Correction Requested' | 'Approved Exception' | 'Adjusted' | 'Waived';

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
  const [open, setOpen] = useState<DayCompliance | null>(null);
  const canPay = !!user?.canManagePayroll;
  const s = state.settings;

  const rows = useMemo(() => all.filter((d) => {
    const e = state.employees.find((x) => x.id === d.employeeId);
    if (month && !d.date.startsWith(month)) return false;
    if (teamId && e?.teamId !== teamId) return false;
    if (filter === 'pending') return isPendingReview(d);
    if (filter === 'all') return true;
    return d.review?.status === filter;
  }), [all, month, teamId, filter, state.employees]);

  const openDay = open ? all.find((d) => d.employeeId === open.employeeId && d.date === open.date) ?? open : null;
  const pendingCount = all.filter(isPendingReview).length;

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

      <div className="mb-4 grid gap-2 sm:grid-cols-3">
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
      </div>

      <Panel flush>
        {rows.length === 0 ?
        <EmptyState icon={CheckCircle2Icon} title={filter === 'pending' ? 'No shortfalls awaiting review' : 'No shortfalls match these filters'} body="Days still in progress never appear here — only days that have ended below target." /> :

        <Table>
            <thead><tr><Th>Employee</Th><Th>Work date</Th><Th align="right">Expected</Th><Th align="right">Completed</Th><Th align="right">Shortfall</Th><Th>Leave / holiday</Th><Th>Proposed payroll treatment</Th><Th>Review</Th><Th>Reviewer</Th><Th className="hidden xl:table-cell">Notes</Th></tr></thead>
            <tbody>
              {rows.map((d) => {
              const e = state.employees.find((x) => x.id === d.employeeId)!;
              const ss = state.salary.find((x) => x.employeeId === e.id);
              const p = proposeShortfallDeduction(s, e, ss, d.date.slice(0, 7), state.holidays, d.unapprovedShortfallMin);
              return (
                <Tr key={`${d.employeeId}-${d.date}`} onClick={() => setOpen(d)}>
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