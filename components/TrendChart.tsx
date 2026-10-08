'use client'
import { useState } from 'react'
import { MacroEntry } from '@/lib/types'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import InfoAffordance from './InfoAffordance'

interface Props {
  entries: MacroEntry[]
}

const SCORE_DESCRIPTION =
  'The Macro Score (0–100) reflects the overall health of the macroeconomic environment. ' +
  'Scores above 60 indicate favorable conditions — low volatility, supportive monetary policy, ' +
  'and positive growth signals. 40–60 is mixed. Below 40 suggests elevated risk: tightening ' +
  'conditions, recessionary pressure, or high uncertainty. The score is recalculated daily ' +
  'from Fed policy, inflation, employment, market volatility, and credit conditions.'

export default function TrendChart({ entries }: Props) {
  const [flipped, setFlipped] = useState(false)

  const inner = (front: React.ReactNode) => (
    <div
      style={{ perspective: '800px', cursor: 'pointer', height: '220px' }}
      onClick={() => setFlipped(f => !f)}
      role="button"
      tabIndex={0}
      aria-label="Open macro score explanation"
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setFlipped(f => !f) }}
    >
      <div
        style={{
          display: 'grid',
          height: '100%',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          transition: 'transform 0.4s ease',
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Front */}
        <div
          className="panel p-6"
          style={{ backfaceVisibility: 'hidden', gridArea: '1/1' }}
        >
          {front}
        </div>

        {/* Back */}
        <div
          className="panel p-6 flex flex-col gap-3"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', gridArea: '1/1' }}
        >
          <div className="panel-topline"><h2 className="panel-title">About the Macro Score</h2><InfoAffordance label="Close macro score explanation" /></div>
          <p className="text-gray-400 text-sm leading-relaxed flex-1 overflow-y-auto">
            {SCORE_DESCRIPTION}
          </p>
          <span className="text-gray-600 text-xs shrink-0">tap to flip back</span>
        </div>
      </div>
    </div>
  )

  if (entries.length < 2) {
    return inner(
      <>
        <div className="panel-topline mb-4"><h2 className="panel-title">Macro Score Trend (30 days)</h2><InfoAffordance label="Open macro score explanation" /></div>
        <p className="text-gray-600 text-sm text-center py-8">
          Trend will appear after 2+ days of data
        </p>
      </>
    )
  }

  const data = [...entries]
    .reverse()
    .map((e) => ({
      date: e.date.slice(5),
      score: e.macro_score,
    }))

  return inner(
    <>
      <div className="panel-topline mb-4"><h2 className="panel-title">Macro Score Trend (30 days)</h2><InfoAffordance label="Open macro score explanation" /></div>
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
          <Line type="monotone" dataKey="score" stroke="#60a5fa" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </>
  )
}
