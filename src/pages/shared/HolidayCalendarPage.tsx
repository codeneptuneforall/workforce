import { useEffect, useState } from 'react';
import { format, getDay } from 'date-fns';
import { CalendarDaysIcon, CopyIcon, PencilIcon, PlusIcon, Trash2Icon, UploadIcon } from 'lucide-react';
import { DateStepper } from '../../components/shared/DateStepper';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Field, Input, Select, Textarea } from '../../components/ui/Field';
import { DatePicker } from '../../components/ui/DatePicker';
import { Modal } from '../../components/ui/Overlay';
import { Banner, EmptyState, PageHeader, Panel, Segmented } from '../../components/ui/Primitives';
import { Table, Td, Th, Tr } from '../../components/ui/Table';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { useMutation } from '../../hooks/useMutation';
import { useNow } from '../../hooks/useNow';
import type { Holiday, HolidayType } from '@shared/types';
import { cn } from '../../utils/cn';
import { uid } from '@shared/domain/random';
import { cmd } from '../../utils/commands';
import { fmtDate, fromDateKey, monthDates, todayKey } from '@shared/domain/time';

const typeStyle: Record<HolidayType, {cell: string;badge: 'brand' | 'info' | 'neutral';label: string;}> = {
  Government: { cell: 'bg-brand-700 text-white', badge: 'brand', label: 'Government / Public' },
  Company: { cell: 'bg-info text-white', badge: 'info', label: 'Company' },
  Optional: { cell: 'bg-white text-ink ring-1 ring-inset ring-ink-faint', badge: 'neutral', label: 'Optional' }
};

