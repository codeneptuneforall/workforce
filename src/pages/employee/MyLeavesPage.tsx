import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PlaneIcon, PlusIcon } from 'lucide-react';
import { StatusBadge } from '../../components/ui/Badge';
import { Button, ButtonLink } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState, PageHeader, Panel, Tabs } from '../../components/ui/Primitives';
import { Table, Td, Th, Tr } from '../../components/ui/Table';
import { useData } from '../../contexts/DataContext';
import { useCurrentEmployee } from '../../hooks/useCurrentEmployee';
import { useMutation } from '../../hooks/useMutation';
import { useNow } from '../../hooks/useNow';
import type { Leave } from '@shared/types';
import { holidayOn, isScheduled } from '@shared/domain/compliance';
import { leaveYearRange } from '@shared/domain/leave';
import { eachDateKey, fmtDate, fmtDateTime, todayKey } from '@shared/domain/time';
import { cmd } from '../../utils/commands';

export function LeaveRange({ l }: {l: Leave;}) {
  return <>{fmtDate(l.startDate, 'd MMM yyyy')}{l.endDate !== l.startDate && ` – ${fmtDate(l.endDate, 'd MMM yyyy')}`}</>;
}

export function MyLeavesPage() {
  const emp = useCurrentEmployee();
  const { state } = useData();
  const now = useNow(60000);
  const today = todayKey(now);
  const location = useLocation();
  const navigate = useNavigate();
  const tab = location.pathname.endsWith('/history') ? 'history' : 'overview';
  const [cancelId, setCancelId] = useState<string | null>(null);
  const { mutate, pending, error, setError } = useMutation();
  const s = state.settings;
  const mine = state.leaves.filter((l) => l.employeeId === emp.id).sort((a, b) => a.submittedAt < b.submittedAt ? 1 : -1);
  const [ys, ye] = leaveYearRange(s, now);
  const usedDays = (type: Leave['type']) =>
  mine.filter((l) => l.type === type && l.status === 'Approved').
  flatMap((l) => eachDateKey(l.startDate, l.endDate)).
  filter((d) => d >= ys && d <= ye && isScheduled(emp, d, s) && !holidayOn(d, state.holidays)).length;
  const casualUsed = usedDays('Casual');
  const emergencyUsed = usedDays('Emergency');
  const pending_ = mine.filter((l) => l.status === 'Pending Approval');
  const upcoming = mine.filter((l) => l.status === 'Approved' && l.endDate >= today);
  const rejected = mine.filter((l) => l.status === 'Rejected').slice(0, 3);
  const holidays = state.holidays.filter((h) => h.status === 'Published' && h.date >= today).sort((a, b) => a.date < b.date ? -1 : 1).slice(0, 4);

  return (
    <div>
      <PageHeader title="My Leaves" description={`Leave year ${fmtDate(ys, 'd MMM yyyy')} – ${fmtDate(ye, 'd MMM yyyy')}`}
      actions={<><ButtonLink to="/employee/leaves/apply?type=Emergency">Emergency Leave</ButtonLink><ButtonLink to="/employee/leaves/apply" variant="primary" icon={PlusIcon}>Apply for leave</ButtonLink></>} />
      <div className="mb-6">
        <Tabs value={tab} onChange={(t) => navigate(t === 'history' ? '/employee/leaves/history' : '/employee/leaves')} tabs={[{ id: 'overview', label: 'Overview' }, { id: 'history', label: 'Requests & history', count: pending_.length }]} />
      </div>

      {tab === 'overview' ?
      <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Panel>
              <div className="grid gap-6 sm:grid-cols-2 sm:divide-x sm:divide-line">
                <div>
                  <p className="text-sm text-ink-muted">Casual Leave</p>
                  {s.casualAllowance === null ?
                <><p className="mt-1 text-3xl font-semibold tnum">{casualUsed} <span className="text-base font-normal text-ink-muted">days used</span></p><p className="mt-1 text-xs text-ink-muted">Annual allowance hasn’t been configured by management.</p></> :

                <><p className="mt-1 text-3xl font-semibold tnum">{Math.max(s.casualAllowance - casualUsed, 0)} <span className="text-base font-normal text-ink-muted">of {s.casualAllowance} remaining</span></p><p className="mt-1 text-xs text-ink-muted">{casualUsed} approved day(s) used this leave year.</p></>
                }
                </div>
                <div className="sm:pl-6">
                  <p className="text-sm text-ink-muted">Emergency Leave</p>
                  <p className="mt-1 text-3xl font-semibold tnum">{emergencyUsed} <span className="text-base font-normal text-ink-muted">days taken</span></p>
                  <p className="mt-1 text-xs text-ink-muted">Tracked as history. No advance notice required.</p>
                </div>
              </div>
            </Panel>
            <LeaveList title="Pending requests" items={pending_} empty="No pending requests." />
            <LeaveList title="Approved upcoming leave" items={upcoming} empty="No upcoming approved leave." />
            {rejected.length > 0 && <LeaveList title="Recently rejected" items={rejected} empty="" showReason />}
          </div>
          <Panel title="Upcoming holidays" className="self-start">
            {holidays.length === 0 ? <p className="text-sm text-ink-muted">No upcoming holidays published.</p> :
          <ul className="space-y-3">{holidays.map((h) => <li key={h.id}><p className="text-sm font-medium">{h.name}</p><p className="text-xs text-ink-muted">{fmtDate(h.date, 'EEE, d MMM yyyy')} · {h.type}</p></li>)}</ul>
          }
          </Panel>
        </div> :

      <Panel flush>
          {mine.length === 0 ? <EmptyState icon={PlaneIcon} title="No leave requests yet" action={<ButtonLink to="/employee/leaves/apply" variant="primary">Apply for leave</ButtonLink>} /> :
        <Table>
              <thead><tr><Th>Type</Th><Th>Dates</Th><Th align="right">Days</Th><Th>Submitted</Th><Th>Status</Th><Th>Decision</Th><Th /></tr></thead>
              <tbody>
                {mine.map((l) =>
            <Tr key={l.id}>
                    <Td><p className="font-medium">{l.type}</p>{l.retrospective && <p className="text-xs text-warn">Past-dated</p>}</Td>
                    <Td className="whitespace-nowrap"><LeaveRange l={l} /></Td>
                    <Td align="right">{l.days}</Td>
                    <Td className="whitespace-nowrap text-ink-muted">{fmtDateTime(l.submittedAt)}</Td>
                    <Td><StatusBadge status={l.status} /></Td>
                    <Td className="min-w-[200px] text-xs text-ink-muted">{l.decidedBy ? <>{l.decidedBy} · {fmtDateTime(l.decidedAt as string)}{l.rejectionReason && <p className="mt-0.5 text-bad">{l.rejectionReason}</p>}</> : '—'}</Td>
                    <Td align="right">{l.status === 'Pending Approval' && <Button size="sm" variant="ghost" onClick={() => {setError(null);setCancelId(l.id);}}>Cancel</Button>}</Td>
                  </Tr>
            )}
              </tbody>
            </Table>
        }
        </Panel>
      }

      <ConfirmDialog open={!!cancelId} onClose={() => setCancelId(null)} title="Cancel this request?" body="The request will be withdrawn. You can apply again later." confirmLabel="Cancel request" tone="danger" pending={pending} error={error}
      onConfirm={async () => {if (cancelId && (await mutate(cmd.cancelLeave(cancelId), 'Request cancelled'))) setCancelId(null);}} />
    </div>);

}

function LeaveList({ title, items, empty, showReason }: {title: string;items: Leave[];empty: string;showReason?: boolean;}) {
  return (
    <Panel title={title} flush>
      {items.length === 0 ? <p className="px-5 py-4 text-sm text-ink-muted">{empty}</p> :
      <ul className="divide-y divide-line">
          {items.map((l) =>
        <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div>
                <p className="text-sm font-medium">{l.type} Leave · {l.days} day{l.days !== 1 && 's'}</p>
                <p className="text-xs text-ink-muted"><LeaveRange l={l} /></p>
                {showReason && l.rejectionReason && <p className="mt-1 text-xs text-bad">{l.rejectionReason}</p>}
              </div>
              <StatusBadge status={l.status} />
            </li>
        )}
        </ul>
      }
    </Panel>);

}