import { ClockIcon } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { useNow } from '../../hooks/useNow';
import type { WorkSession } from '@shared/types';
import { fmtDate, fmtMin, fmtTime, sessionActiveMs, sessionEndIso, sessionPausedMs, MINUTE } from '@shared/domain/time';
import { StatusBadge } from '../ui/Badge';
import { EmptyState } from '../ui/Primitives';
import { Table, Td, Th, Tr } from '../ui/Table';

interface Props {
  sessions: WorkSession[];
  showDate?: boolean;
  showEmployee?: boolean;
  emptyTitle?: string;
  emptyBody?: string;
}

export function SessionsTable({ sessions, showDate, showEmployee, emptyTitle = 'No sessions recorded', emptyBody }: Props) {
  const { project, task, employee } = useData();
  const now = useNow(15000);
  if (!sessions.length) return <EmptyState icon={ClockIcon} title={emptyTitle} body={emptyBody} />;
  const sorted = [...sessions].sort((a, b) => (a.intervals[0]?.start ?? '') < (b.intervals[0]?.start ?? '') ? 1 : -1);
  return (
    <Table>
      <thead>
        <tr>
          {showDate && <Th>Date</Th>}
          {showEmployee && <Th>Employee</Th>}
          <Th>Project / task</Th>
          <Th>Start</Th>
          <Th>End</Th>
          <Th align="right">Active</Th>
          <Th align="right">Paused</Th>
          <Th className="hidden md:table-cell">Notes</Th>
          <Th>Status</Th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((s) =>
        <Tr key={s.id}>
            {showDate && <Td className="whitespace-nowrap">{fmtDate(s.date, 'EEE d MMM')}</Td>}
            {showEmployee && <Td className="whitespace-nowrap">{employee(s.employeeId)?.name}</Td>}
            <Td>
              <p className="font-medium">{task(s.taskId)?.title ?? 'Task removed'}</p>
              <p className="text-xs text-ink-muted">{project(s.projectId)?.code} · {project(s.projectId)?.name}</p>
            </Td>
            <Td className="tnum">{fmtTime(s.intervals[0]?.start)}</Td>
            <Td className="tnum">{s.status === 'Completed' ? fmtTime(sessionEndIso(s)) : <span className="text-ink-muted">—</span>}</Td>
            <Td align="right" className="font-medium">{fmtMin(Math.floor(sessionActiveMs(s, now) / MINUTE))}</Td>
            <Td align="right" className="text-ink-muted">{fmtMin(Math.floor(sessionPausedMs(s, now) / MINUTE))}</Td>
            <Td className="hidden max-w-[240px] truncate text-ink-muted md:table-cell">{s.notes ?? '—'}</Td>
            <Td><StatusBadge status={s.status} /></Td>
          </Tr>
        )}
      </tbody>
    </Table>);

}