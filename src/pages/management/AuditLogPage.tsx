import { useState } from 'react';
import { ScrollTextIcon, SearchIcon } from 'lucide-react';
import { Input, Select } from '../../components/ui/Field';
import { Drawer } from '../../components/ui/Overlay';
import { Banner, EmptyState, KeyValue, PageHeader, Panel } from '../../components/ui/Primitives';
import { Table, Td, Th, Tr } from '../../components/ui/Table';
import { useData } from '../../contexts/DataContext';
import type { AuditEntry } from '@shared/types';
import { fmtDateTime } from '@shared/domain/time';

export function AuditLogPage() {
  const { state } = useData();
  const [entity, setEntity] = useState('');
  const [actor, setActor] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<AuditEntry | null>(null);
  const entities = [...new Set(state.audit.map((a) => a.entity))].sort();
  const actors = [...new Set(state.audit.map((a) => a.actor))].sort();
  const s = q.trim().toLowerCase();
  const rows = state.audit.filter((a) => (!entity || a.entity === entity) && (!actor || a.actor === actor) && (!s || [a.action, a.entityId, a.reason, a.previous, a.next].some((v) => v?.toLowerCase().includes(s))));

  return (
    <div>
      <PageHeader title="Audit Log" description={`${state.audit.length} recorded events`} />
      <Banner tone="neutral" className="mb-4">Audit entries are append-only. They can’t be edited or deleted from the application.</Banner>
      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_200px_200px]">
        <div className="relative"><SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" /><Input aria-label="Search audit log" placeholder="Search actions, records or reasons" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Select aria-label="Record type" value={entity} onChange={(e) => setEntity(e.target.value)}><option value="">All record types</option>{entities.map((x) => <option key={x}>{x}</option>)}</Select>
        <Select aria-label="Actor" value={actor} onChange={(e) => setActor(e.target.value)}><option value="">All people</option>{actors.map((x) => <option key={x}>{x}</option>)}</Select>
      </div>
      <Panel flush>
        {rows.length === 0 ? <EmptyState icon={ScrollTextIcon} title="No events match" /> :
        <Table>
            <thead><tr><Th>When</Th><Th>Actor</Th><Th>Action</Th><Th>Record</Th><Th className="hidden lg:table-cell">Change</Th><Th className="hidden md:table-cell">Reason</Th></tr></thead>
            <tbody>
              {rows.map((a) =>
            <Tr key={a.id} onClick={() => setOpen(a)}>
                  <Td className="whitespace-nowrap text-xs text-ink-muted">{fmtDateTime(a.at)}</Td>
                  <Td className="whitespace-nowrap">{a.actor}</Td>
                  <Td className="font-medium">{a.action}</Td>
                  <Td><p className="text-xs text-ink-muted">{a.entity}</p><p className="max-w-[220px] truncate">{a.entityId}</p></Td>
                  <Td className="hidden max-w-[280px] text-xs lg:table-cell">{a.previous || a.next ? <span className="line-clamp-2"><span className="text-ink-muted">{a.previous ?? '—'}</span> → <span>{a.next ?? '—'}</span></span> : '—'}</Td>
                  <Td className="hidden max-w-[220px] truncate text-xs text-ink-muted md:table-cell">{a.reason ?? '—'}</Td>
                </Tr>
            )}
            </tbody>
          </Table>
        }
      </Panel>
      <Drawer open={!!open} onClose={() => setOpen(null)} title={open?.action ?? ''} description={open && fmtDateTime(open.at)}>
        {open &&
        <dl className="space-y-4">
            <KeyValue label="Actor" value={open.actor} />
            <KeyValue label="Record" value={`${open.entity} · ${open.entityId}`} />
            <KeyValue label="Previous value" value={<span className="whitespace-pre-wrap break-words font-normal">{open.previous ?? '—'}</span>} />
            <KeyValue label="New value" value={<span className="whitespace-pre-wrap break-words font-normal">{open.next ?? '—'}</span>} />
            <KeyValue label="Reason" value={<span className="font-normal">{open.reason ?? '—'}</span>} />
            <KeyValue label="Event ID" value={<span className="font-mono text-xs">{open.id}</span>} />
          </dl>
        }
      </Drawer>
    </div>);

}