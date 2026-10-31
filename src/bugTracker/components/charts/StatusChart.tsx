import React from 'react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Issue } from '../../types/bugTracker';
import { statusStyles } from '../../utils/issueStyles';
import { ALL_STATUSES } from '../../utils/workflow';

export function StatusChart({ issues }: {issues: Issue[];}) {
  const data = ALL_STATUSES.map((status) => ({ status, count: issues.filter((i) => i.status === status).length, fill: statusStyles[status].hex }));
  return (
    <div className="h-72 w-full" role="img" aria-label={`Issues by status: ${data.map((d) => `${d.status} ${d.count}`).join(', ')}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 32, bottom: 4, left: 8 }} barCategoryGap={6}>
          <CartesianGrid horizontal={false} stroke="#EEF0F3" />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: '#667085' }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="status" width={86} tick={{ fontSize: 12, fill: '#344054' }} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: '#F5F6F8' }} contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: '#E4E7EC' }} formatter={(v) => [v, 'Issues']} />
          <Bar dataKey="count" radius={[0, 3, 3, 0]} maxBarSize={18}>
            {data.map((d) =>
            <Cell key={d.status} fill={d.fill} />
            )}
            <LabelList dataKey="count" position="right" style={{ fontSize: 12, fill: '#101828', fontWeight: 600 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>);

}