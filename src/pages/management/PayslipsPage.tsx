import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ReceiptIcon } from 'lucide-react';
import { StatusBadge } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Field';
import { EmptyState, PageHeader, Panel } from '../../components/ui/Primitives';
import { Table, Td, Th, Tr } from '../../components/ui/Table';
import { useData } from '../../contexts/DataContext';
import { fmtINR } from '@shared/domain/currency';
import { monthLabel } from '@shared/domain/payroll';
import { fmtDateTime } from '@shared/domain/time';

export function PayslipsPage() {
  const { state } = useData();
  const navigate = useNavigate();
  const months = [...new Set(state.payslips.map((p) => p.month))].sort().reverse();
  const [month, setMonth] = useState('');
  const [status, setStatus] = useState('current');
  const rows = state.payslips.
  filter((p) => (!month || p.month === month) && (status === 'current' ? p.status !== 'Superseded' : !status || p.status === status)).
  sort((a, b) => a.month < b.month ? 1 : a.month > b.month ? -1 : a.data.employee.name.localeCompare(b.data.employee.name));
  const awaiting = state.payslips.filter((p) => p.status === 'Generated').length;

  return (
    <div>
      <PageHeader title="Payslips" description={`${awaiting} awaiting release. Generate and release payslips from Payroll; revise released payslips here.`} />
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:w-[480px]">
        <Select aria-label="Month" value={month} onChange={(e) => setMonth(e.target.value)}><option value="">All months</option>{months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}</Select>
        <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="current">Current versions</option><option value="">All versions</option><option>Generated</option><option>Released</option><option>Superseded</option></Select>
      </div>
      <Panel flush>
        {rows.length === 0 ? <EmptyState icon={ReceiptIcon} title="No payslips match" /> :
        <Table>
            <thead><tr><Th>Employee</Th><Th>Month</Th><Th>Version</Th><Th align="right">Gross</Th><Th align="right">Deductions</Th><Th align="right">Take-home</Th><Th>Generated</Th><Th>Released</Th><Th>Status</Th></tr></thead>
            <tbody>
              {rows.map((p) =>
            <Tr key={p.id} onClick={() => navigate(`/management/payslips/${p.id}`)}>
                  <Td><p className="font-medium">{p.data.employee.name}</p><p className="text-xs text-ink-muted">{p.data.employee.code}</p></Td>
                  <Td className="whitespace-nowrap">{monthLabel(p.month)}</Td>
                  <Td>v{p.version}</Td>
                  <Td align="right">{fmtINR(p.data.gross)}</Td>
                  <Td align="right">{fmtINR(p.data.totalDeduction)}</Td>
                  <Td align="right" className="font-semibold">{fmtINR(p.data.takeHome)}</Td>
                  <Td className="whitespace-nowrap text-xs text-ink-muted">{fmtDateTime(p.generatedAt)}</Td>
                  <Td className="whitespace-nowrap text-xs text-ink-muted">{p.releasedAt ? fmtDateTime(p.releasedAt) : '—'}</Td>
                  <Td><StatusBadge status={p.status} /></Td>
                </Tr>
            )}
            </tbody>
          </Table>
        }
      </Panel>
    </div>);

}