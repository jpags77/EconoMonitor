'use client'
import { MacroEntry } from '@/lib/types'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

interface Props {
  entries: MacroEntry[]
}

export default function TrendChart({ entries }: Props) {
  // Need at least 2 points to draw a line
  if (entries.length < 2) {
    return (
      <div className="rounded-2xl bg-gray-900 border border-gray-700 p-6">
        <h2 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-4">
          Macro Score Trend (30 days)
        </h2>
        <p className="text-gray-600 text-sm text-center py-8">
          Trend will appear after 2+ days of data
        </p>
      </div>
    )
  }

  // Oldest first for the chart
  const data = [...entries]
    .reverse()
    .map((e) => ({
      date: e.date.slice(5), // MM-DD
      score: e.macro_score,
    }))

  return (
    <div className="rounded-2xl bg-gray-900 border border-gray-700 p-6">
      <h2 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-4">
        Macro Score Trend (30 days)
      </h2>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={data}>
          <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} />
          <YAxis domain={[0, 100]} hide />
          <Tooltip
            contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#9ca3af' }}
            itemStyle={{ color: '#60a5fa' }}
          />
          <ReferenceLine y={50} stroke="#374151" strokeDasharray="4 4" />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#60a5fa"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
