import * as React from 'react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LockIcon } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Field, Input, Textarea } from '../../components/ui/Field';
import { DatePicker } from '../../components/ui/DatePicker';
import { Drawer } from '../../components/ui/Overlay';
import { Banner, PageHeader, Panel } from '../../components/ui/Primitives';
import { Table, Td, Th, Tr } from '../../components/ui/Table';
import { useData } from '../../contexts/DataContext';
import { useMutation } from '../../hooks/useMutation';
import type { Employee, SalaryStructure } from '@shared/types';
import { fmtINR, maskAccount } from '@shared/domain/currency';
import { grossOf } from '@shared/domain/payroll';
import { cmd } from '../../utils/commands';
import { fmtDate, todayKey } from '@shared/domain/time';

const earningFields: [keyof SalaryStructure['earnings'], string][] = [['basic', 'Basic & DA'], ['hra', 'HRA'], ['conveyance', 'Conveyance'], ['otherAllowances', 'Other allowances'], ['incentives', 'Incentives / other approved earnings']];
const deductionFields: [keyof SalaryStructure['deductions'], string][] = [['epf', 'EPF'], ['esi', 'ESI'], ['professionalTax', 'Professional Tax'], ['insurance', 'Insurance'], ['tds', 'TDS'], ['other', 'Other approved deductions']];

const blank = (employeeId: string): SalaryStructure => ({
  employeeId, effectiveFrom: todayKey(), ctcAnnual: 0, uan: '', esiNumber: '', dailyPayableAmount: null,
  earnings: { basic: 0, hra: 0, conveyance: 0, otherAllowances: 0, incentives: 0 },
  deductions: { epf: 0, esi: 0, professionalTax: 0, insurance: 0, tds: 0, other: 0 }, employerContribution: 0
});

export function SalaryStructuresPage() {
  const { state } = useData();
  const [params, setParams] = useSearchParams();
  const [editId, setEditId] = useState<string | null>(params.get('employee'));
  const close = () => {setEditId(null);if (params.get('employee')) setParams({});};
  return (
    <div>
      <PageHeader title="Salary Structures" back={{ to: '/management/payroll', label: 'Payroll' }}
      description="Values are configured per employee with an effective date. No salary amounts or statutory rates are hard-coded." />
      <Banner tone="neutral" className="mb-4" title="Restricted information">Bank details and salary structures are visible only to authorised payroll managers. Account numbers are masked by default.</Banner>
      <Panel flush>
        <Table>
          <thead><tr><Th>Employee</Th><Th>Effective from</Th><Th align="right">CTC (annual)</Th><Th align="right">Monthly gross</Th><Th align="right">Employee deductions</Th><Th>Bank</Th></tr></thead>
          <tbody>
            {state.employees.map((e) => {
              const ss = state.salary.find((s) => s.employeeId === e.id);
              return (
                <Tr key={e.id} onClick={() => setEditId(e.id)}>
                  <Td><p className="font-medium">{e.name}</p><p className="text-xs text-ink-muted">{e.code} · {e.designation}</p></Td>
                  <Td className="whitespace-nowrap">{ss ? fmtDate(ss.effectiveFrom) : <span className="text-warn">Not configured</span>}</Td>
                  <Td align="right">{ss ? fmtINR(ss.ctcAnnual) : '—'}</Td>
                  <Td align="right">{ss ? fmtINR(grossOf(ss)) : '—'}</Td>
                  <Td align="right">{ss ? fmtINR(Object.values(ss.deductions).reduce((a, b) => a + b, 0)) : '—'}</Td>
                  <Td className="whitespace-nowrap text-xs">{e.bankAccountNumber ? <span className="text-ink-muted">{e.bankName} · {maskAccount(e.bankAccountNumber)}</span> : <span className="font-medium text-bad">Missing</span>}</Td>
                </Tr>);

            })}
          </tbody>
        </Table>
      </Panel>
      <SalaryDrawer employee={state.employees.find((e) => e.id === editId) ?? null} onClose={close} />
    </div>);

}

