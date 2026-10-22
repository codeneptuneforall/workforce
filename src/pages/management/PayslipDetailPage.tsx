import { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { DownloadIcon, FilePenLineIcon, PrinterIcon, SendIcon } from 'lucide-react';
import { PayslipDocument } from '../../components/payslip/PayslipDocument';
import { printPayslip } from '../../components/payslip/PayslipViewer';
import { StatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Banner, KeyValue, PageHeader, Panel } from '../../components/ui/Primitives';
import { useData } from '../../contexts/DataContext';
import { useMutation } from '../../hooks/useMutation';
import { cn } from '../../utils/cn';
import { computePayrollRecord, monthLabel } from '@shared/domain/payroll';
import { getRun } from '@shared/domain/payrollMutations';
import { cmd } from '../../utils/commands';
import { fmtDate, fmtDateTime } from '@shared/domain/time';

export function PayslipDetailPage() {
  const { id } = useParams();
  const { state, ctx, employee } = useData();
  const { mutate, pending, error, setError } = useMutation();
  const [confirm, setConfirm] = useState<'release' | 'revise' | null>(null);
  const p = state.payslips.find((x) => x.id === id);
  const emp = employee(p?.employeeId);
  const record = useMemo(() => p && emp ? computePayrollRecord(ctx, emp, p.month, state.salary, Date.now()) : null, [p, emp, ctx, state.salary]);
  if (!p) return <Navigate to="/management/payslips" replace />;
  const run = getRun(state, p.month);
  const versions = state.payslips.filter((x) => x.employeeId === p.employeeId && x.month === p.month).sort((a, b) => b.version - a.version);
  const credited = !!run.creditDate;

  return (
    <div>
      <PageHeader title={`${p.data.employee.name} · ${monthLabel(p.month)}`} back={{ to: '/management/payslips', label: 'Payslips' }}
      description={<span className="flex items-center gap-2">Version {p.version} <StatusBadge status={p.status} /></span>}
      actions={<><Button variant="secondary" icon={PrinterIcon} onClick={printPayslip}>Print</Button><Button variant="secondary" icon={DownloadIcon} onClick={printPayslip}>Download PDF</Button></>} />
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="overflow-x-auto rounded-xl border border-line bg-canvas p-3 sm:p-6">
          <div className="rounded-md border border-line shadow-card"><PayslipDocument data={p.data} version={p.version} watermark={p.status === 'Generated' ? 'Draft' : p.status === 'Superseded' ? 'Superseded' : undefined} /></div>
        </div>
        <div className="space-y-6">
          <Panel title="Status">
            <dl className="space-y-3">
              <KeyValue label="Generated" value={fmtDateTime(p.generatedAt)} />
              <KeyValue label="Released" value={p.releasedAt ? fmtDateTime(p.releasedAt) : 'Not released'} />
              <KeyValue label="Salary credit" value={credited ? `Credited ${fmtDate(run.creditDate as string)}` : <span className="text-warn">Not yet credited</span>} />
              {p.revisionReason && <KeyValue label="Revision reason" value={p.revisionReason} />}
            </dl>
            {error && <Banner tone="bad" title="Not saved" className="mt-4">{error}</Banner>}
            <div className="mt-5 space-y-2">
              {p.status === 'Generated' &&
              <>
                  {!credited && state.settings.releaseRequiresCredit && <Banner tone="warn">Payslips can’t be released before salary credit is confirmed.</Banner>}
                  <Button className="w-full" icon={SendIcon} disabled={!credited && state.settings.releaseRequiresCredit} onClick={() => {setError(null);setConfirm('release');}}>Release to employee</Button>
                </>
              }
              {p.status === 'Released' && <Button className="w-full" variant="secondary" icon={FilePenLineIcon} onClick={() => {setError(null);setConfirm('revise');}}>Create revised version</Button>}
              {p.status === 'Superseded' && <p className="text-sm text-ink-muted">This version was replaced by a later revision and is kept for the record.</p>}
            </div>
          </Panel>
          <Panel title="Version history" flush>
            <ul className="divide-y divide-line">
              {versions.map((v) =>
              <li key={v.id}>
                  <Link to={`/management/payslips/${v.id}`} className={cn('flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-canvas', v.id === p.id && 'bg-brand-50')}>
                    <span><span className="font-medium">Version {v.version}</span><span className="block text-xs text-ink-muted">{fmtDateTime(v.generatedAt)}</span></span>
                    <StatusBadge status={v.status} />
                  </Link>
                </li>
              )}
            </ul>
          </Panel>
        </div>
      </div>
      <ConfirmDialog open={confirm === 'release'} onClose={() => setConfirm(null)} title="Release this payslip?" confirmLabel="Release" tone="success" pending={pending} error={error}
      body={`${p.data.employee.name} will be notified and can view and download it.${p.version > 1 ? ' The previous version will be marked superseded but kept.' : ''}`}
      onConfirm={async () => {if (await mutate(cmd.releaseSinglePayslip(p.id), 'Payslip released')) setConfirm(null);}} />
      <ConfirmDialog open={confirm === 'revise'} onClose={() => setConfirm(null)} title="Create a revised payslip?" confirmLabel="Create revision" requireReason reasonLabel="Revision reason" pending={pending} error={error}
      body="A new version is generated from current approved records. The original stays preserved and visible to the employee until the revision is released."
      onConfirm={async (reason) => {if (record && (await mutate(cmd.revisePayslip(p.id, reason), 'Revision created'))) setConfirm(null);}} />
    </div>);

}