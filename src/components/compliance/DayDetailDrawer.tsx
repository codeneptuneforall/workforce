import { DayBreakdown } from '../shared/DayBreakdown';
import { StatusBadge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Drawer } from '../ui/Overlay';
import { useData } from '../../contexts/DataContext';
import type { DayCompliance } from '@shared/domain/compliance';
import { fmtDate } from '@shared/domain/time';

export function DayDetailDrawer({ day, onClose, onReview }: {day: DayCompliance | null;onClose: () => void;onReview?: (d: DayCompliance) => void;}) {
  const { employee, team } = useData();
  const emp = employee(day?.employeeId);
  return (
    <Drawer open={!!day} onClose={onClose} title={emp ? `${emp.name} · ${day ? fmtDate(day.date, 'EEE, d MMM yyyy') : ''}` : ''}
    description={day && <span className="flex items-center gap-2">{team(emp?.teamId)?.name} <StatusBadge status={day.status} /></span>}
    footer={day?.isShortfall && onReview ? <Button onClick={() => onReview(day)}>Review shortfall</Button> : undefined}>
      {day && <DayBreakdown day={day} />}
    </Drawer>);

}