function SalaryDrawer({ employee, onClose }: {employee: Employee | null;onClose: () => void;}) {
  const { state } = useData();
  const { mutate, pending, error, setError } = useMutation();
  const [f, setF] = useState<SalaryStructure | null>(null);
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!employee) return;
    const ss = state.salary.find((s) => s.employeeId === employee.id);
    setF(ss ? { ...ss, earnings: { ...ss.earnings }, deductions: { ...ss.deductions } } : { ...blank(employee.id), effectiveFrom: employee.joiningDate || todayKey() });
    setReason('');setTouched(false);setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee?.id]);
  if (!employee || !f) return <Drawer open={false} onClose={onClose} title=""><div /></Drawer>;
  const num = (v: string) => v === '' ? 0 : Number(v);
  const gross = grossOf(f);
  const ded = Object.values(f.deductions).reduce((a, b) => a + b, 0);
  const invalid = [...Object.values(f.earnings), ...Object.values(f.deductions), f.employerContribution, f.ctcAnnual].some((v) => Number.isNaN(v) || v < 0);
  const save = async () => {
    setTouched(true);
    if (!reason.trim() || invalid || !f.effectiveFrom) return;
    if (await mutate(cmd.saveSalary(f, reason), 'Salary structure saved')) onClose();
  };
  const money = (label: string, value: number, onChange: (v: number) => void) =>
  <Field label={label}>{(id) => <Input id={id} type="number" min={0} step="0.01" className="tnum" value={value} onChange={(e) => onChange(num(e.target.value))} />}</Field>;

  return (
    <Drawer open onClose={onClose} size="lg" title={`Salary structure · ${employee.name}`} description={`${employee.code} · ${employee.designation} · joined {employee.joiningDate ? fmtDate(employee.joiningDate) : 'N/A'}`}
    footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={pending} onClick={save}>Save structure</Button></>}>
      <div className="space-y-6">
        <section className="grid gap-4 sm:grid-cols-2">
          <Field label="Effective from" required>{(id) => <DatePicker id={id} value={f.effectiveFrom} onChange={(v) => setF({ ...f, effectiveFrom: v })} />}</Field>
          {money('CTC (annual, as configured)', f.ctcAnnual, (v) => setF({ ...f, ctcAnnual: v }))}
        </section>
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><LockIcon className="h-3.5 w-3.5" /> Bank & statutory details</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="EPF / UAN" hint="If applicable">{(id) => <Input id={id} value={f.uan ?? ''} onChange={(e) => setF({ ...f, uan: e.target.value })} />}</Field>
            <Field label="ESI number" hint="If applicable">{(id) => <Input id={id} value={f.esiNumber ?? ''} onChange={(e) => setF({ ...f, esiNumber: e.target.value })} />}</Field>
          </div>
          {!employee?.bankAccountNumber && <Banner tone="warn" className="mt-3">Payslips can’t be generated without bank details. Add them on the employee’s edit form.</Banner>}
        </section>
        <section className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Monthly earnings</h3>
            {earningFields.map(([k, label]) => <React.Fragment key={k}>{money(label, f.earnings[k], (v) => setF({ ...f, earnings: { ...f.earnings, [k]: v } }))}</React.Fragment>)}
            <p className="flex justify-between border-t border-line pt-2 text-sm font-semibold"><span>Gross</span><span className="tnum">{fmtINR(gross)}</span></p>
          </div>
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Monthly employee deductions</h3>
            {deductionFields.map(([k, label]) => <React.Fragment key={k}>{money(label, f.deductions[k], (v) => setF({ ...f, deductions: { ...f.deductions, [k]: v } }))}</React.Fragment>)}
            <p className="flex justify-between border-t border-line pt-2 text-sm font-semibold"><span>Fixed deductions</span><span className="tnum">{fmtINR(ded)}</span></p>
          </div>
        </section>
        <section className="grid gap-4 sm:grid-cols-2">
          {money('Employer contribution (monthly)', f.employerContribution, (v) => setF({ ...f, employerContribution: v }))}
          <Field label="Daily payable amount" hint="Only used if the ‘daily payable amount’ shortfall method is approved.">{(id) => <Input id={id} type="number" min={0} className="tnum" value={f.dailyPayableAmount ?? ''} onChange={(e) => setF({ ...f, dailyPayableAmount: e.target.value === '' ? null : Number(e.target.value) })} placeholder="Not configured" />}</Field>
        </section>
        <p className="rounded-lg bg-canvas p-3 text-xs text-ink-muted">Leave/LOP and working-hour shortfall deductions are calculated monthly from approved records and kept as separate lines — they’re not part of this fixed structure. Preview take-home before variable deductions: <strong className="text-ink tnum">{fmtINR(gross - ded)}</strong>.</p>
        <Field label="Reason for change" required error={touched && !reason.trim() ? 'A reason is required.' : undefined}>{(id) => <Textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
        {touched && invalid && <Banner tone="bad">Amounts must be zero or positive numbers.</Banner>}
        {error && <Banner tone="bad" title="Not saved">{error}</Banner>}
      </div>
    </Drawer>);

}