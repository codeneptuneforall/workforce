import { useLocation, useNavigate } from 'react-router-dom';
import { useData } from '../../contexts/DataContext';
import { Tabs } from '../ui/Primitives';

type Section = 'requests' | 'calendar' | 'settings';

export function LeaveSectionNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { state } = useData();
  const current: Section = pathname.endsWith('/calendar') ? 'calendar' : pathname.endsWith('/settings') ? 'settings' : 'requests';
  return (
    <div className="mb-6">
      <Tabs<Section>
        value={current}
        onChange={(v) => navigate(`/management/leaves/${v}`)}
        tabs={[
        { id: 'requests', label: 'Approval queue', count: state.leaves.filter((l) => l.status === 'Pending Approval').length },
        { id: 'calendar', label: 'Leave calendar' },
        { id: 'settings', label: 'Leave policy' }]
        } />
      
    </div>);

}