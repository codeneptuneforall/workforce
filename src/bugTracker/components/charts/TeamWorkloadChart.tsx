import React from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { workloadCapacity } from '../../data/trackerConfig';
import { statusStyles } from '../../utils/issueStyles';

interface TeamWorkloadChartProps {
  data: {name: string;toStart: number;inProgress: number;reopened: number;withQa: number;}[];
}

export function TeamWorkloadChart({ data }: TeamWorkloadChartProps) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: -16 }} barCategoryGap="30%">
          <CartesianGrid vertical={false} stroke="#EEF0F3" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#344054' }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#667085' }} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: '#F5F6F8' }} contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: '#E4E7EC' }} />
          <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          <ReferenceLine y={workloadCapacity} stroke="#101828" strokeDasharray="4 3" label={{ value: `Capacity ${workloadCapacity}`, position: 'insideTopRight', fontSize: 11, fill: '#475467' }} />
          <Bar dataKey="toStart" name="To start" stackId="w" fill={statusStyles.Assigned.hex} maxBarSize={36} />
          <Bar dataKey="inProgress" name="In progress" stackId="w" fill={statusStyles['In Progress'].hex} maxBarSize={36} />
          <Bar dataKey="reopened" name="Reopened" stackId="w" fill={statusStyles.Reopened.hex} maxBarSize={36} />
          <Bar dataKey="withQa" name="With QA" stackId="w" fill={statusStyles['QA Testing'].hex} radius={[3, 3, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>);

}