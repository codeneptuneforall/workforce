import { useData } from '../../contexts/DataContext';
import { adjustmentLabel, attendanceStatus } from '@shared/domain/compliance';
import type { DayCompliance } from '@shared/domain/compliance';
import { fmtDate, fmtMin, fmtTime } from '@shared/domain/time';
import { StatusBadge } from '../ui/Badge';
import { Table, Td, Th, Tr } from '../ui/Table';

export function ComplianceDaysTable({ days, mode, onSelect }: {days: DayCompliance[];mode: 'attendance' | 'compliance';onSelect?: (d: DayCompliance) => void;}) {
  const { state } = useData();
  return (
    <Table>
      <thead>
        <tr>
          <Th>Date</Th><Th align="right">Expected</Th><Th align="right">Completed</Th><Th align="right">Shortfall</Th>
          {mode === 'attendance' ? <><Th>First start</Th><Th>Last end</Th><Th>Attendance</Th></> : <><Th>Compliance</Th><Th>Review</Th></>}
        </tr>
      </thead>
      <tbody>
        {days.map((d) =>
        <Tr key={d.date} onClick={onSelect ? () => onSelect(d) : undefined}>
            <Td className="whitespace-nowrap font-medium">{fmtDate(d.date, 'EEE d MMM')}</Td>
            <Td align="right">{fmtMin(d.expectedMin)}</Td>
            <Td align="right">{fmtMin(d.completedMin)}</Td>
            <Td align="right" className={d.isShortfall ? 'text-bad' : 'text-ink-muted'}>{d.isShortfall ? fmtMin(d.shortfallMin) : '—'}</Td>
            {mode === 'attendance' ?
          <>
                <Td className="tnum">{d.firstStart ? fmtTime(new Date(d.firstStart).toISOString()) : '—'}</Td>
                <Td className="tnum">{d.lastEnd ? fmtTime(new Date(d.lastEnd).toISOString()) : '—'}</Td>
                <Td><StatusBadge status={attendanceStatus(d, state.settings)} /></Td>
              </> :

          <>
                <Td><StatusBadge status={d.status} /></Td>
                <Td>{d.isShortfall ? <StatusBadge status={adjustmentLabel(d)} /> : <span className="text-ink-muted">—</span>}</Td>
              </>
          }
          </Tr>
        )}
      </tbody>
    </Table>);

}