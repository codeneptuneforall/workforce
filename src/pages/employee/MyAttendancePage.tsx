import { useEffect, useState } from 'react';
import { addMonths, format, getDay } from 'date-fns';
import { MessageSquareWarningIcon } from 'lucide-react';
import { DayBreakdown } from '../../components/shared/DayBreakdown';
import { DateStepper } from '../../components/shared/DateStepper';
import { StatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Field, Textarea } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Overlay';
import { Banner, PageHeader, Panel } from '../../components/ui/Primitives';
import { useData } from '../../contexts/DataContext';
import { useCurrentEmployee } from '../../hooks/useCurrentEmployee';
import { useMutation } from '../../hooks/useMutation';
import { useNow } from '../../hooks/useNow';
import { attendanceStatus, computeDay } from '@shared/domain/compliance';
import type { DayCompliance } from '@shared/domain/compliance';
import { cn } from '../../utils/cn';
import { fmtDate, fmtMin, fromDateKey, monthDates, todayKey } from '@shared/domain/time';
import { cmd } from '../../utils/commands';

const cellTone: Record<string, string> = {
  'Target Completed': 'bg-ok-bg border-ok-line',
  'Below Target': 'bg-bad-bg border-bad-line',
  'Needs Review': 'bg-warn-bg border-warn-line',
  'Approved Leave': 'bg-info-bg border-info-line',
  'Approved Exception': 'bg-info-bg border-info-line',
  Holiday: 'bg-brand-50 border-brand-200',
  Present: 'bg-white border-brand-300',
  Absent: 'bg-bad-bg border-bad-line'
};

export function MyAttendancePage() {
  const emp = useCurrentEmployee();
  const { ctx, state } = useData();
  const now = useNow(60000);
  const today = todayKey(now);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const [corrOpen, setCorrOpen] = useState(false);
  const [note, setNote] = useState('');
  const { mutate, pending, error } = useMutation();
  const dates = monthDates(month);
  const days = dates.map((d) => computeDay(ctx, emp, d, now));
  const lead = (getDay(fromDateKey(dates[0])) + 6) % 7;
  const sel = days.find((d) => d.date === selected) ?? computeDay(ctx, emp, selected, now);
  const counts = days.filter((d) => d.date <= today).reduce<Record<string, number>>((a, d) => {
    const s = attendanceStatus(d, state.settings);
    a[s] = (a[s] ?? 0) + 1;
    return a;
  }, {});
  const attention = days.filter((d) => d.isShortfall || d.hasIncomplete);
  const shiftMonth = (n: number) => {
    const m = format(addMonths(fromDateKey(`${month}-01`), n), 'yyyy-MM');
    setMonth(m);
    setSelected(m === today.slice(0, 7) ? today : `${m}-01`);
  };
  useEffect(() => {if (corrOpen) setNote('');}, [corrOpen]);

  const summary: [string, string][] = [
  ['Target Completed', 'Target completed'], ['Below Target', 'Below target'], ['Needs Review', 'Needs review'],
  ['Approved Leave', 'Approved leave'], ['Holiday', 'Holidays'], [state.settings.absentPolicy === 'mark_absent' ? 'Absent' : 'Not Recorded', 'Not recorded']];


  return (
    <div>
      <PageHeader title="My Attendance" description="Your daily totals against the 8-hour target. Select a day to see its sessions." />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <DateStepper label={format(fromDateKey(`${month}-01`), 'MMMM yyyy')} onPrev={() => shiftMonth(-1)} onNext={() => shiftMonth(1)} nextDisabled={month >= today.slice(0, 7)} />
        <dl className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {summary.map(([k, label]) =>
          <div key={k} className="flex items-baseline gap-1.5"><dt className="text-ink-muted">{label}</dt><dd className="font-semibold tnum">{counts[k] ?? 0}</dd></div>
          )}
        </dl>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Panel className="lg:col-span-3">
          <div className="grid grid-cols-7 gap-1.5 text-center text-xs text-ink-muted">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="pb-1">{d}</div>)}
            {Array.from({ length: lead }).map((_, i) => <div key={`l${i}`} />)}
            {days.map((d) => <DayCell key={d.date} d={d} today={today} selected={selected === d.date} onSelect={() => setSelected(d.date)} absentPolicy={state.settings.absentPolicy} />)}
          </div>
        </Panel>
        <Panel title={fmtDate(selected, 'EEEE, d MMM yyyy')} actions={<StatusBadge status={sel.status} />} className="lg:col-span-2 self-start">
          <DayBreakdown day={sel} />
          {(sel.isShortfall || sel.hasIncomplete) &&
          <Button variant="secondary" icon={MessageSquareWarningIcon} className="mt-4 w-full" onClick={() => setCorrOpen(true)}>Request a correction</Button>
          }
        </Panel>
      </div>

      {attention.length > 0 &&
      <Panel title="Days that may need correction" className="mt-6" flush>
          <ul className="divide-y divide-line">
            {attention.map((d) =>
          <li key={d.date}>
                <button onClick={() => setSelected(d.date)} className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left hover:bg-canvas">
                  <span className="text-sm font-medium">{fmtDate(d.date, 'EEE d MMM')}</span>
                  <span className="flex items-center gap-3 text-sm"><span className="text-bad tnum">{fmtMin(d.shortfallMin)} short</span><StatusBadge status={d.review?.status ?? d.status} /></span>
                </button>
              </li>
          )}
          </ul>
        </Panel>
      }

      <Modal open={corrOpen} onClose={() => setCorrOpen(false)} title="Request a time-log correction" description={fmtDate(selected, 'EEEE, d MMM yyyy')}
      footer={<><Button variant="secondary" onClick={() => setCorrOpen(false)}>Cancel</Button><Button loading={pending} disabled={!note.trim()} onClick={async () => {if (await mutate(cmd.requestDayCorrection(selected, note), 'Correction request sent')) setCorrOpen(false);}}>Send request</Button></>}>
        <p className="mb-3 text-sm text-ink-2">Management will review your request. Your original records stay unchanged; any approved correction is recorded separately with a reason.</p>
        <Field label="What needs correcting?" required>
          {(id) => <Textarea id={id} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. I forgot to start the timer after lunch — worked 14:00–16:30 on the leave form." />}
        </Field>
        {error && <Banner tone="bad" title="Not saved" className="mt-3">{error}</Banner>}
      </Modal>
    </div>);

}

function DayCell({ d, today, selected, onSelect, absentPolicy }: {d: DayCompliance;today: string;selected: boolean;onSelect: () => void;absentPolicy: 'not_recorded' | 'mark_absent';}) {
  const future = d.date > today;
  const status = attendanceStatus(d, { absentPolicy } as never);
  return (
    <button
      onClick={onSelect}
      disabled={future}
      className={cn(
        'flex aspect-square min-h-[52px] flex-col items-start justify-between rounded-lg border p-1.5 text-left transition-colors duration-150 sm:p-2',
        future ? 'border-transparent text-ink-faint' : cellTone[status] ?? 'border-line bg-white',
        selected && 'ring-2 ring-brand-600 ring-offset-1'
      )}
      aria-label={`${fmtDate(d.date, 'd MMMM')}: ${status}${d.completedMin ? `, ${fmtMin(d.completedMin)}` : ''}`}>
      
      <span className={cn('text-xs font-medium', d.date === today ? 'text-brand-700' : 'text-ink-2')}>{Number(d.date.slice(8))}</span>
      {!future && d.completedMin > 0 && <span className="hidden text-[10px] text-ink-2 tnum sm:block">{fmtMin(d.completedMin)}</span>}
    </button>);

}