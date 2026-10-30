import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format, startOfMonth, subMonths } from 'date-fns';
import * as XLSX from 'xlsx';
import { BanknoteIcon, CalculatorIcon, CheckIcon, DownloadIcon, FileTextIcon, RotateCcwIcon, SendIcon, SettingsIcon } from 'lucide-react';
import { PayrollRecordDrawer } from '../../components/payroll/PayrollRecordDrawer';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import { Button, ButtonLink } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Checkbox, Field, Input, Select } from '../../components/ui/Field';
import { DatePicker } from '../../components/ui/DatePicker';
import { Modal } from '../../components/ui/Overlay';
import { Banner, PageHeader, Panel } from '../../components/ui/Primitives';
import { Table, Td, Th, Tr } from '../../components/ui/Table';
import { useData } from '../../contexts/DataContext';
import { useMutation } from '../../hooks/useMutation';
import { useNow } from '../../hooks/useNow';
import { usePayrollRecords } from '../../hooks/usePayrollRecords';
import { cn } from '../../utils/cn';
import { fmtINR } from '@shared/domain/currency';
import { PAYROLL_STEPS, monthLabel } from '@shared/domain/payroll';
import type { PayrollRecord } from '@shared/domain/payroll';
import { getRun } from '@shared/domain/payrollMutations';
import { cmd } from '../../utils/commands';
import { fmtDate, fmtDateTime, fromDateKey, todayKey } from '@shared/domain/time';