export function HolidayCalendarPage() {
  const { user } = useAuth();
  const { state } = useData();
  const isMgmt = user?.role === 'management';
  const now = useNow(60000);
  const today = todayKey(now);
  const [year, setYear] = useState(new Date(now).getFullYear());
  const [view, setView] = useState<'year' | 'list'>('year');
  const [editing, setEditing] = useState<Holiday | null>(null);
  const [deleting, setDeleting] = useState<Holiday | null>(null);
  const { mutate, pending, error, setError } = useMutation();

  const all = state.holidays.filter((h) => h.date.startsWith(String(year)) && (isMgmt || h.status === 'Published')).sort((a, b) => a.date < b.date ? -1 : 1);
  const drafts = all.filter((h) => h.status === 'Draft');
  const upcoming = state.holidays.filter((h) => h.status === 'Published' && h.date >= today).sort((a, b) => a.date < b.date ? -1 : 1).slice(0, 5);
  const byDate = new Map(all.map((h) => [h.date, h]));

  const blank = (): Holiday => ({ id: uid('h'), name: '', date: `${year}-01-01`, type: 'Government', description: '', status: 'Draft' });

  return (
    <div>
      <PageHeader
        title="Holiday Calendar"
        description={isMgmt ? 'Verify every date against the official notification before publishing. Published holidays never generate an 8-hour shortfall.' : 'Recognised holidays don’t count against your daily working-hour target.'}
        actions={isMgmt &&
        <>
            <Button variant="secondary" icon={CopyIcon} loading={pending} onClick={() => mutate(cmd.copyHolidayYear(year - 1, year), `Copied ${year - 1} as draft`)}>Copy {year - 1} as draft</Button>
            <Button icon={PlusIcon} onClick={() => {setError(null);setEditing(blank());}}>Add holiday</Button>
          </>
        } />
      
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <DateStepper label={String(year)} onPrev={() => setYear((y) => y - 1)} onNext={() => setYear((y) => y + 1)} />
        <div className="flex flex-wrap items-center gap-3">
          <div className="hidden items-center gap-3 text-xs text-ink-muted sm:flex">
            {(Object.keys(typeStyle) as HolidayType[]).map((t) => <span key={t} className="flex items-center gap-1.5"><span className={cn('h-3 w-3 rounded', typeStyle[t].cell)} />{typeStyle[t].label}</span>)}
          </div>
          <Segmented label="View" value={view} onChange={setView} options={[{ value: 'year', label: 'Year' }, { value: 'list', label: 'List' }]} />
        </div>
      </div>
      {error && !editing && !deleting && <Banner tone="bad" title="Not saved" className="mb-4">{error}</Banner>}
      {isMgmt && drafts.length > 0 &&
      <Banner tone="warn" title={`${drafts.length} draft holiday(s) for ${year}`} className="mb-4"
      action={<Button size="sm" icon={UploadIcon} loading={pending} onClick={() => mutate(cmd.publishHolidayYear(year), 'Holidays published')}>Verify & publish</Button>}>
          Drafts aren’t visible to employees and don’t affect attendance until published.
        </Banner>
      }

      <div className="grid gap-6 lg:grid-cols-4">
        <div className="lg:col-span-3">
          {view === 'year' ?
          <Panel>
              <div className="grid gap-x-6 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 12 }).map((_, m) => {
                const key = `${year}-${String(m + 1).padStart(2, '0')}`;
                const dates = monthDates(key);
                const lead = (getDay(fromDateKey(dates[0])) + 6) % 7;
                return (
                  <div key={key}>
                      <p className="mb-2 text-sm font-semibold">{format(fromDateKey(`${key}-01`), 'MMMM')}</p>
                      <div className="grid grid-cols-7 gap-1 text-center text-[11px]">
                        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i} className="text-ink-faint">{d}</span>)}
                        {Array.from({ length: lead }).map((_, i) => <span key={`b${i}`} />)}
                        {dates.map((d) => {
                        const h = byDate.get(d);
                        const weekend = [0, 6].includes(fromDateKey(d).getDay());
                        return (
                          <button
                            key={d}
                            disabled={!h}
                            onClick={() => h && isMgmt && (setError(null), setEditing(h))}
                            title={h ? `${h.name} · ${h.type}${h.status === 'Draft' ? ' (draft)' : ''}` : undefined}
                            className={cn('flex h-7 items-center justify-center rounded tnum', h ? typeStyle[h.type].cell : weekend ? 'text-ink-faint' : 'text-ink-2', h?.status === 'Draft' && 'opacity-50', d === today && !h && 'font-bold text-brand-700 ring-1 ring-brand-300', !h && 'cursor-default')}>
                            
                              {Number(d.slice(8))}
                            </button>);

                      })}
                      </div>
                    </div>);

              })}
              </div>
            </Panel> :

          <Panel flush>
              {all.length === 0 ?
            <EmptyState icon={CalendarDaysIcon} title={`No holidays for ${year}`} body={isMgmt ? 'Add holidays from the official notification, or copy last year as a draft.' : 'Management hasn’t published this year’s calendar yet.'} /> :

            <Table>
                  <thead><tr><Th>Date</Th><Th>Holiday</Th><Th>Type</Th>{isMgmt && <Th>Status</Th>}{isMgmt && <Th />}</tr></thead>
                  <tbody>
                    {all.map((h) => {
                  const dup = all.filter((x) => x.date === h.date).length > 1;
                  return (
                    <Tr key={h.id}>
                          <Td className="whitespace-nowrap"><p className="font-medium">{fmtDate(h.date, 'd MMM yyyy')}</p><p className="text-xs text-ink-muted">{fmtDate(h.date, 'EEEE')}</p></Td>
                          <Td><p className="font-medium">{h.name}</p>{h.description && <p className="text-xs text-ink-muted">{h.description}</p>}{dup && <p className="text-xs text-warn">Another holiday shares this date</p>}</Td>
                          <Td><Badge tone={typeStyle[h.type].badge}>{h.type}</Badge></Td>
                          {isMgmt && <Td><StatusBadge status={h.status} /></Td>}
                          {isMgmt &&
                      <Td align="right">
                              <div className="flex justify-end gap-1">
                                <Button size="sm" variant="ghost" icon={PencilIcon} onClick={() => {setError(null);setEditing(h);}} aria-label={`Edit ${h.name}`} />
                                <Button size="sm" variant="ghost" icon={Trash2Icon} onClick={() => {setError(null);setDeleting(h);}} aria-label={`Delete ${h.name}`} />
                              </div>
                            </Td>
                      }
                        </Tr>);

                })}
                  </tbody>
                </Table>
            }
            </Panel>
          }
        </div>
        <Panel title="Upcoming" className="self-start">
          {upcoming.length === 0 ? <p className="text-sm text-ink-muted">No upcoming holidays.</p> :
          <ul className="space-y-3">
              {upcoming.map((h) =>
            <li key={h.id} className="flex items-start gap-3">
                  <div className="w-10 shrink-0 rounded-md border border-line text-center">
                    <p className="text-[10px] uppercase text-ink-muted">{fmtDate(h.date, 'MMM')}</p>
                    <p className="text-sm font-semibold tnum">{fmtDate(h.date, 'd')}</p>
                  </div>
                  <div className="min-w-0"><p className="text-sm font-medium">{h.name}</p><p className="text-xs text-ink-muted">{fmtDate(h.date, 'EEEE')} · {h.type}</p></div>
                </li>
            )}
            </ul>
          }
        </Panel>
      </div>

      {isMgmt && <HolidayFormModal holiday={editing} onClose={() => setEditing(null)} all={state.holidays} pending={pending} error={error}
      onSave={async (h) => {if (await mutate(cmd.saveHoliday(h), 'Holiday saved')) setEditing(null);}}
      onDelete={(h) => {setEditing(null);setDeleting(h);}} />}
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} title="Delete holiday?" tone="danger" confirmLabel="Delete" pending={pending} error={error}
      body={<>Remove <strong>{deleting?.name}</strong> on {deleting && fmtDate(deleting.date, 'd MMM yyyy')}? Attendance for this date will be recalculated against the normal target.</>}
      onConfirm={async () => {if (deleting && (await mutate(cmd.deleteHoliday(deleting.id), 'Holiday deleted'))) setDeleting(null);}} />
    </div>);

}

