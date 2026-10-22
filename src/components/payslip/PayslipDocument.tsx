import type { PayslipData } from '@shared/types';
import { fmtINR, rupeesInWords } from '@shared/domain/currency';
import { monthLabel } from '@shared/domain/payroll';
import { fmtDate } from '@shared/domain/time';
import { Logo } from '../ui/Logo';

interface Props {
  data: PayslipData;
  version?: number;
  generatedAt?: string;
  watermark?: string;
}

export function PayslipDocument({ data, version, watermark }: Props) {
  const deductions = data.deductions.filter((d) => d.amount > 0 || !['Working-Hour Shortfall Deduction', 'Other Deductions'].includes(d.label));
  const rows = Math.max(data.earnings.length, deductions.length);
  const details: [string, string][] = [
  ['Employee Name', data.employee.name],
  ['Employee Code', data.employee.code],
  ['Designation', data.employee.designation],
  ['Date of Joining', fmtDate(data.employee.joiningDate, 'dd MMM yyyy')],
  ['Bank Name', data.employee.bankName || '—'],
  ['Bank Account No.', data.employee.accountMasked],
  ['EPF / UAN No.', data.employee.uan || 'Not applicable'],
  ['ESI No.', data.employee.esi || 'Not applicable'],
  ['CTC (Annual)', fmtINR(data.ctcAnnual)],
  ['Salary for Days', String(data.salaryDays)],
  ['LOP Days', String(data.lopDays)],
  ['Pay Period', monthLabel(data.month)]];


  return (
    <article className="print-area relative mx-auto w-full max-w-[794px] bg-white p-6 text-[12px] leading-relaxed text-ink sm:p-10" aria-label={`Payslip ${monthLabel(data.month)}`}>
      {watermark &&
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
          <span className="-rotate-12 text-6xl font-bold uppercase tracking-widest text-ink/5">{watermark}</span>
        </div>
      }
      <header className="flex flex-col gap-4 border-b-2 border-brand-700 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <Logo />
        <div className="sm:text-right">
          <p className="text-[15px] font-bold tracking-wide text-brand-800">{data.companyName}</p>
          <p className="max-w-sm text-[11px] text-ink-muted sm:ml-auto">{data.companyAddress}</p>
        </div>
      </header>
      <h2 className="mt-4 text-center text-[13px] font-semibold">Payslip for the month of {monthLabel(data.month)}</h2>

      <dl className="mt-4 grid grid-cols-1 border border-line sm:grid-cols-2">
        {details.map(([k, v], i) =>
        <div key={k} className={`flex justify-between gap-3 border-line px-3 py-1.5 ${i % 2 === 0 ? 'sm:border-r' : ''} ${i < details.length - (details.length % 2 === 0 ? 2 : 1) ? 'border-b' : 'border-b sm:border-b-0'}`}>
            <dt className="text-ink-muted">{k}</dt>
            <dd className="text-right font-medium">{v}</dd>
          </div>
        )}
      </dl>

      <table className="mt-5 w-full border-collapse border border-line">
        <thead>
          <tr className="bg-brand-50 text-left text-[11px] font-semibold text-brand-800">
            <th className="border border-line px-3 py-2">Earnings</th>
            <th className="border border-line px-3 py-2 text-right">Amount (₹)</th>
            <th className="border border-line px-3 py-2">Deductions</th>
            <th className="border border-line px-3 py-2 text-right">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => {
            const e = data.earnings[i];
            const d = deductions[i];
            const highlight = d?.label === 'Working-Hour Shortfall Deduction';
            return (
              <tr key={i}>
                <td className="border-x border-line px-3 py-1.5">{e?.label ?? ''}</td>
                <td className="border-x border-line px-3 py-1.5 text-right tnum">{e ? fmtINR(e.amount, false) : ''}</td>
                <td className={`border-x border-line px-3 py-1.5 ${highlight ? 'font-medium text-bad' : ''}`}>{d?.label ?? ''}</td>
                <td className={`border-x border-line px-3 py-1.5 text-right tnum ${highlight ? 'font-medium text-bad' : ''}`}>{d ? fmtINR(d.amount, false) : ''}</td>
              </tr>);

          })}
          <tr className="border-t border-line font-semibold">
            <td className="border border-line px-3 py-2">Gross Salary</td>
            <td className="border border-line px-3 py-2 text-right tnum">{fmtINR(data.gross, false)}</td>
            <td className="border border-line px-3 py-2">Total Deduction</td>
            <td className="border border-line px-3 py-2 text-right tnum">{fmtINR(data.totalDeduction, false)}</td>
          </tr>
          <tr>
            <td className="border border-line px-3 py-1.5 text-ink-muted">Employer Contribution</td>
            <td className="border border-line px-3 py-1.5 text-right tnum text-ink-muted">{fmtINR(data.employerContribution, false)}</td>
            <td className="border border-line px-3 py-1.5" colSpan={2} rowSpan={2}>
              <p className="text-[11px] text-ink-muted">Employer contribution is part of CTC and is not deducted from take-home pay.</p>
            </td>
          </tr>
          <tr>
            <td className="border border-line px-3 py-1.5 text-ink-muted">CTC (Monthly)</td>
            <td className="border border-line px-3 py-1.5 text-right tnum text-ink-muted">{fmtINR(data.ctcMonthly, false)}</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-5 flex flex-col gap-1 rounded border border-brand-200 bg-brand-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] text-brand-800">Take Home (Gross Salary − Total Deduction)</p>
          <p className="text-[11px] italic text-ink-muted">{rupeesInWords(data.takeHome)}</p>
        </div>
        <p className="text-lg font-bold text-brand-800 tnum">{fmtINR(data.takeHome)}</p>
      </div>

      <footer className="mt-8 flex flex-col gap-1 border-t border-line pt-3 text-[10px] text-ink-muted sm:flex-row sm:justify-between">
        <p>{data.confidentialityNote}</p>
        {version !== undefined && <p className="tnum">Version {version}</p>}
      </footer>
    </article>);

}