import { useEffect, useState } from 'react';
import { differenceInCalendarDays } from 'date-fns';
import { useData } from '../../contexts/DataContext';
import { useMutation } from '../../hooks/useMutation';
import type { Leave } from '@shared/types';
import { fmtDate, fmtDateTime, fromDateKey } from '@shared/domain/time';
import { cmd } from '../../utils/commands';
import { StatusBadge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Field, Textarea } from '../ui/Field';
import { Drawer } from '../ui/Overlay';
import { Banner, KeyValue } from '../ui/Primitives';

export function LeaveRequestDrawer({ leave, onClose }: {leave: Leave | null;onClose: () => void;}) {
  const { state, employee, team, personName } = useData();
  const { mutate, pending, error, setError } = useMutation();
  const [reason, setReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [touched, setTouched] = useState(false);
  useEffect(() => {setReason('');setRejecting(false);setTouched(false);setError(null);}, [leave?.id, setError]);
  if (!leave) return <Drawer open={false} onClose={onClose} title=""><div /></Drawer>;
  const emp = employee(leave.employeeId);
  const notice = differenceInCalendarDays(fromDateKey(leave.startDate), new Date(leave.submittedAt));
  const holidays = state.holidays.filter((h) => h.status === 'Published' && h.date >= leave.startDate && h.date <= leave.endDate);
  const overlapping = state.leaves.filter((l) => l.id !== leave.id && (l.status === 'Approved' || l.status === 'Pending Approval') && l.startDate <= leave.endDate && l.endDate >= leave.startDate && employee(l.employeeId)?.teamId === emp?.teamId);
  const history = state.leaves.filter((l) => l.employeeId === leave.employeeId && l.id !== leave.id).slice(0, 5);
  const isPending = leave.status === 'Pending Approval';

  const decide = async (approve: boolean) => {
    setTouched(true);
    if (!approve && !reason.trim()) return;
    if (await mutate(cmd.decideLeave(leave.id, approve, reason), approve ? 'Leave approved' : 'Leave rejected')) onClose();
  };

  return (
    <Drawer open onClose={onClose} title={`${emp?.name} · ${leave.type} Leave`} description={<span className="flex items-center gap-2">{team(emp?.teamId)?.name} <StatusBadge status={leave.status} /></span>}
    footer={isPending && (rejecting ?
    <><Button variant="secondary" onClick={() => setRejecting(false)}>Back</Button><Button variant="danger" loading={pending} onClick={() => decide(false)}>Confirm rejection</Button></> :

    <><Button variant="secondary" onClick={() => setRejecting(true)}>Reject</Button><Button variant="success" loading={pending} onClick={() => decide(true)}>Approve leave</Button></>)
    }>
      <div className="space-y-5">
        {leave.retrospective && <Banner tone="warn" title="Retrospective Emergency Leave">Submitted after the leave started. Check the reason before approving.</Banner>}
        <dl className="grid grid-cols-2 gap-4">
          <KeyValue label="Dates" value={`${fmtDate(leave.startDate, 'EEE d MMM')}${leave.endDate !== leave.startDate ? ` – ${fmtDate(leave.endDate, 'EEE d MMM yyyy')}` : ''}`} />
          <KeyValue label="Working days" value={leave.days} />
          <KeyValue label="Submitted" value={fmtDateTime(leave.submittedAt)} />
          <KeyValue label="Notice given" value={notice >= 0 ? `${notice} calendar day(s)` : `${Math.abs(notice)} day(s) after start`} />
          {leave.contact && <KeyValue label="Contact" value={leave.contact} />}
          {leave.attachmentName && <KeyValue label="Attachment" value={leave.attachmentName} />}
        </dl>
        <div><p className="text-xs text-ink-muted">Reason</p><p className="mt-1 rounded-lg bg-canvas p-3 text-sm">{leave.reason}</p></div>
        {holidays.length > 0 && <Banner tone="brand">Includes {holidays.map((h) => h.name).join(', ')} — not counted as leave days.</Banner>}
        <div>
          <p className="mb-2 text-sm font-semibold">Team availability</p>
          {overlapping.length === 0 ? <p className="text-sm text-ink-muted">No one else in {team(emp?.teamId)?.name} is on leave during these dates.</p> :
          <ul className="space-y-1.5">{overlapping.map((l) => <li key={l.id} className="flex items-center justify-between text-sm"><span>{personName(l.employeeId)} · {fmtDate(l.startDate, 'd MMM')}–{fmtDate(l.endDate, 'd MMM')}</span><StatusBadge status={l.status} /></li>)}</ul>
          }
        </div>
        {!isPending &&
        <div className="rounded-lg border border-line p-3 text-sm">
            <p><span className="font-medium">{leave.status}</span> by {leave.decidedBy} · {leave.decidedAt && fmtDateTime(leave.decidedAt)}</p>
            {leave.rejectionReason && <p className="mt-1 text-bad">{leave.rejectionReason}</p>}
          </div>
        }
        {isPending && <p className="text-xs text-ink-muted">Approving adds this leave to the calendar, updates attendance for these dates, notifies the employee and updates any configured balance. Payroll impact follows the configured paid/unpaid treatment.</p>}
        {isPending && rejecting &&
        <Field label="Rejection reason" required error={touched && !reason.trim() ? 'A rejection reason is required.' : undefined}>
            {(id) => <Textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />}
          </Field>
        }
        {error && <Banner tone="bad" title="Not saved">{error}</Banner>}
        <div>
          <p className="mb-2 text-sm font-semibold">Recent leave history</p>
          {history.length === 0 ? <p className="text-sm text-ink-muted">No other requests.</p> : <ul className="space-y-1.5">{history.map((l) => <li key={l.id} className="flex items-center justify-between text-sm"><span>{l.type} · {fmtDate(l.startDate, 'd MMM yyyy')} · {l.days}d</span><StatusBadge status={l.status} /></li>)}</ul>}
        </div>
      </div>
    </Drawer>);

}