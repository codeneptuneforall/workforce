import { useEffect, useState } from 'react';
import { ClipboardListIcon } from 'lucide-react';
import { StatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Field, Select, Textarea } from '../../components/ui/Field';
import { Drawer } from '../../components/ui/Overlay';
import { Banner, EmptyState, PageHeader, Panel } from '../../components/ui/Primitives';
import { Table, Td, Th, Tr } from '../../components/ui/Table';
import { useData } from '../../contexts/DataContext';
import { useMutation } from '../../hooks/useMutation';
import { useNow } from '../../hooks/useNow';
import type { Timesheet } from '@shared/types';
import { computeDay } from '@shared/domain/compliance';
import { fmtDate, fmtDateTime, fmtMin, sessionActiveMs, weekDates, MINUTE } from '@shared/domain/time';
import { cmd } from '../../utils/commands';

export function TimesheetReviewPage() {
  const { state, ctx, team } = useData();
  const now = useNow(60000);
  const [status, setStatus] = useState('awaiting');
  const [empId, setEmpId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [week, setWeek] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const weeks = [...new Set(state.timesheets.map((t) => t.weekStart))].sort().reverse();

  const summarise = (t: Timesheet) => {
    const emp = state.employees.find((e) => e.id === t.employeeId)!;
    const days = weekDates(t.weekStart).map((d) => computeDay(ctx, emp, d, now));
    return {
      emp,
      days,
      total: days.reduce((a, d) => a + d.completedMin, 0),
      expected: days.reduce((a, d) => a + d.expectedMin, 0),
      shortDays: days.filter((d) => d.isShortfall).length,
      incomplete: days.filter((d) => d.hasIncomplete).length
    };
  };

  const rows = state.timesheets.
  filter((t) => status === 'awaiting' ? t.status === 'Submitted' || t.status === 'Under Review' : status === 'all' || t.status === status).
  filter((t) => (!empId || t.employeeId === empId) && (!week || t.weekStart === week)).
  filter((t) => !teamId || state.employees.find((e) => e.id === t.employeeId)?.teamId === teamId).
  filter((t) => !projectId || state.sessions.some((s) => s.employeeId === t.employeeId && s.projectId === projectId && weekDates(t.weekStart).includes(s.date))).
  sort((a, b) => a.weekStart < b.weekStart ? 1 : -1);
  const openTs = state.timesheets.find((t) => t.id === openId) ?? null;

  return (
    <div>
      <PageHeader title="Timesheet Review" description="Review submitted weeks, inspect daily logs and approve or request corrections. Every decision is recorded." />
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="awaiting">Awaiting approval</option><option value="all">All statuses</option><option>Submitted</option><option>Under Review</option><option>Approved</option><option>Changes Requested</option>
        </Select>
        <Select aria-label="Week" value={week} onChange={(e) => setWeek(e.target.value)}><option value="">All weeks</option>{weeks.map((w) => <option key={w} value={w}>Week of {fmtDate(w, 'd MMM yyyy')}</option>)}</Select>
        <Select aria-label="Employee" value={empId} onChange={(e) => setEmpId(e.target.value)}><option value="">All employees</option>{state.employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</Select>
        <Select aria-label="Team" value={teamId} onChange={(e) => setTeamId(e.target.value)}><option value="">All teams</option>{state.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
        <Select aria-label="Project" value={projectId} onChange={(e) => setProjectId(e.target.value)}><option value="">All projects</option>{state.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
      </div>
      <Panel flush>
        {rows.length === 0 ? <EmptyState icon={ClipboardListIcon} title="No timesheets match" body={status === 'awaiting' ? 'Everything submitted has been reviewed.' : undefined} /> :
        <Table>
            <thead><tr><Th>Employee</Th><Th>Week</Th><Th align="right">Completed</Th><Th align="right">Expected</Th><Th align="right">Days below target</Th><Th align="right">Incomplete</Th><Th>Submitted</Th><Th>Status</Th></tr></thead>
            <tbody>
              {rows.map((t) => {
              const s = summarise(t);
              return (
                <Tr key={t.id} onClick={() => setOpenId(t.id)}>
                    <Td><p className="font-medium">{s.emp.name}</p><p className="text-xs text-ink-muted">{team(s.emp.teamId)?.name}</p></Td>
                    <Td className="whitespace-nowrap">{fmtDate(t.weekStart, 'd MMM')} – {fmtDate(weekDates(t.weekStart)[6], 'd MMM')}</Td>
                    <Td align="right" className="font-medium">{fmtMin(s.total)}</Td>
                    <Td align="right">{fmtMin(s.expected)}</Td>
                    <Td align="right" className={s.shortDays ? 'text-bad' : 'text-ink-muted'}>{s.shortDays}</Td>
                    <Td align="right" className={s.incomplete ? 'text-warn' : 'text-ink-muted'}>{s.incomplete}</Td>
                    <Td className="whitespace-nowrap text-xs text-ink-muted">{t.submittedAt ? fmtDateTime(t.submittedAt) : '—'}</Td>
                    <Td><StatusBadge status={t.status} /></Td>
                  </Tr>);

            })}
            </tbody>
          </Table>
        }
      </Panel>
      <TimesheetDrawer ts={openTs} onClose={() => setOpenId(null)} summary={openTs ? summarise(openTs) : null} />
    </div>);

}

function TimesheetDrawer({ ts, onClose, summary }: {ts: Timesheet | null;onClose: () => void;summary: {emp: {name: string;};days: ReturnType<typeof computeDay>[];total: number;expected: number;incomplete: number;} | null;}) {
  const { project, task } = useData();
  const { mutate, pending, error, setError } = useMutation();
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  useEffect(() => {setNote('');setTouched(false);setError(null);}, [ts?.id, setError]);
  if (!ts || !summary) return <Drawer open={false} onClose={onClose} title=""><div /></Drawer>;
  const decided = ts.status === 'Approved';
  const now = Date.now();
  const byProject = new Map<string, number>();
  summary.days.forEach((d) => d.sessions.forEach((s) => byProject.set(`${s.projectId}|${s.taskId}`, (byProject.get(`${s.projectId}|${s.taskId}`) ?? 0) + Math.floor(sessionActiveMs(s, now) / MINUTE))));
  const act = async (decision: 'Approved' | 'Changes Requested') => {
    setTouched(true);
    if (decision === 'Changes Requested' && !note.trim()) return;
    if (await mutate(cmd.reviewTimesheet(ts.id, decision, note), decision === 'Approved' ? 'Timesheet approved' : 'Changes requested')) onClose();
  };
  return (
    <Drawer open onClose={onClose} size="lg" title={`${summary.emp.name} · week of ${fmtDate(ts.weekStart, 'd MMM yyyy')}`} description={<span className="flex items-center gap-2"><StatusBadge status={ts.status} /> {fmtMin(summary.total)} of {fmtMin(summary.expected)}</span>}
    footer={!decided && <><Button variant="secondary" loading={pending} onClick={() => act('Changes Requested')}>Request changes</Button><Button variant="success" loading={pending} onClick={() => act('Approved')}>Approve timesheet</Button></>}>
      <div className="space-y-6">
        {summary.incomplete > 0 && <Banner tone="warn" title="Incomplete sessions">Some sessions have no end time and are excluded from totals. Consider requesting a correction.</Banner>}
        <Table>
          <thead><tr><Th>Day</Th><Th align="right">Sessions</Th><Th align="right">Completed</Th><Th align="right">Shortfall</Th><Th>Status</Th></tr></thead>
          <tbody>
            {summary.days.map((d) =>
            <Tr key={d.date}>
                <Td className="whitespace-nowrap">{fmtDate(d.date, 'EEE d MMM')}</Td>
                <Td align="right">{d.sessions.length}</Td>
                <Td align="right" className="font-medium">{fmtMin(d.completedMin)}</Td>
                <Td align="right" className={d.isShortfall ? 'text-bad' : 'text-ink-muted'}>{d.isShortfall ? fmtMin(d.shortfallMin) : '—'}</Td>
                <Td><StatusBadge status={d.status} /></Td>
              </Tr>
            )}
          </tbody>
        </Table>
        <section>
          <h3 className="mb-2 text-sm font-semibold">Project / task breakdown</h3>
          <ul className="divide-y divide-line rounded-lg border border-line">
            {[...byProject.entries()].sort((a, b) => b[1] - a[1]).map(([k, m]) => {
              const [pid, tid] = k.split('|');
              return <li key={k} className="flex justify-between gap-3 px-4 py-2 text-sm"><span className="min-w-0 truncate">{task(tid)?.title} <span className="text-ink-muted">· {project(pid)?.code}</span></span><span className="font-medium tnum">{fmtMin(m)}</span></li>;
            })}
            {byProject.size === 0 && <li className="px-4 py-3 text-sm text-ink-muted">No sessions this week.</li>}
          </ul>
        </section>
        {!decided &&
        <Field label="Note to employee" hint="Required when requesting changes." error={touched && !note.trim() ? 'Add a reason so the employee knows what to fix.' : undefined}>
            {(id) => <Textarea id={id} value={note} onChange={(e) => setNote(e.target.value)} />}
          </Field>
        }
        {error && <Banner tone="bad" title="Not saved">{error}</Banner>}
        <section>
          <h3 className="mb-2 text-sm font-semibold">History</h3>
          <ol className="space-y-3 border-l border-line pl-4">
            {[...ts.history].reverse().map((h, i) =>
            <li key={i} className="text-sm"><p className="font-medium">{h.action} <span className="font-normal text-ink-muted">by {h.by}</span></p><p className="text-xs text-ink-faint">{fmtDateTime(h.at)}</p>{h.note && <p className="text-xs text-ink-2">{h.note}</p>}</li>
            )}
          </ol>
        </section>
      </div>
    </Drawer>);

}