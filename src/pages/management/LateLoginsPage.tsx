import { useState } from 'react';
import { PageHeader, Panel } from '../../components/ui/Primitives';
import { Select } from '../../components/ui/Field';
import { Table, Td, Th, Tr } from '../../components/ui/Table';
import { useData } from '../../contexts/DataContext';
import { DatePicker } from '../../components/ui/DatePicker';
import { fmtDateTime } from '@shared/domain/time';

export function LateLoginsPage() {
  const { state } = useData();
  const [empId, setEmpId] = useState('');
  const [date, setDate] = useState('');
  const rows = (state.lateLoginHistory || [])
    .filter((r) => !empId || r.employeeId === empId)
    .filter((r) => !date || r.at.startsWith(date))
    .sort((a, b) => (a.at < b.at ? 1 : -1));

  // Late count is per month: when a date is picked, count that employee's
  // lates for the whole month (e.g. picking Oct 23 shows all October lates).
  // Otherwise count all lates.
  const monthPrefix = date ? date.slice(0, 7) : '';
  const countSource = (state.lateLoginHistory || []).filter((r) =>
    !monthPrefix || r.at.startsWith(monthPrefix)
  ).filter((r) => !empId || r.employeeId === empId);
  const byEmp = new Map<string, number>();
  for (const r of countSource) byEmp.set(r.employeeId, (byEmp.get(r.employeeId) ?? 0) + 1);
  return (
    <div>
      <PageHeader title="Late logins" description="Employees who signed in after 10:15, with their reason." />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[220px]">
          <label className="mb-1 block text-xs font-medium text-ink-muted">Employee</label>
          <Select aria-label="Employee" value={empId} onChange={(e) => setEmpId(e.target.value)}>
            <option value="">All employees</option>
            {state.employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </Select>
        </div>
        <div className="min-w-[200px]">
          <label className="mb-1 block text-xs font-medium text-ink-muted">Date</label>
          <DatePicker value={date} onChange={setDate} placeholder="Select date" />
        </div>
        {(empId || date) && <button type="button" onClick={() => { setEmpId(''); setDate(''); }} className="self-end rounded-lg border border-line px-3 py-2 text-sm text-ink-muted hover:text-ink">Clear</button>}
      </div>
      <Panel flush>
        <Table>
          <thead><tr><Th>Employee</Th><Th>Time</Th><Th>Reason</Th><Th align="right">Late count (this month)</Th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><Td colSpan={4} className="py-8 text-center text-ink-muted">No late logins recorded.</Td></tr>}
            {rows.map((r) => (
              <Tr key={r.id}>
                <Td className="font-medium">{r.name}</Td>
                <Td className="whitespace-nowrap text-ink-muted">{fmtDateTime(r.at)}</Td>
                <Td>{r.reason}</Td>
                <Td align="right">{byEmp.get(r.employeeId) ?? 0}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Panel>
    </div>
  );
}


