import React from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { severities } from '../../data/trackerConfig';
import type { Issue } from '../../types/bugTracker';
import { severityStyles } from '../../utils/issueStyles';

export function SeverityChart({ issues }: {issues: Issue[];}) {
  const data = severities.map((s) => ({ name: s, value: issues.filter((i) => i.severity === s).length, fill: severityStyles[s].hex }));
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row lg:flex-col xl:flex-row">
      <div className="relative h-44 w-44 shrink-0" role="img" aria-label={`Severity: ${data.map((d) => `${d.name} ${d.value}`).join(', ')}`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={total ? data : [{ name: 'None', value: 1, fill: '#EEF0F3' }]} dataKey="value" innerRadius={52} outerRadius={78} paddingAngle={total ? 2 : 0} stroke="none">
              {(total ? data : [{ name: 'None', value: 1, fill: '#EEF0F3' }]).map((d) =>
              <Cell key={d.name} fill={d.fill} />
              )}
            </Pie>
            {total > 0 && <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: '#E4E7EC' }} />}
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold text-ink tabular-nums">{total}</span>
          <span className="text-xs text-ink-subtle">open</span>
        </div>
      </div>
      <ul className="w-full space-y-2">
        {data.map((d) =>
        <li key={d.name} className="flex items-center gap-2 text-[13px]">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: d.fill }} aria-hidden="true" />
            <span className="flex-1 text-ink-muted">{d.name}</span>
            <span className="font-semibold text-ink tabular-nums">{d.value}</span>
            <span className="w-10 text-right text-xs text-ink-faint tabular-nums">{total ? Math.round(d.value / total * 100) : 0}%</span>
          </li>
        )}
      </ul>
    </div>);

}