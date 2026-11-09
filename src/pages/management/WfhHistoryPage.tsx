import type * as React from 'react';
import { useCallback, useMemo, useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { CalendarDaysIcon, DownloadIcon, RefreshCwIcon, UserIcon, ClockIcon } from 'lucide-react';
import { api } from '../../api/client';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { PageHeader, Panel, Tabs } from '../../components/ui/Primitives';
import { Table, Td, Th, Tr } from '../../components/ui/Table';
import { Select } from '../../components/ui/Field';
import { Button } from '../../components/ui/Button';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Modal } from '../../components/ui/Overlay';
import { toast } from 'sonner';

/** `yyyy-mm` for the current IST month. */
function currentMonthKey(): string {
  return format(new Date(), 'yyyy-MM');
}

function fmtDate(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function WfhHistoryPage() {
  const { user } = useAuth();
  const { state, refresh } = useData();
  const isManager = user?.role === 'management';

  const [month, setMonth] = useState(currentMonthKey());
  const [teamId, setTeamId] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');

  const [summary, setSummary] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Correction dialog
  const [correctOpen, setCorrectOpen] = useState(false);
  const [correctTarget, setCorrectTarget] = useState<{ employeeId: string; employeeName: string; date: string; currentWfh: boolean } | null>(null);
  const [correctPending, setCorrectPending] = useState(false);

  // Employee detail modal
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailEmp, setDetailEmp] = useState<{ employeeId: string; name: string; history: any[] } | null>(null);

  const [summaryTab, setSummaryTab] = useState<'summary' | 'history'>('summary');

  const teams = state.teams;
  const employees = state.employees;

  const teamName = useCallback((id: string) => teams.find((t) => t.id === id)?.name ?? '—', [teams]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryRes, historyRes] = await Promise.all([
        api.wfhSummary({ month, teamId }),
        api.wfhHistory({ month, teamId })
      ]);
      setSummary(summaryRes.summary);
      setHistory(historyRes.wfhHistory);
    } catch (err: any) {
      toast.error(err.message || 'Could not load WFH history.');
    } finally {
      setLoading(false);
    }
  }, [month, teamId]);

  useEffect(() => {
    load();
  }, [load]);

  const refetch = useCallback(() => {
    void refresh();
    void load();
  }, [refresh, load]);

  // ---------- Filtered summary ----------
  const searchLower = employeeSearch.toLowerCase();
  const filteredSummary = useMemo(() => {
    return summary.filter((s) =>
      !searchLower || s.name.toLowerCase().includes(searchLower)
    );
  }, [summary, searchLower]);

  const totalWfhDays = filteredSummary.reduce((a, s) => a + Number(s.wfhDays), 0);
  const employeesWithWfh = filteredSummary.filter((s) => s.wfhDays > 0).length;
  const avgWfhDays = filteredSummary.length ? (totalWfhDays / filteredSummary.length).toFixed(1) : '0';
  const totalDeclarations = history.length;

  // ---------- Handlers ----------
  const handleCorrect = async (employeeId: string, employeeName: string, date: string, currentWfh: boolean) => {
    setCorrectTarget({ employeeId, employeeName, date, currentWfh });
    setCorrectOpen(true);
  };

  const handleConfirmCorrect = async (reason: string) => {
    if (!correctTarget) return;
    setCorrectPending(true);
    try {
      const newValue = !correctTarget.currentWfh;
      await api.wfhCorrect(correctTarget.employeeId, correctTarget.date, newValue, reason);
      toast.success(`WFH status for ${correctTarget.employeeName} on ${fmtDate(correctTarget.date)} updated to ${newValue ? 'WFH' : 'Office'}.`);
      setCorrectOpen(false);
      setCorrectTarget(null);
      void load();
    } catch (err: any) {
      toast.error(err.message || 'Correction failed. Please try again.');
    } finally {
      setCorrectPending(false);
    }
  };

  const handleViewDetail = (employeeId: string, name: string) => {
    const empHistory = history.filter((h) => h.employeeId === employeeId);
    setDetailEmp({ employeeId, name, history: empHistory });
    setDetailOpen(true);
  };

  const handleExport = async () => {
    try {
      const res = await api.wfhExport({ month, teamId });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        toast.error(text || 'Export failed.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `WFH-History_${month}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Excel export downloaded.');
    } catch (err: any) {
      toast.error(err.message || 'Export failed.');
    }
  };

  // ---------- Month navigation ----------
  const monthStart = startOfMonth(new Date(`${month}-01`));
  const monthLabel = format(monthStart, 'MMMM yyyy');
  const prevDisabled = month <= '2026-01'; // no data before the feature launch
  const nextDisabled = month >= currentMonthKey();

  const goPrev = () => {
    const prev = eachDayOfInterval({ start: startOfMonth(monthStart), end: endOfMonth(monthStart) })[0];
    const d = new Date(prev);
    d.setMonth(d.getMonth() - 1);
    setMonth(format(d, 'yyyy-MM'));
  };
  const goNext = () => {
    const d = new Date(monthStart);
    d.setMonth(d.getMonth() + 1);
    setMonth(format(d, 'yyyy-MM'));
  };

  return (
    <div>
      <PageHeader
        title="WFH History"
        description="Monthly work-from-home summary, per-employee totals and date-wise history for the management portal."
        actions={
          <>
            <Button variant="secondary" icon={RefreshCwIcon} onClick={refetch} loading={loading} size="sm">Refresh</Button>
            <Button icon={DownloadIcon} onClick={handleExport} loading={loading} size="sm">Export Excel</Button>
          </>
        }
      />

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Panel flush>
          <div className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-ink-muted">Total WFH Days</p>
                <p className="text-2xl font-semibold tnum">{totalWfhDays}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                <CalendarDaysIcon className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-2 text-xs text-ink-muted">Distinct WFH days in {monthLabel}</p>
          </div>
        </Panel>
        <Panel flush>
          <div className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-ink-muted">Employees with WFH</p>
                <p className="text-2xl font-semibold tnum">{employeesWithWfh}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ok-bg text-ok">
                <UserIcon className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-2 text-xs text-ink-muted">Of {filteredSummary.length} employees shown</p>
          </div>
        </Panel>
        <Panel flush>
          <div className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-ink-muted">Avg WFH Days / Employee</p>
                <p className="text-2xl font-semibold tnum">{avgWfhDays}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-info-bg text-info">
                <ClockIcon className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-2 text-xs text-ink-muted">Across selected period</p>
          </div>
        </Panel>
        <Panel flush>
          <div className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-ink-muted">Total Declarations</p>
                <p className="text-2xl font-semibold tnum">{totalDeclarations}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral text-ink-2">
                <ClockIcon className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-2 text-xs text-ink-muted">WFH + correction records</p>
          </div>
        </Panel>
      </div>

      {/* Filters */}
      <Panel flush className="mb-6">
        <div className="p-5">
          <div className="flex flex-wrap items-end gap-4 sm:gap-6">
            <div className="min-w-[200px]">
              <label className="mb-1 block text-xs font-medium text-ink-muted">Month</label>
              <div className="flex items-center gap-2">
                <button type="button" onClick={goPrev} disabled={prevDisabled} className="h-10 w-10 rounded-lg border border-line text-ink-muted disabled:opacity-40 disabled:cursor-not-allowed">{monthStart.getMonth() === 0 ? '◀' : '◀'}</button>
                <span className="flex-1 text-sm font-medium text-ink text-center">{monthLabel}</span>
                <button type="button" onClick={goNext} disabled={nextDisabled} className="h-10 w-10 rounded-lg border border-line text-ink-muted disabled:opacity-40 disabled:cursor-not-allowed">{monthStart.getMonth() === 11 ? '▶' : '▶'}</button>
              </div>
            </div>

            <div className="min-w-[220px]">
              <label className="mb-1 block text-xs font-medium text-ink-muted">Team / Department</label>
              <Select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                <option value="">All teams</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </div>

            <div className="min-w-[260px]">
              <label className="mb-1 block text-xs font-medium text-ink-muted">Employee Search</label>
              <Select value={employeeSearch} onChange={(e) => setEmployeeSearch(e.target.value)}>
                <option value="">All employees</option>
                {employees.filter((e) => e.status === 'Active').map((e) => <option key={e.id} value={e.name}>{e.name}</option>)}
              </Select>
            </div>

            {(teamId || employeeSearch) && (
              <button type="button" onClick={() => { setTeamId(''); setEmployeeSearch(''); }} className="self-end rounded-lg border border-line px-3 py-2 text-sm text-ink-muted hover:text-ink">Clear filters</button>
            )}
          </div>
        </div>
      </Panel>

      <Tabs tabs={[
        { id: 'summary', label: 'Monthly Summary' },
        { id: 'history', label: 'Date-Wise History' }
      ]} value={summaryTab} onChange={setSummaryTab} />

      {summaryTab === 'summary' && (
        <Panel flush>
          <div className="p-5">
            <Table>
              <thead>
                <tr>
                  <Th>Employee</Th>
                  <Th>Employee ID</Th>
                  <Th>Team</Th>
                  <Th align="right">WFH Days</Th>
                  <Th>WFH Dates</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {filteredSummary.length === 0 && (
                  <tr><Td colSpan={6} className="py-10 text-center text-ink-muted">No WFH records found for the selected period.</Td></tr>
                )}
                {filteredSummary.map((s) => (
                  <Tr key={s.employeeId}>
                    <Td className="font-medium">{s.name}</Td>
                    <Td className="text-ink-muted">{s.employeeId}</Td>
                    <Td className="text-ink-muted">{teamName(s.teamId)}</Td>
                    <Td align="right" className="font-semibold">{s.wfhDays}</Td>
                    <Td className="text-sm text-ink-muted">{s.wfhDates.length ? s.wfhDates.map((d: string) => fmtDate(d)).join(', ') : '—'}</Td>
                    <Td>
                      <Button variant="secondary" size="sm" onClick={() => handleViewDetail(s.employeeId, s.name)}>View History</Button>
                      {isManager && s.wfhDays > 0 && (
                        <Button variant="secondary" size="sm" className="ml-2" onClick={() => {
                          const wfhDate = s.wfhDates.length ? s.wfhDates[0] : '';
                          if (wfhDate) handleCorrect(s.employeeId, s.name, wfhDate, true);
                        }}>Correct to Office</Button>
                      )}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Panel>
      )}

      {summaryTab === 'history' && (
        <Panel flush>
          <div className="p-5">
            <Table>
              <thead>
                <Tr>
                  <Th>Date</Th>
                  <Th>Employee</Th>
                  <Th>Team</Th>
                  <Th>WFH Status</Th>
                  <Th>Declared At</Th>
                  <Th>Source</Th>
                  <Th>Actions</Th>
                </Tr>
              </thead>
              <tbody>
                {history.length === 0 && (
                  <Tr><Td colSpan={7} className="py-10 text-center text-ink-muted">No WFH declarations found for the selected period.</Td></Tr>
                )}
                {history.map((h) => {
                  const emp = employees.find((e) => e.id === h.employeeId);
                  const isCorrected = h.source === 'management_correction';
                  return (
                    <Tr key={h.id}>
                      <Td className="font-medium whitespace-nowrap">{fmtDate(h.date)}</Td>
                      <Td className="font-medium">{h.employeeName}</Td>
                      <Td className="text-ink-muted">{emp ? teamName(emp.teamId) : '—'}</Td>
                      <Td>
                        <StatusBadge status={h.workFromHome === true ? 'WFH' : 'Office'} />
                      </Td>
                      <Td className="text-xs text-ink-muted whitespace-nowrap">{h.declaredAt ? new Date(h.declaredAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</Td>
                      <Td className="text-xs text-ink-muted">
                        <Badge tone={isCorrected ? 'warn' : 'info'}>{h.source.replace('_', ' ')}</Badge>
                      </Td>
                      <Td>
                        {isManager && h.isLatest && (
                          <Button variant="secondary" size="sm" onClick={() => handleCorrect(h.employeeId, h.employeeName, h.date, h.workFromHome === true)}>
                            Correct
                          </Button>
                        )}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        </Panel>
      )}

      {/* Correction dialog */}
      <ConfirmDialog
        open={correctOpen}
        onClose={() => { setCorrectOpen(false); setCorrectTarget(null); }}
        title="Correct WFH Declaration"
        body={
          <>
            <p className="text-sm text-ink-2">Set the effective WFH status for <strong>{correctTarget?.employeeName}</strong> on <strong>{correctTarget ? fmtDate(correctTarget.date) : ''}</strong>.</p>
            <p className="mt-2 text-sm text-ink-muted">The original declaration is preserved; a corrected record is added as the new effective status.</p>
            <p className="mt-2 text-sm text-ink-muted">Current status: <strong>{correctTarget?.currentWfh === true ? 'WFH' : 'Office'}</strong> → New status: <strong>{correctTarget ? (correctTarget.currentWfh ? 'Office' : 'WFH') : ''}</strong>.</p>
          </>
        }
        confirmLabel="Confirm Correction"
        tone="primary"
        requireReason
        reasonLabel="Correction Reason"
        pending={correctPending}
        onConfirm={handleConfirmCorrect}
      />

      {/* Employee detail modal */}
      <Modal
        open={detailOpen}
        onClose={() => { setDetailOpen(false); setDetailEmp(null); }}
        title={`WFH History — ${detailEmp?.name}`}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Panel flush>
              <p className="text-xs text-ink-muted">Total WFH Days (selected month)</p>
              <p className="text-2xl font-semibold tnum">{detailEmp?.history.filter((h) => h.workFromHome === true).length ?? 0}</p>
            </Panel>
            <Panel flush>
              <p className="text-xs text-ink-muted">WFH Dates</p>
              <p className="text-sm text-ink-muted">{detailEmp?.history.filter((h) => h.workFromHome === true).map((h) => fmtDate(h.date)).join(', ') ?? '—'}</p>
            </Panel>
            <Panel flush>
              <p className="text-xs text-ink-muted">Total Records</p>
              <p className="text-2xl font-semibold tnum">{detailEmp?.history.length ?? 0}</p>
            </Panel>
          </div>

          <Panel flush>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-ink">Declaration History</h3>
              {isManager && detailEmp && (
                <Button variant="secondary" size="sm" onClick={() => {
                  setDetailOpen(false);
                  const emp = detailEmp;
                  // Offer correction on the most recent record
                  const latest = emp.history[0];
                  if (latest) handleCorrect(emp.employeeId, emp.name, latest.date, latest.workFromHome === true);
                }}>Correct Latest</Button>
              )}
            </div>
            <div className="overflow-x-auto">
              <Table>
                <thead>
                  <Tr>
                    <Th>Date</Th>
                    <Th>Effective Status</Th>
                    <Th>Source</Th>
                    <Th>Declared At</Th>
                    <Th>Corrected By</Th>
                    <Th>Reason</Th>
                  </Tr>
                </thead>
                <tbody>
                  {detailEmp?.history.length === 0 && (
                    <Tr><Td colSpan={6} className="py-8 text-center text-ink-muted">No records.</Td></Tr>
                  )}
                  {detailEmp?.history.map((h) => (
                    <Tr key={h.id}>
                      <Td className="font-medium whitespace-nowrap">{fmtDate(h.date)}</Td>
                      <Td><StatusBadge status={h.workFromHome === true ? 'WFH' : 'Office'} /></Td>
                      <Td className="text-xs text-ink-muted">{h.source.replace('_', ' ')}</Td>
                      <Td className="text-xs text-ink-muted whitespace-nowrap">{h.declaredAt ? new Date(h.declaredAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</Td>
                      <Td className="text-xs text-ink-muted">{h.correctedBy ?? '—'}</Td>
                      <Td className="text-xs text-ink-muted">{h.correctionReason ?? '—'}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </Panel>
        </div>
      </Modal>
    </div>
  );
}
