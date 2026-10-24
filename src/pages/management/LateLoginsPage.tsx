import { PageHeader, Panel } from '../../components/ui/Primitives';
import { Table, Td, Th, Tr } from '../../components/ui/Table';
import { useData } from '../../contexts/DataContext';
import { fmtDateTime } from '@shared/domain/time';

export function LateLoginsPage() {
  const { state } = useData();
  const rows = [...(state.lateLoginHistory || [])].sort((a, b) => (a.at < b.at ? 1 : -1));
  const byEmp = new Map<string, number>();
  for (const r of rows) byEmp.set(r.employeeId, (byEmp.get(r.employeeId) ?? 0) + 1);
  return (
    <div>
      <PageHeader title="Late logins" description="Employees who signed in after 10:15, with their reason." />
      <Panel flush>
        <Table>
          <thead><tr><Th>Employee</Th><Th>Time</Th><Th>Reason</Th><Th align="right">Late this month</Th></tr></thead>
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