export function PayrollPage() {
  const { state, employee } = useData();
  const now = useNow(60000);
  const today = todayKey(now);
  const months = [0, 1, 2, 3].map((n) => format(startOfMonth(subMonths(fromDateKey(today), n)), 'yyyy-MM'));
  const [month, setMonth] = useState(months[1]);
  const records = usePayrollRecords(month);
  const run = getRun(state, month);
  const { mutate, pending, error, setError } = useMutation();
  const [open, setOpen] = useState<PayrollRecord | null>(null);
  const [creditOpen, setCreditOpen] = useState(false);
  const [confirm, setConfirm] = useState<'approve' | 'generate' | 'release' | 'reopen' | null>(null);
  useEffect(() => setError(null), [month, setError]);

  const navigate = useNavigate();
  const snapshot = run.status === 'Payslips Generated' || run.status === 'Released';
  const payslips = state.payslips.filter((p) => p.month === month);
  const currentSlips = payslips.filter((p) => p.status !== 'Superseded').sort((a, b) => a.data.employee.name.localeCompare(b.data.employee.name));
  const issues = snapshot ? [] : records.filter((r) => !r.ready);
  const generated = payslips.filter((p) => p.status === 'Generated').length;
  const released = payslips.filter((p) => p.status === 'Released').length;
  const pendingShortfalls = snapshot ? 0 : records.reduce((a, r) => a + r.shortfall.pending, 0);
  const shortfallTotal = snapshot ?
  currentSlips.reduce((a, p) => a + (p.data.deductions.find((d) => d.label === 'Working-Hour Shortfall Deduction')?.amount ?? 0), 0) :
  records.reduce((a, r) => a + r.shortfall.approvedDeduction, 0);
  const monthEnded = month < today.slice(0, 7);
  const stepIndex = run.status === 'Needs Review' ? 1 : PAYROLL_STEPS.indexOf(run.status);
  const totals = useMemo(() => records.reduce((a, r) => ({ g: a.g + r.gross, d: a.d + r.totalDeduction, t: a.t + r.takeHome }), { g: 0, d: 0, t: 0 }), [records]);
  const failed = (run.failedEmployeeIds ?? []).map((id) => employee(id)?.name).filter(Boolean);

  const exportToExcel = async () => {
    // Load the original bank template as the base with cell styles preserved
    const templateResponse = await fetch('/templates/BLKPAY_YYYYMMDD.xlsx');
    if (!templateResponse.ok) {
      throw new Error('Bank template not found.');
    }
    const templateBuffer = await templateResponse.arrayBuffer();
    const wb = XLSX.read(templateBuffer, { type: 'array', cellStyles: true });

    const ws = wb.Sheets['Sheet1'];
    if (!ws) throw new Error('Sheet1 not found in template.');

    const recordsToExport = snapshot ? currentSlips : records;
    const today = todayKey(now); // YYYY-MM-DD
    const [yyyy, mm, dd] = today.split('-');
    const transactionDate = `${dd}/${mm}/${yyyy}`;

    // Capture styles from row 3 (first data row, 0-indexed row 2) to copy to new rows
    const colStyles: any = {};
    for (let C = 0; C < 15; ++C) {
      const cellRef = XLSX.utils.encode_cell({ r: 2, c: C });
      const cell = ws[cellRef];
      if (cell) {
        colStyles[C] = {};
        if (cell.s) colStyles[C].s = { ...cell.s };
        if (cell.z) colStyles[C].z = cell.z;
      }
    }

    // Clear sample data VALUES from rows 3 onwards but preserve cell objects and styles
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let R = 2; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
        if (ws[cellRef]) {
          const style = ws[cellRef].s;
          const z = ws[cellRef].z;
          ws[cellRef] = { s: style, z: z };
        }
      }
    }

    // Populate actual payroll records starting at row 3 (0-indexed row 2)
    let rowIdx = 2;
    recordsToExport.forEach((rec) => {
      const empId = 'employeeId' in rec ? rec.employeeId : rec.employee.id;
      const emp = state.employees.find((e) => e.id === empId)!;
      const amount = 'data' in rec ? rec.data.takeHome : rec.takeHome;
      const rowNum = rowIdx + 1; // 1-indexed Excel row

      const rowStyle = colStyles[rowIdx - 2] || {};

      // A: Beneficiary Name (text)
      ws[`A${rowNum}`] = { t: 's', v: emp.name, s: rowStyle[0]?.s, z: rowStyle[0]?.z };
      // B: Beneficiary Account Number (text — preserve leading zeros, prevent scientific notation)
      ws[`B${rowNum}`] = { t: 's', v: emp.bankAccountNumber || '', s: rowStyle[1]?.s, z: rowStyle[1]?.z || '@' };
      // C: IFSC (text)
      ws[`C${rowNum}`] = { t: 's', v: emp.ifscCode || '', s: rowStyle[2]?.s, z: rowStyle[2]?.z };
      // D: Transaction Type — left blank (do not invent banking info)
      // E: Debit Account Number — left blank (not available)
      // F: Transaction Date (DD/MM/YYYY, text)
      ws[`F${rowNum}`] = { t: 's', v: transactionDate, s: rowStyle[5]?.s, z: rowStyle[5]?.z };
      // G: Amount (number)
      ws[`G${rowNum}`] = { t: 'n', v: amount, s: rowStyle[6]?.s, z: rowStyle[6]?.z };
      // H: Currency (text)
      ws[`H${rowNum}`] = { t: 's', v: 'INR', s: rowStyle[7]?.s, z: rowStyle[7]?.z };
      // I: Beneficiary Email ID (text)
      ws[`I${rowNum}`] = { t: 's', v: emp.email || '', s: rowStyle[8]?.s, z: rowStyle[8]?.z };
      // J: Remarks (text — employee code)
      ws[`J${rowNum}`] = { t: 's', v: emp.code || '', s: rowStyle[9]?.s, z: rowStyle[9]?.z };
      // K–O: Custom Headers — left blank (styles preserved from clearing step)

      rowIdx++;
    });

    // Update sheet range to include new data rows
    const lastRow = rowIdx; // 0-indexed, one past last written row
    const lastCol = 14; // O (15 columns, 0-indexed)
    ws['!ref'] = `A1:${XLSX.utils.encode_cell({ r: lastRow - 1, c: lastCol })}`;

    const fileName = `BLKPAY_${month.replace(/-/g, '')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const primary = (() => {
    switch (run.status) {
      case 'Draft':
      case 'Needs Review':
      case 'Calculated':
        return (
          <>
            <Button variant={run.status === 'Calculated' ? 'secondary' : 'primary'} icon={CalculatorIcon} loading={pending} onClick={() => mutate(cmd.calculatePayroll(month), 'Payroll calculated')}>{run.status === 'Draft' ? 'Calculate payroll' : 'Recalculate'}</Button>
            {run.status === 'Calculated' && <Button icon={CheckIcon} disabled={issues.length > 0} onClick={() => {setError(null);setConfirm('approve');}}>Approve payroll</Button>}
          </>);

      case 'Approved':
        return (
          <>
            <Button variant="secondary" icon={RotateCcwIcon} onClick={() => {setError(null);setConfirm('reopen');}}>Start correction</Button>
            <Button icon={BanknoteIcon} onClick={() => {setError(null);setCreditOpen(true);}}>Confirm salary credit</Button>
          </>);

      case 'Salary Credited':
        return <Button icon={FileTextIcon} onClick={() => {setError(null);setConfirm('generate');}}>Generate payslips</Button>;
      case 'Payslips Generated':
        return (
          <>
            {failed.length > 0 && <Button variant="secondary" icon={RotateCcwIcon} loading={pending} onClick={() => mutate(cmd.generatePayslips(month, true), 'Retried failed payslips')}>Retry failed</Button>}
            <Button icon={SendIcon} disabled={!generated} onClick={() => {setError(null);setConfirm('release');}}>Release {generated} payslip{generated !== 1 && 's'}</Button>
          </>);

      default:
        return <ButtonLink to="/management/payslips" icon={FileTextIcon}>View payslips</ButtonLink>;
    }
  })();

  return (
    <div>
      <PageHeader title="Payroll" description="Monthly payroll from approved salary structures, leave and reviewed working-hour shortfalls."
      actions={<><ButtonLink to="/management/payroll/salary-structures" icon={SettingsIcon}>Salary structures</ButtonLink><Button icon={DownloadIcon} onClick={exportToExcel}>Export Excel</Button>{primary}</>} />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Select aria-label="Payroll month" className="w-52" value={month} onChange={(e) => setMonth(e.target.value)}>
          {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </Select>
        <StatusBadge status={run.status} />
        {run.calculatedAt && <span className="text-xs text-ink-muted">Last calculated {fmtDateTime(run.calculatedAt)}</span>}
      </div>

      <Panel className="mb-6">
        <ol className="grid grid-cols-2 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
          {PAYROLL_STEPS.map((s, i) => {
            const done = i < stepIndex || run.status === 'Released';
            const current = i === stepIndex && run.status !== 'Released';
            const label = s === 'Calculated' && run.status === 'Needs Review' ? 'Needs Review' : s;
            return (
              <li key={s} className="flex items-center gap-2.5">
                <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tnum', done ? 'border-ok bg-ok text-white' : current ? run.status === 'Needs Review' ? 'border-warn bg-warn-bg text-warn' : 'border-brand-600 bg-brand-50 text-brand-700' : 'border-line-strong text-ink-faint')}>
                  {done ? <CheckIcon className="h-4 w-4" /> : i + 1}
                </span>
                <span className={cn('text-sm', current ? 'font-semibold' : done ? 'text-ink-2' : 'text-ink-muted')}>{label}</span>
              </li>);

          })}
        </ol>
      </Panel>

      <div className="space-y-3">
        {error && <Banner tone="bad" title="Not saved">{error}</Banner>}
        {!monthEnded && <Banner tone="warn" title="This month hasn’t ended">Attendance and shortfalls are still changing. Calculate after the month closes.</Banner>}
        {run.status === 'Approved' && <Banner tone="info" title="Salary not yet credited">Approval doesn’t mark salary as credited. Record the credit date once the bank transfer is complete.</Banner>}
        {failed.length > 0 && run.status === 'Payslips Generated' && <Banner tone="bad" title="Payslip generation failed">Could not generate for {failed.join(', ')} — bank details missing. <Link to="/management/payroll/salary-structures" className="font-medium underline">Fix salary structures</Link>, then retry.</Banner>}
        {run.creditDate && <Banner tone="ok">Salary credited on {fmtDate(run.creditDate)} by {run.creditedBy}{run.creditReference && ` · Ref ${run.creditReference}`}.</Banner>}
        {['Approved', 'Salary Credited', 'Payslips Generated', 'Released'].includes(run.status) && <Banner tone="neutral">Payroll is locked. Changes to shortfalls or leave for this month require a correction (before credit) or a payslip revision (after release).</Banner>}
      </div>

      <dl className="my-6 grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl border border-line bg-white p-5 sm:grid-cols-4 lg:grid-cols-7">
        {[
        ['Employees', snapshot ? currentSlips.length : records.length],
        ['Needs review', <span key="nr" className={issues.length ? 'text-warn' : ''}>{issues.length}</span>],
        ['Ready', (snapshot ? currentSlips.length : records.length) - issues.length],
        ['Shortfalls awaiting review', <span key="sa" className={pendingShortfalls ? 'text-warn' : ''}>{pendingShortfalls}</span>],
        ['Approved shortfall deductions', fmtINR(shortfallTotal)],
        ['Salary credit', run.creditDate ? 'Credited' : 'Not credited'],
        ['Payslips', `${released} released · ${generated} awaiting`]].
        map(([k, v]) =>
        <div key={String(k)}><dt className="text-xs text-ink-muted">{k}</dt><dd className="mt-0.5 text-base font-semibold tnum">{v}</dd></div>
        )}
      </dl>

      {snapshot ?
      <Panel title={`Generated payslips · ${monthLabel(month)}`} description="Finalised figures from the approved payroll. Select a payslip to preview it." flush>
          <Table>
            <thead><tr><Th>Employee</Th><Th>Version</Th><Th align="right">Gross</Th><Th align="right">Shortfall deduction</Th><Th align="right">Total deductions</Th><Th align="right">Take-home</Th><Th>Status</Th></tr></thead>
            <tbody>
              {currentSlips.map((p) =>
            <Tr key={p.id} onClick={() => navigate(`/management/payslips/${p.id}`)}>
                  <Td><p className="font-medium">{p.data.employee.name}</p><p className="text-xs text-ink-muted">{p.data.employee.code}</p></Td>
                  <Td>v{p.version}</Td>
                  <Td align="right">{fmtINR(p.data.gross)}</Td>
                  <Td align="right" className="text-ink-muted">{fmtINR(p.data.deductions.find((d) => d.label === 'Working-Hour Shortfall Deduction')?.amount ?? 0)}</Td>
                  <Td align="right">{fmtINR(p.data.totalDeduction)}</Td>
                  <Td align="right" className="font-semibold">{fmtINR(p.data.takeHome)}</Td>
                  <Td><StatusBadge status={p.status} /></Td>
                </Tr>
            )}
            </tbody>
          </Table>
        </Panel> :

      <Panel title={`Payroll records · ${monthLabel(month)}`} description="Select a record for the full calculation." flush>
        <Table>
          <thead><tr><Th>Employee</Th><Th align="right">Salary days</Th><Th align="right">LOP</Th><Th align="right">Gross</Th><Th align="right">Shortfall deduction</Th><Th align="right">Total deductions</Th><Th align="right">Take-home</Th><Th>Status</Th></tr></thead>
          <tbody>
            {records.map((r) =>
            <Tr key={r.employee.id} onClick={() => setOpen(r)}>
                <Td><p className="font-medium">{r.employee.name}</p><p className="text-xs text-ink-muted">{r.employee.code}{r.employee.status === 'Inactive' && ' · Inactive'}</p></Td>
                <Td align="right">{r.salaryDays}</Td>
                <Td align="right">{r.lopDays}</Td>
                <Td align="right">{fmtINR(r.gross)}</Td>
                <Td align="right" className={r.shortfall.approvedDeduction ? 'text-bad' : 'text-ink-muted'}>{fmtINR(r.shortfall.approvedDeduction)}</Td>
                <Td align="right">{fmtINR(r.totalDeduction)}</Td>
                <Td align="right" className="font-semibold">{fmtINR(r.takeHome)}</Td>
                <Td>{r.ready ? <Badge tone="ok">Ready</Badge> : <Badge tone="warn">{r.issues.length} issue{r.issues.length !== 1 && 's'}</Badge>}</Td>
              </Tr>
            )}
            <tr className="bg-canvas/60 font-semibold">
              <Td>Total</Td><Td /><Td /><Td align="right">{fmtINR(totals.g)}</Td><Td align="right">{fmtINR(shortfallTotal)}</Td><Td align="right">{fmtINR(totals.d)}</Td><Td align="right">{fmtINR(totals.t)}</Td><Td />
            </tr>
          </tbody>
        </Table>
      </Panel>
      }

      {run.history.length > 0 &&
      <Panel title="Payroll history" className="mt-6">
          <ol className="space-y-3 border-l border-line pl-4">
            {[...run.history].reverse().map((h, i) => <li key={i} className="text-sm"><p><span className="font-medium">{h.action}</span> <span className="text-ink-muted">by {h.by}</span></p><p className="text-xs text-ink-faint">{fmtDateTime(h.at)}{h.note && ` · ${h.note}`}</p></li>)}
          </ol>
        </Panel>
      }

      <PayrollRecordDrawer record={open} onClose={() => setOpen(null)} />
      <CreditModal open={creditOpen} onClose={() => setCreditOpen(false)} month={month} pending={pending} error={error}
      onConfirm={async (date, ref) => {if (await mutate(cmd.confirmCredit(month, date, ref), 'Salary credit recorded')) setCreditOpen(false);}} />
      <ConfirmDialog open={confirm === 'approve'} onClose={() => setConfirm(null)} title={`Approve ${monthLabel(month)} payroll?`} confirmLabel="Approve payroll" tone="success" pending={pending} error={error}
      body={<>You’re approving {records.length} records totalling <strong>{fmtINR(totals.t)}</strong> take-home, including {fmtINR(shortfallTotal)} in approved working-hour shortfall deductions. Approval locks the payroll but does not mark salary as credited.</>}
      onConfirm={async () => {if (await mutate(cmd.approvePayroll(month), 'Payroll approved')) setConfirm(null);}} />
      <ConfirmDialog open={confirm === 'generate'} onClose={() => setConfirm(null)} title="Generate final payslips?" confirmLabel="Generate payslips" pending={pending} error={error}
      body="Payslips are generated from the approved payroll. They stay private until you release them."
      onConfirm={async () => {if (await mutate(cmd.generatePayslips(month), 'Payslips generated')) setConfirm(null);}} />
      <ConfirmDialog open={confirm === 'release'} onClose={() => setConfirm(null)} title={`Release ${generated} payslip(s)?`} confirmLabel="Release to employees" tone="success" pending={pending} error={error}
      body="Each employee will be able to see and download only their own payslip. Released payslips can only be changed through a recorded revision."
      onConfirm={async () => {if (await mutate(cmd.releasePayslips(month), 'Payslips released')) setConfirm(null);}} />
      <ConfirmDialog open={confirm === 'reopen'} onClose={() => setConfirm(null)} title="Start a payroll correction?" confirmLabel="Start correction" requireReason reasonLabel="Correction reason" pending={pending} error={error}
      body="Payroll returns to review so records can be corrected and recalculated. The original approval stays in the history."
      onConfirm={async (reason) => {if (await mutate(cmd.reopenPayroll(month, reason), 'Correction started')) setConfirm(null);}} />
    </div>);

}

function CreditModal({ open, onClose, month, onConfirm, pending, error }: {open: boolean;onClose: () => void;month: string;onConfirm: (date: string, ref: string) => void;pending: boolean;error: string | null;}) {
  const [date, setDate] = useState(todayKey());
  const [ref, setRef] = useState('');
  const [ack, setAck] = useState(false);
  const [touched, setTouched] = useState(false);
  useEffect(() => {if (open) {setDate(todayKey());setRef('');setAck(false);setTouched(false);}}, [open]);
  const future = date > todayKey();
  return (
    <Modal open={open} onClose={onClose} title="Confirm salary credit" description={monthLabel(month)}
    footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={pending} onClick={() => {setTouched(true);if (date && ack && !future) onConfirm(date, ref.trim());}}>Record salary credit</Button></>}>
      <div className="space-y-4">
        <p className="text-sm text-ink-2">Only record this once salaries have actually been credited to employee bank accounts. Recording a credit here documents the transfer — it does not move any money.</p>
        <Field label="Credit date" required error={touched ? (!date ? 'Enter the credit date.' : future ? 'Credit date can’t be in the future.' : undefined) : undefined}>{(id) => <DatePicker id={id} value={date} max={todayKey()} onChange={setDate} invalid={touched && !!date && future} />}</Field>
        <Field label="Bank / transfer reference" hint="Optional">{(id) => <Input id={id} value={ref} onChange={(e) => setRef(e.target.value)} />}</Field>
        <Checkbox label="I confirm salaries for this month have been credited" checked={ack} onChange={setAck} />
        {touched && !ack && <p className="text-xs text-bad">Please confirm before recording.</p>}
        {error && <Banner tone="bad" title="Not saved">{error}</Banner>}
      </div>
    </Modal>);

}