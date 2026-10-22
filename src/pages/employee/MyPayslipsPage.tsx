import { useState } from 'react';
import { DownloadIcon, EyeIcon, ReceiptIcon } from 'lucide-react';
import { PayslipViewer } from '../../components/payslip/PayslipViewer';
import { StatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState, PageHeader, Panel } from '../../components/ui/Primitives';
import { Table, Td, Th, Tr } from '../../components/ui/Table';
import { useData } from '../../contexts/DataContext';
import { useCurrentEmployee } from '../../hooks/useCurrentEmployee';
import type { Payslip } from '@shared/types';
import { fmtINR } from '@shared/domain/currency';
import { monthLabel } from '@shared/domain/payroll';
import { fmtDateTime } from '@shared/domain/time';

export function MyPayslipsPage() {
  const emp = useCurrentEmployee();
  const { state } = useData();
  const [open, setOpen] = useState<Payslip | null>(null);
  // Only released payslips belonging to the signed-in employee are ever exposed here.
  const released = state.payslips.
  filter((p) => p.employeeId === emp.id && p.status === 'Released').
  sort((a, b) => a.month < b.month ? 1 : -1);

  return (
    <div>
      <PageHeader title="My Payslips" description="Payslips appear here once payroll is approved, salary is credited and management releases them." />
      <Panel flush>
        {released.length === 0 ?
        <EmptyState icon={ReceiptIcon} title="No payslips available yet." body="You’ll be notified when your first payslip is released." /> :

        <Table>
            <thead><tr><Th>Month</Th><Th align="right">Gross salary</Th><Th align="right">Total deductions</Th><Th align="right">Take-home</Th><Th>Released</Th><Th>Status</Th><Th /></tr></thead>
            <tbody>
              {released.map((p) =>
            <Tr key={p.id}>
                  <Td className="whitespace-nowrap font-medium">{monthLabel(p.month)}{p.version > 1 && <span className="ml-2 text-xs font-normal text-ink-muted">Revised v{p.version}</span>}</Td>
                  <Td align="right">{fmtINR(p.data.gross)}</Td>
                  <Td align="right">{fmtINR(p.data.totalDeduction)}</Td>
                  <Td align="right" className="font-semibold">{fmtINR(p.data.takeHome)}</Td>
                  <Td className="whitespace-nowrap text-ink-muted">{p.releasedAt ? fmtDateTime(p.releasedAt) : '—'}</Td>
                  <Td><StatusBadge status={p.status} /></Td>
                  <Td align="right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" icon={EyeIcon} onClick={() => setOpen(p)}>View</Button>
                      <Button size="sm" variant="ghost" icon={DownloadIcon} onClick={() => setOpen(p)} aria-label={`Download ${monthLabel(p.month)} payslip`}>PDF</Button>
                    </div>
                  </Td>
                </Tr>
            )}
            </tbody>
          </Table>
        }
      </Panel>
      <PayslipViewer payslip={open} onClose={() => setOpen(null)} />
    </div>);

}