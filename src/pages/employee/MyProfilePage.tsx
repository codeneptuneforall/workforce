import { LogOutIcon } from 'lucide-react';
import { ChangePasswordForm } from '../../components/auth/ChangePasswordForm';
import { StatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Avatar, KeyValue, PageHeader, Panel, Banner } from '../../components/ui/Primitives';
import { ProfilePictureUpload } from '../../components/ui/ProfilePictureUpload';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { useCurrentEmployee } from '../../hooks/useCurrentEmployee';
import { useMutation } from '../../hooks/useMutation';
import { fmtDate, fmtMin } from '@shared/domain/time';
import { workingDaysLabel } from '@shared/domain/compliance';
import { cmd } from '../../utils/commands';

export function MyProfilePage() {
  const emp = useCurrentEmployee();
  const { state, team, personName } = useData();
  const { logout } = useAuth();
  const { mutate, error } = useMutation();

  const handlePhotoUpload = async (url: string) => {
    if (!emp) return;
    const updated = { ...emp, photoUrl: url };
    const ok = await mutate(cmd.saveEmployee(updated), 'Profile picture updated');
    if (!ok) return; // Don't reload if save failed — error is shown by DataContext
    window.location.reload();
  };

  return (
    <div>
      <PageHeader title="My Profile" description="Update your profile picture. Contact HR to change other personal or employment details." />
      {error && <Banner tone="bad">{error}</Banner>}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Panel title="Personal Information">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              <div className="flex flex-col items-center gap-2">
                <Avatar name={emp.name} size="lg" src={emp.photoUrl} />
                <ProfilePictureUpload currentPhotoUrl={emp.photoUrl} onUpload={handlePhotoUpload} size="lg" />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <p className="text-lg font-semibold">{emp.name}</p>
                <p className="text-sm text-ink-muted">{emp.designation} · {emp.code}</p>
                <StatusBadge status={emp.status} className="mt-2" />
              </div>
            </div>
            <dl className="mt-6 grid gap-5 sm:grid-cols-2">
              <KeyValue label="Work email" value={emp.email} />
              <KeyValue label="Phone" value={emp.phone ?? 'Not provided'} />
              <KeyValue label="Date of birth" value={emp.dateOfBirth ? fmtDate(emp.dateOfBirth) : 'Not provided'} />
              <KeyValue label="Blood group" value={emp.bloodGroup ?? 'Not provided'} />
              <KeyValue label="Emergency contact" value={emp.emergencyNumber ?? 'Not provided'} />
              <KeyValue label="Address" value={emp.address ?? 'Not provided'} />
            </dl>
          </Panel>
          <Panel title="Bank Details">
            <dl className="grid gap-5 sm:grid-cols-2">
              <KeyValue label="Bank name" value={emp.bankName ?? 'Not provided'} />
              <KeyValue label="Account number" value={emp.bankAccountNumber ?? 'Not provided'} />
              <KeyValue label="IFSC code" value={emp.ifscCode ?? 'Not provided'} />
              <KeyValue label="Branch name" value={emp.branchName ?? 'Not provided'} />
              <KeyValue label="Beneficiary name" value={emp.beneficiaryName ?? 'Not provided'} />
            </dl>
          </Panel>
          <Panel title="Employment Details">
            <dl className="grid gap-5 sm:grid-cols-2">
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