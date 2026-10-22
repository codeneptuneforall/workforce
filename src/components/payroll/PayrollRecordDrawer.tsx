import { Link } from 'react-router-dom';
import type { PayrollRecord } from '@shared/domain/payroll';
import { monthLabel } from '@shared/domain/payroll';
import { fmtINR } from '@shared/domain/currency';
import { fmtMin } from '@shared/domain/time';
import { Badge } from '../ui/Badge';
import { Drawer } from '../ui/Overlay';
import { Banner, KeyValue } from '../ui/Primitives';

function Lines({ title, lines, total, totalLabel }: {title: string;lines: {label: string;amount: number;}[];total: number;totalLabel: string;}) {
  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <p className="border-b border-line bg-canvas px-4 py-2 text-xs font-medium text-ink-muted">{title}</p>
      <ul className="divide-y divide-line text-sm">
        {lines.map((l) =>
        <li key={l.label} className={`flex justify-between px-4 py-2 ${l.label === 'Working-Hour Shortfall Deduction' && l.amount > 0 ? 'font-medium text-bad' : ''}`}>
            <span>{l.label}</span><span className="tnum">{fmtINR(l.amount)}</span>
          </li>
        )}
        <li className="flex justify-between bg-canvas/60 px-4 py-2 font-semibold"><span>{totalLabel}</span><span className="tnum">{fmtINR(total)}</span></li>
      </ul>
    </div>);

}

export function PayrollRecordDrawer({ record, onClose }: {record: PayrollRecord | null;onClose: () => void;}) {
  return (
    <Drawer open={!!record} onClose={onClose} size="lg" title={record ? `${record.employee.name} · ${monthLabel(record.month)}` : ''}
    description={record && <span className="flex items-center gap-2">{record.employee.code} · {record.employee.designation} {record.ready ? <Badge tone="ok">Ready</Badge> : <Badge tone="warn">Needs Review</Badge>}</span>}>
      {record &&
      <div className="space-y-5">
          {record.issues.length > 0 &&
        <Banner tone="warn" title="Resolve before approval">
              <ul className="mt-1 list-disc space-y-1 pl-4">{record.issues.map((i) => <li key={i}>{i}</li>)}</ul>
              <div className="mt-2 flex flex-wrap gap-3 text-sm font-medium">
                {record.shortfall.pending > 0 && <Link to="/management/attendance/shortfalls" className="underline">Review shortfalls</Link>}
                {record.issues.some((i) => i.includes('treatment')) && <Link to="/management/leaves/settings" className="underline">Configure leave treatment</Link>}
                {!record.structure && <Link to={`/management/payroll/salary-structures?employee=${record.employee.id}`} className="underline">Add salary structure</Link>}
              </div>
            </Banner>
        }
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <KeyValue label="Salary for days" value={record.salaryDays} />
            <KeyValue label="LOP days" value={record.lopDays} />
            <KeyValue label="Scheduled working days" value={record.scheduledDays} />
            <KeyValue label="Approved leave" value={`${record.leave.casual} CL · ${record.leave.emergency} EL`} />
          </dl>
          <div className="grid gap-4 md:grid-cols-2">
            <Lines title="Earnings" lines={record.earnings} total={record.gross} totalLabel="Gross salary" />
            <Lines title="Employee deductions" lines={record.deductions} total={record.totalDeduction} totalLabel="Total deduction" />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-brand-200 bg-brand-50 px-4 py-3">
            <span className="text-sm text-brand-800">Take-home = Gross − Total deduction</span>
            <span className="text-lg font-bold text-brand-800 tnum">{fmtINR(record.takeHome)}</span>
          </div>
          <section>
            <h3 className="mb-2 text-sm font-semibold">Working-hour shortfalls this month</h3>
            <dl className="grid grid-cols-2 gap-4 rounded-lg border border-line p-4 sm:grid-cols-4">
              <KeyValue label="Days below target" value={record.shortfall.days} />
              <KeyValue label="Unapproved shortfall" value={fmtMin(record.shortfall.totalMin)} />
              <KeyValue label="Awaiting review" value={<span className={record.shortfall.pending ? 'text-warn' : ''}>{record.shortfall.pending}</span>} />
              <KeyValue label="Approved deduction" value={fmtINR(record.shortfall.approvedDeduction)} />
            </dl>
            <p className="mt-2 text-xs text-ink-muted">Only shortfalls with a recorded management decision are included. Approved leave, holidays and approved exceptions are excluded, and each day is deducted at most once.</p>
          </section>
          <p className="text-xs text-ink-faint">Employer contribution ({fmtINR(record.employerContribution)}) is part of CTC and is never deducted from take-home pay.</p>
        </div>
      }
    </Drawer>);

}