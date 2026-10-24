import { useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { addMonths, format } from 'date-fns';
import { PencilIcon, KeyRoundIcon, PowerIcon, ReceiptIcon } from 'lucide-react';
import { ShortfallDrawer } from '../../components/compliance/ShortfallDrawer';
import { DayDetailDrawer } from '../../components/compliance/DayDetailDrawer';
import { PayslipViewer } from '../../components/payslip/PayslipViewer';
import { ComplianceDaysTable } from '../../components/shared/ComplianceDaysTable';
import { DateStepper } from '../../components/shared/DateStepper';
import { SessionsTable } from '../../components/shared/SessionsTable';
import { EmployeeFormDrawer } from '../../components/workforce/EmployeeFormDrawer';
import { CredentialsDialog } from '../../components/workforce/CredentialsDialog';
import { StatusBadge } from '../../components/ui/Badge';
import { Button, ButtonLink } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Avatar, Banner, EmptyState, KeyValue, PageHeader, Panel, Tabs } from '../../components/ui/Primitives';
import { Table, Td, Th, Tr } from '../../components/ui/Table';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { useMutation } from '../../hooks/useMutation';
import { useNow } from '../../hooks/useNow';
import type { Credentials, Employee, Payslip } from '@shared/types';
import { computeDay, workingDaysLabel } from '@shared/domain/compliance';
import type { DayCompliance } from '@shared/domain/compliance';
import { fmtINR, maskAccount } from '@shared/domain/currency';
import { grossOf, monthLabel } from '@shared/domain/payroll';
import { cmd } from '../../utils/commands';
import { fmtDate, fmtDateTime, fmtMin, fromDateKey, monthDates, sessionActiveMs, todayKey, weekDates, MINUTE } from '@shared/domain/time';
import { LeaveRange } from '../employee/MyLeavesPage';

type Tab = 'overview' | 'logs' | 'attendance' | 'compliance' | 'timesheets' | 'projects' | 'leave' | 'bank' | 'salary' | 'payslips';

export function EmployeeDetailPage() {
  const { id } = useParams();
  const { state } = useData();
  const emp = state.employees.find((e) => e.id === id);
  if (!emp) return <Navigate to="/management/employees" replace />;
  return <EmployeeDetail emp={emp} />;
}

