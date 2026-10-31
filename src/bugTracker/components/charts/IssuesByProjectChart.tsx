import React from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface IssuesByProjectChartProps {
  data: {project: string;open: number;resolved: number;}[];
}

export function IssuesByProjectChart({ data }: IssuesByProjectChartProps) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 8 }} barCategoryGap={10}>
          <CartesianGrid horizontal={false} stroke="#EEF0F3" />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#667085' }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="project" width={124} tick={{ fontSize: 12, fill: '#344054' }} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: '#F5F6F8' }} contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: '#E4E7EC' }} />
          <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="open" name="Open" stackId="a" fill="#2B59C3">
            <LabelList dataKey="open" position="center" style={{ fontSize: 11, fill: '#FFFFFF', fontWeight: 600 }} formatter={(v) => (v ? v : '')} />
          </Bar>
          <Bar dataKey="resolved" name="Resolved & closed" stackId="a" fill="#ABEFC6" radius={[0, 3, 3, 0]}>
            <LabelList dataKey="resolved" position="center" style={{ fontSize: 11, fill: '#067647', fontWeight: 600 }} formatter={(v) => (v ? v : '')} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>);

}