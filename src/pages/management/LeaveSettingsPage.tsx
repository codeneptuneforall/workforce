import { LeaveSectionNav } from '../../components/leave/LeaveSectionNav';
import { LeaveSettingsForm } from '../../components/settings/LeaveSettingsForm';
import { PageHeader } from '../../components/ui/Primitives';

export function LeaveSettingsPage() {
  return (
    <div>
      <PageHeader title="Leave Management" description="Leave balances and paid/unpaid rules are never assumed — they apply only once configured here." />
      <LeaveSectionNav />
      <div className="max-w-3xl"><LeaveSettingsForm /></div>
    </div>);

}