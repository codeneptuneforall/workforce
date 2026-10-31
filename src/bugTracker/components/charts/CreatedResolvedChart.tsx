import React from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface CreatedResolvedChartProps {
  data: {week: string;created: number;resolved: number;}[];
}

export function CreatedResolvedChart({ data }: CreatedResolvedChartProps) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 8, bottom: 0, left: -16 }} barGap={2} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke="#EEF0F3" />
          <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#667085' }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#667085' }} axisLine={false} tickLine={false} label={{ value: 'Issues', angle: -90, position: 'insideLeft', offset: 24, style: { fontSize: 11, fill: '#98A2B3' } }} />
          <Tooltip cursor={{ fill: '#F5F6F8' }} contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: '#E4E7EC' }} />
          <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          <Bar dataKey="created" name="Created" fill="#2B59C3" radius={[3, 3, 0, 0]} maxBarSize={22}>
            <LabelList dataKey="created" position="top" style={{ fontSize: 10, fill: '#344054' }} />
          </Bar>
          <Bar dataKey="resolved" name="Resolved" fill="#079455" radius={[3, 3, 0, 0]} maxBarSize={22}>
            <LabelList dataKey="resolved" position="top" style={{ fontSize: 10, fill: '#344054' }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>);

}