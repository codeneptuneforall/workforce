import { LogOutIcon } from 'lucide-react';
import { ChangePasswordForm } from '../../components/auth/ChangePasswordForm';
import { StatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Avatar, KeyValue, PageHeader, Panel } from '../../components/ui/Primitives';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { useCurrentEmployee } from '../../hooks/useCurrentEmployee';
import { fmtDate, fmtMin } from '@shared/domain/time';
import { workingDaysLabel } from '@shared/domain/compliance';

export function MyProfilePage() {
  const emp = useCurrentEmployee();
  const { state, team, personName } = useData();
  const { logout } = useAuth();
  return (
    <div>
      <PageHeader title="My Profile" description="To change personal or employment details, contact HR." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Panel>
            <div className="flex items-center gap-4">
              <Avatar name={emp.name} size="lg" />
              <div>
                <p className="text-lg font-semibold">{emp.name}</p>
                <p className="text-sm text-ink-muted">{emp.designation} · {emp.code}</p>
              </div>
              <StatusBadge status={emp.status} className="ml-auto" />
            </div>
            <dl className="mt-6 grid gap-5 sm:grid-cols-2">
              <KeyValue label="Work email" value={emp.email} />
              <KeyValue label="Phone" value={emp.phone ?? 'Not provided'} />
              <KeyValue label="Team" value={team(emp.teamId)?.name} />
              <KeyValue label="Reporting manager" value={personName(emp.managerId)} />
              <KeyValue label="Joining date" value={fmtDate(emp.joiningDate)} />
              <KeyValue label="Employee code" value={emp.code} />
            </dl>
          </Panel>
          <Panel title="Work schedule">
            <dl className="grid gap-5 sm:grid-cols-3">
              <KeyValue label="Schedule" value={emp.schedule} />
              <KeyValue label="Daily target" value={fmtMin(emp.dailyTargetMinutes)} />
              <KeyValue label="Working days" value={workingDaysLabel(emp, state.settings)} />
            </dl>
          </Panel>
        </div>
        <div className="space-y-6">
          <Panel title="Change password"><ChangePasswordForm /></Panel>
          <Button variant="secondary" icon={LogOutIcon} className="w-full" onClick={logout}>Sign out</Button>
        </div>
      </div>
    </div>);

}