function HolidayFormModal({ holiday, onClose, all, onSave, onDelete, pending, error }: {holiday: Holiday | null;onClose: () => void;all: Holiday[];onSave: (h: Holiday) => void;onDelete: (h: Holiday) => void;pending: boolean;error: string | null;}) {
  const [form, setForm] = useState<Holiday | null>(holiday);
  const [touched, setTouched] = useState(false);
  useEffect(() => {setForm(holiday);setTouched(false);}, [holiday]);
  const isExisting = !!holiday && all.some((h) => h.id === holiday.id);
  const dup = form ? all.find((h) => h.id !== form.id && h.date === form.date) : undefined;
  const weekend = form?.date ? [0, 6].includes(fromDateKey(form.date).getDay()) : false;
  const nameErr = touched && !form?.name.trim() ? 'Enter a name.' : undefined;
  return (
    <Modal open={!!holiday} onClose={onClose} title={isExisting ? 'Edit holiday' : 'Add holiday'}
    footer={<>{isExisting && holiday && <Button variant="ghost" className="mr-auto text-bad" icon={Trash2Icon} onClick={() => onDelete(holiday)}>Delete</Button>}<Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={pending} onClick={() => {setTouched(true);if (form && form.name.trim() && form.date) onSave({ ...form, name: form.name.trim() });}}>Save holiday</Button></>}>
      {form &&
      <div className="space-y-4">
          <Field label="Name" required error={nameErr}>{(id) => <Input id={id} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} invalid={!!nameErr} />}</Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date" required>{(id) => <DatePicker id={id} value={form.date} onChange={(v) => setForm({ ...form, date: v })} />}</Field>
            <Field label="Type" required>
              {(id) => <Select id={id} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as HolidayType })}><option value="Government">Government / Public Holiday</option><option value="Company">Company Holiday</option><option value="Optional">Optional Holiday</option></Select>}
            </Field>
          </div>
          {dup && <Banner tone="warn">{dup.name} is already on this date. Check this isn’t a duplicate.</Banner>}
          {weekend && <Banner tone="neutral">This date falls on a weekend. It only affects employees scheduled to work that day.</Banner>}
          <Field label="Description" hint="Optional">{(id) => <Textarea id={id} value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />}</Field>
          <Field label="Status" hint="Only published holidays are visible to employees and affect attendance.">
            {(id) => <Select id={id} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Holiday['status'] })}><option value="Draft">Draft</option><option value="Published">Published (date verified)</option></Select>}
          </Field>
          {form.type === 'Optional' && <p className="text-xs text-ink-muted">Optional holidays don’t remove the daily target automatically — employees take them through a leave request.</p>}
          {error && <Banner tone="bad" title="Not saved">{error}</Banner>}
        </div>
      }
    </Modal>);

}