function EmployeeDetail({ emp }: {emp: Employee;}) {
  const { user } = useAuth();
  const { state, ctx, team, personName } = useData();
  const now = useNow(60000);
  const today = todayKey(now);
  const [tab, setTab] = useState<Tab>('overview');
  const [month, setMonth] = useState(today.slice(0, 7));
  const [editing, setEditing] = useState<Employee | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [detail, setDetail] = useState<DayCompliance | null>(null);
  const [review, setReview] = useState<DayCompliance | null>(null);
  const [payslip, setPayslip] = useState<Payslip | null>(null);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const { mutate, mutateWithResult, pending, error, setError } = useMutation();
  const canPay = !!user?.canManagePayroll;

  const monthDays = monthDates(month).filter((d) => d <= today).map((d) => computeDay(ctx, emp, d, now)).reverse();
  const todayDay = computeDay(ctx, emp, today, now);
  const sessions = state.sessions.filter((s) => s.employeeId === emp.id && s.date.startsWith(month));
  const leaves = state.leaves.filter((l) => l.employeeId === emp.id).sort((a, b) => a.startDate < b.startDate ? 1 : -1);
  const timesheets = state.timesheets.filter((t) => t.employeeId === emp.id).sort((a, b) => a.weekStart < b.weekStart ? 1 : -1);
  const projects = state.projects.filter((p) => p.employeeIds.includes(emp.id) || state.tasks.some((t) => t.projectId === p.id && t.assigneeId === emp.id));
  const ss = state.salary.find((s) => s.employeeId === emp.id);
  const payslips = state.payslips.filter((p) => p.employeeId === emp.id).sort((a, b) => a.month < b.month ? 1 : a.month > b.month ? -1 : b.version - a.version);
  const monthSummary = monthDays.reduce((a, d) => ({ e: a.e + d.expectedMin, c: a.c + d.completedMin, s: a.s + (d.isShortfall ? d.shortfallMin : 0), b: a.b + (d.isShortfall ? 1 : 0) }), { e: 0, c: 0, s: 0, b: 0 });

  const tabs: {id: Tab;label: string;}[] = [
  { id: 'overview', label: 'Overview' }, { id: 'logs', label: 'Time Logs' }, { id: 'attendance', label: 'Attendance' }, { id: 'compliance', label: 'Working-Hour Compliance' },
  { id: 'timesheets', label: 'Timesheets' }, { id: 'projects', label: 'Projects' }, { id: 'leave', label: 'Leave History' }, { id: 'bank', label: 'Bank Details' },
  ...(canPay ? [{ id: 'salary' as Tab, label: 'Salary Structure' }, { id: 'payslips' as Tab, label: 'Payslips' }] : [])];

  const monthPicker =
  <DateStepper label={format(fromDateKey(`${month}-01`), 'MMMM yyyy')} onPrev={() => setMonth(format(addMonths(fromDateKey(`${month}-01`), -1), 'yyyy-MM'))} onNext={() => setMonth(format(addMonths(fromDateKey(`${month}-01`), 1), 'yyyy-MM'))} nextDisabled={month >= today.slice(0, 7)} />;


  return (
    <div>
      <PageHeader title={emp.name} back={{ to: '/management/employees', label: 'Employees' }}
      description={<span className="flex flex-wrap items-center gap-2">{emp.designation} · {emp.code} · {team(emp.teamId)?.name} <StatusBadge status={emp.status} /></span>}
      actions={<><Button variant="secondary" icon={KeyRoundIcon} onClick={async () => { const res = await mutateWithResult(cmd.resetEmployeePassword(emp.id), 'New password generated'); if (res.credentials) setCredentials(res.credentials); }}>Reset password</Button><Button variant="secondary" icon={PowerIcon} onClick={() => {setError(null);setStatusOpen(true);}}>{emp.status === 'Active' ? 'Deactivate' : 'Activate'}</Button><Button icon={PencilIcon} onClick={() => setEditing(emp)}>Edit</Button></>} />
      {emp.status === 'Inactive' && <Banner tone="neutral" className="mb-4">This account is deactivated. The employee can’t sign in, but all historical time, leave and payroll records are preserved.</Banner>}
      <div className="mb-6"><Tabs value={tab} onChange={setTab} tabs={tabs} /></div>

      {tab === 'overview' &&
      <div className="grid gap-6 lg:grid-cols-3">
          <Panel title="Details" className="lg:col-span-2">
            <div className="mb-5 flex items-center gap-4"><Avatar name={emp.name} size="lg" /><div><p className="font-semibold">{emp.name}</p><p className="text-sm text-ink-muted">{emp.email}</p></div></div>
            <dl className="grid gap-5 sm:grid-cols-3">
              <KeyValue label="Phone" value={emp.phone ?? '—'} />
              <KeyValue label="Joining date" value={emp.joiningDate ? fmtDate(emp.joiningDate) : 'Not provided'} />
              <KeyValue label="Reporting manager" value={personName(emp.managerId)} />
              <KeyValue label="Schedule" value={emp.schedule} />
              <KeyValue label="Daily target" value={fmtMin(emp.dailyTargetMinutes)} />
              <KeyValue label="Working days" value={workingDaysLabel(emp, state.settings)} />
            </dl>
          </Panel>
          <div className="space-y-6">
            <Panel title="Today">
              <div className="flex items-center justify-between"><p className="text-2xl font-semibold tnum">{fmtMin(todayDay.completedMin)}</p><StatusBadge status={todayDay.status} /></div>
              <p className="mt-1 text-sm text-ink-muted">of {fmtMin(todayDay.expectedMin)} expected</p>
            </Panel>
            <Panel title={format(fromDateKey(`${today.slice(0, 7)}-01`), 'MMMM')} description="Month to date">
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <KeyValue label="Completed" value={fmtMin(monthSummary.c)} />
                <KeyValue label="Expected" value={fmtMin(monthSummary.e)} />
                <KeyValue label="Shortfall" value={<span className={monthSummary.s ? 'text-bad' : ''}>{fmtMin(monthSummary.s)}</span>} />
                <KeyValue label="Days below target" value={monthSummary.b} />
              </dl>
            </Panel>
          </div>
        </div>
      }

      {tab === 'logs' && <><div className="mb-4">{monthPicker}</div><Panel flush><SessionsTable sessions={sessions} showDate emptyTitle="No sessions this month" /></Panel></>}
      {(tab === 'attendance' || tab === 'compliance') &&
      <>
          <div className="mb-4">{monthPicker}</div>
          <Panel flush><ComplianceDaysTable days={monthDays} mode={tab} onSelect={(d) => tab === 'compliance' && d.isShortfall ? setReview(d) : setDetail(d)} /></Panel>
        </>
      }
      {tab === 'timesheets' &&
      <Panel flush>
          {timesheets.length === 0 ? <EmptyState icon={ReceiptIcon} title="No timesheets submitted" /> :
        <Table>
              <thead><tr><Th>Week</Th><Th>Submitted</Th><Th>Status</Th><Th>Last action</Th></tr></thead>
              <tbody>{timesheets.map((t) => {const last = t.history[t.history.length - 1];return (
                <Tr key={t.id}><Td className="whitespace-nowrap">{fmtDate(t.weekStart, 'd MMM')} – {fmtDate(weekDates(t.weekStart)[6], 'd MMM yyyy')}</Td><Td className="text-ink-muted">{t.submittedAt ? fmtDateTime(t.submittedAt) : '—'}</Td><Td><StatusBadge status={t.status} /></Td><Td className="text-xs text-ink-muted">{last ? `${last.action} by ${last.by}` : '—'}</Td></Tr>);
            })}</tbody>
            </Table>
        }
        </Panel>
      }
      {tab === 'projects' &&
      <Panel flush>
          <Table>
            <thead><tr><Th>Project</Th><Th>Status</Th><Th>Open tasks</Th><Th align="right">Hours (all time)</Th></tr></thead>
            <tbody>{projects.length === 0 && <tr><Td colSpan={4} className="py-8 text-center text-ink-muted">Not assigned to any projects.</Td></tr>}{projects.map((p) =>
            <Tr key={p.id}><Td><p className="font-medium">{p.name}</p><p className="text-xs text-ink-muted">{p.code}</p></Td><Td><StatusBadge status={p.status} /></Td>
                <Td>{state.tasks.filter((t) => t.projectId === p.id && t.assigneeId === emp.id && t.status !== 'Completed').length}</Td>
                <Td align="right">{fmtMin(state.sessions.filter((s) => s.employeeId === emp.id && s.projectId === p.id).reduce((a, s) => a + Math.floor(sessionActiveMs(s, now) / MINUTE), 0))}</Td></Tr>
            )}</tbody>
          </Table>
        </Panel>
      }
      {tab === 'leave' &&
      <Panel flush>
          {leaves.length === 0 ? <EmptyState icon={ReceiptIcon} title="No leave requests" /> :
        <Table>
              <thead><tr><Th>Type</Th><Th>Dates</Th><Th align="right">Days</Th><Th>Status</Th><Th>Decided by</Th></tr></thead>
              <tbody>{leaves.map((l) => <Tr key={l.id}><Td>{l.type}{l.retrospective && <span className="ml-2 text-xs text-warn">Past-dated</span>}</Td><Td className="whitespace-nowrap"><LeaveRange l={l} /></Td><Td align="right">{l.days}</Td><Td><StatusBadge status={l.status} /></Td><Td className="text-xs text-ink-muted">{l.decidedBy ?? '—'}</Td></Tr>)}</tbody>
            </Table>
        }
        </Panel>
      }
      {tab === 'bank' &&
      <Panel title="Bank details">
          <dl className="grid gap-5 sm:grid-cols-2">
            <KeyValue label="Beneficiary name" value={emp.beneficiaryName ?? '—'} />
            <KeyValue label="Bank name" value={emp.bankName ?? '—'} />
            <KeyValue label="Account number" value={emp.bankAccountNumber ? maskAccount(emp.bankAccountNumber) : '—'} />
            <KeyValue label="IFSC" value={emp.ifscCode ?? '—'} />
          </dl>
          <p className="mt-4 text-xs text-ink-muted">Edit these from the employee form. They flow into payslip PDFs via the salary structure.</p>
        </Panel>
      }
      {tab === 'salary' && canPay &&
      <Panel title="Effective salary structure" actions={<ButtonLink to={`/management/payroll/salary-structures?employee=${emp.id}`} size="sm">Edit structure</ButtonLink>}>
          {!ss ? <p className="text-sm text-ink-muted">No salary structure configured.</p> :
        <dl className="grid gap-5 sm:grid-cols-4">
              <KeyValue label="Effective from" value={ss.effectiveFrom ? fmtDate(ss.effectiveFrom) : 'Not provided'} />
              <KeyValue label="CTC (annual)" value={fmtINR(ss.ctcAnnual)} />
              <KeyValue label="Monthly gross" value={fmtINR(grossOf(ss))} />
              <KeyValue label="Bank" value={ss.bankName ? `${ss.bankName} · ${maskAccount(ss.accountNumber)}` : <span className="text-bad">Missing</span>} />
            </dl>
        }
        </Panel>
      }
      {tab === 'payslips' && canPay &&
      <Panel flush>
          {payslips.length === 0 ? <EmptyState icon={ReceiptIcon} title="No payslips yet" /> :
        <Table>
              <thead><tr><Th>Month</Th><Th>Version</Th><Th align="right">Take-home</Th><Th>Status</Th><Th /></tr></thead>
              <tbody>{payslips.map((p) => <Tr key={p.id} onClick={() => setPayslip(p)}><Td>{monthLabel(p.month)}</Td><Td>v{p.version}</Td><Td align="right">{fmtINR(p.data.takeHome)}</Td><Td><StatusBadge status={p.status} /></Td><Td align="right" className="text-sm font-medium text-brand-700">View</Td></Tr>)}</tbody>
            </Table>
        }
        </Panel>
      }

      <EmployeeFormDrawer employee={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog open={statusOpen} onClose={() => setStatusOpen(false)} requireReason pending={pending} error={error} tone={emp.status === 'Active' ? 'danger' : 'primary'}
      title={emp.status === 'Active' ? `Deactivate ${emp.name}?` : `Activate ${emp.name}?`}
      body={emp.status === 'Active' ? 'They will no longer be able to sign in or track time. All historical records are kept.' : 'They will be able to sign in and track time again.'}
      confirmLabel={emp.status === 'Active' ? 'Deactivate' : 'Activate'}
      onConfirm={async (reason) => {if (await mutate(cmd.setEmployeeStatus(emp.id, emp.status === 'Active' ? 'Inactive' : 'Active', reason), 'Account updated')) setStatusOpen(false);}} />
      <DayDetailDrawer day={detail} onClose={() => setDetail(null)} onReview={(d) => {setDetail(null);setReview(d);}} />
      <ShortfallDrawer day={review} onClose={() => setReview(null)} />
      <PayslipViewer payslip={payslip} onClose={() => setPayslip(null)} />
      <CredentialsDialog open={!!credentials} credentials={credentials} employeeName={emp.name} onClose={() => setCredentials(null)} />
    </div>);

}