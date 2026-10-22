import type * as React from 'react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2Icon, PaperclipIcon } from 'lucide-react';
import { StatusBadge } from '../../components/ui/Badge';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Field, Input, Textarea } from '../../components/ui/Field';
import { DatePicker } from '../../components/ui/DatePicker';
import { Banner, KeyValue, PageHeader, Panel } from '../../components/ui/Primitives';
import { useData } from '../../contexts/DataContext';
import { useCurrentEmployee } from '../../hooks/useCurrentEmployee';
import { useMutation } from '../../hooks/useMutation';
import { useNow } from '../../hooks/useNow';
import type { LeaveType } from '@shared/types';
import { cn } from '../../utils/cn';
import { validateLeave } from '@shared/domain/leave';
import type { LeaveForm } from '@shared/domain/leave';
import { fmtDate, todayKey } from '@shared/domain/time';
import { cmd } from '../../utils/commands';

const types: {value: LeaveType;title: string;body: string;}[] = [
{ value: 'Casual', title: 'Casual Leave', body: 'Planned time off. Must be requested at least 5 calendar days before the start date.' },
{ value: 'Emergency', title: 'Emergency Leave', body: 'Unplanned absence. Can be requested for today, future or past dates.' }];


export function ApplyLeavePage() {
  const emp = useCurrentEmployee();
  const { state } = useData();
  const now = useNow(60000);
  const [params] = useSearchParams();
  const initialType = params.get('type') === 'Emergency' ? 'Emergency' : 'Casual';
  const [form, setForm] = useState<LeaveForm>({ type: initialType, startDate: '', endDate: '', reason: '', contact: '' });
  const [attachment, setAttachment] = useState<string | undefined>();
  const [touched, setTouched] = useState(false);
  const [submitted, setSubmitted] = useState<LeaveForm & {days: number;retrospective: boolean;} | null>(null);
  const { mutate, pending, error } = useMutation();
  const s = state.settings;
  const v = validateLeave(form, emp, state.leaves, state.holidays, s, now);
  const today = todayKey(now);
  const set = (patch: Partial<LeaveForm>) => setForm((f) => ({ ...f, ...patch }));
  const show = (k: keyof typeof v.errors) => touched || k === 'startDate' && form.startDate ? v.errors[k] : undefined;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (Object.keys(v.errors).length) return;
    const ok = await mutate(cmd.applyLeave(form, attachment));
    if (ok) setSubmitted({ ...form, days: v.days, retrospective: v.retrospective });
  };

  if (submitted) {
    return (
      <div className="mx-auto max-w-xl">
        <Panel>
          <div className="flex flex-col items-center py-4 text-center">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-ok-bg text-ok"><CheckCircle2Icon className="h-6 w-6" /></div>
            <h1 className="text-xl font-semibold">Leave request submitted</h1>
            <p className="mt-1 text-sm text-ink-muted">Your manager has been notified. You’ll get a notification when it’s decided.</p>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-4 rounded-lg bg-canvas p-4">
            <KeyValue label="Type" value={`${submitted.type} Leave`} />
            <KeyValue label="Status" value={<StatusBadge status="Pending Approval" />} />
            <KeyValue label="Dates" value={`${fmtDate(submitted.startDate, 'd MMM')} – ${fmtDate(submitted.endDate, 'd MMM yyyy')}`} />
            <KeyValue label="Working days" value={submitted.days} />
          </dl>
          {submitted.retrospective && <Banner tone="warn" className="mt-4">This is a past-dated request and is flagged for management review.</Banner>}
          <p className="mt-4 text-xs text-ink-muted">Pending leave doesn’t change your attendance or daily target until it’s approved.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <ButtonLink to="/employee/leaves/history" variant="primary">View my requests</ButtonLink>
            <Button variant="secondary" onClick={() => {setSubmitted(null);setForm({ type: 'Casual', startDate: '', endDate: '', reason: '', contact: '' });setTouched(false);setAttachment(undefined);}}>Apply for another</Button>
          </div>
        </Panel>
      </div>);

  }

  return (
    <div>
      <PageHeader title="Apply for Leave" description="Working days are calculated from your schedule — weekends and holidays aren’t counted." />
      <div className="grid gap-6 lg:grid-cols-3">
        <form onSubmit={submit} noValidate className="lg:col-span-2">
          <Panel>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Leave type</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {types.map((t) =>
                <label key={t.value} className={cn('cursor-pointer rounded-lg border p-4 transition-colors duration-150', form.type === t.value ? 'border-brand-500 bg-brand-50' : 'border-line hover:border-line-strong')}>
                    <input type="radio" name="leave-type" className="sr-only" checked={form.type === t.value} onChange={() => set({ type: t.value })} />
                    <span className="block text-sm font-semibold">{t.title}</span>
                    <span className="mt-1 block text-xs text-ink-muted">{t.body}</span>
                  </label>
                )}
              </div>
            </fieldset>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Start date" required error={show('startDate')}>
                {(id, d) => <DatePicker id={id} aria-describedby={d} value={form.startDate} onChange={(v) => set({ startDate: v, endDate: form.endDate && form.endDate >= v ? form.endDate : v })} invalid={!!show('startDate')} />}
              </Field>
              <Field label="End date" required error={show('endDate')}>
                {(id, d) => <DatePicker id={id} aria-describedby={d} value={form.endDate} min={form.startDate || undefined} onChange={(v) => set({ endDate: v })} invalid={!!show('endDate')} />}
              </Field>
            </div>
            {form.type === 'Casual' && v.errors.startDate && form.startDate &&
            <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => set({ startDate: v.earliestCasual, endDate: form.endDate && form.endDate >= v.earliestCasual ? form.endDate : v.earliestCasual })}>Use {fmtDate(v.earliestCasual, 'd MMM')}</Button>
                <span className="text-xs text-ink-muted">or switch to Emergency Leave if this is genuinely unplanned.</span>
              </div>
            }
            {v.retrospective && <Banner tone="warn" title="Past-dated request" className="mt-4">This Emergency Leave starts before today. It will be flagged for management review — please explain what happened.</Banner>}
            {(show('days') || touched && v.errors.overlap || v.errors.overlap) &&
            <Banner tone="bad" className="mt-4">{v.errors.overlap ?? v.errors.days}</Banner>
            }

            <div className="mt-5 space-y-4">
              <Field label="Reason" required error={show('reason')}>
                {(id, d) => <Textarea id={id} aria-describedby={d} value={form.reason} onChange={(e) => set({ reason: e.target.value })} invalid={!!show('reason')} />}
              </Field>
              <Field label="Contact while on leave" hint="Optional — phone or alternate email">
                {(id) => <Input id={id} value={form.contact} onChange={(e) => set({ contact: e.target.value })} />}
              </Field>
              {s.attachmentsEnabled &&
              <Field label="Attachment" hint="Optional — e.g. a medical note. Only the file name is recorded against the request.">
                  {(id) =>
                <label htmlFor={id} className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-line-strong px-3 text-sm text-ink-muted hover:bg-canvas">
                      <PaperclipIcon className="h-4 w-4" /> {attachment ?? 'Choose a file'}
                      <input id={id} type="file" className="sr-only" onChange={(e) => setAttachment(e.target.files?.[0]?.name)} />
                    </label>
                }
                </Field>
              }
            </div>
            {error && <Banner tone="bad" title="Not submitted" className="mt-4">{error}</Banner>}
            <div className="mt-6 flex justify-end">
              <Button type="submit" size="lg" loading={pending}>Submit request</Button>
            </div>
          </Panel>
        </form>

        <div className="space-y-6">
          <Panel title="Request summary">
            <dl className="space-y-3">
              <div className="flex justify-between text-sm"><dt className="text-ink-muted">Working days requested</dt><dd className="text-lg font-semibold tnum">{v.days}</dd></div>
              <div className="flex justify-between text-sm"><dt className="text-ink-muted">Submission date</dt><dd className="font-medium">{fmtDate(today, 'd MMM yyyy')}</dd></div>
              {form.type === 'Casual' && <div className="flex justify-between text-sm"><dt className="text-ink-muted">Earliest Casual start</dt><dd className="font-medium">{fmtDate(v.earliestCasual, 'EEE d MMM')}</dd></div>}
            </dl>
            {v.holidaysInRange.length > 0 &&
            <div className="mt-4 border-t border-line pt-3">
                <p className="text-xs font-medium text-ink-muted">Holidays in range (not counted)</p>
                <ul className="mt-1 space-y-0.5">{v.holidaysInRange.map((h) => <li key={h.id} className="text-xs">{fmtDate(h.date, 'd MMM')} · {h.name}</li>)}</ul>
              </div>
            }
          </Panel>
          <Panel title="Policy">
            <ul className="space-y-2 text-sm text-ink-2">
              <li>Casual Leave needs {s.casualAdvanceDays} calendar days’ notice from the submission date (company time zone: {s.timezone}).</li>
              <li>Emergency Leave has no notice rule{s.emergencyRetrospective ? ' and may be past-dated with a reason' : ''}.</li>
              <li>Every request starts as Pending Approval. Nothing is auto-approved.</li>
              <li>Casual allowance: {s.casualAllowance === null ? 'not configured by management' : `${s.casualAllowance} days per leave year`}.</li>
            </ul>
          </Panel>
        </div>
      </div>
    </div>);

}