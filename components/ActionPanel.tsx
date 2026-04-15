'use client'

import { useState } from 'react'
import { MacroEntry, ActionBias } from '@/lib/types'

const actionConfig: Record<ActionBias, { label: string; color: string; bg: string; description: string }> = {
  deploy: {
    label: 'DEPLOY CAPITAL',
    color: 'text-green-400',
    bg: 'border-green-500/40 bg-green-950/30',
    description: 'Macro conditions support putting cash to work.',
  },
  hold: {
    label: 'HOLD POSITIONS',
    color: 'text-yellow-400',
    bg: 'border-yellow-500/40 bg-yellow-950/30',
    description: 'Mixed signals — stay put, watch for clarity.',
  },
  bonds: {
    label: 'SHIFT TO BONDS',
    color: 'text-blue-400',
    bg: 'border-blue-500/40 bg-blue-950/30',
    description: 'Rate pressure easing — bonds offer value.',
  },
  'de-risk': {
    label: 'DE-RISK NOW',
    color: 'text-red-400',
    bg: 'border-red-500/40 bg-red-950/30',
    description: 'Conditions deteriorating — reduce exposure.',
  },
}

interface Props {
  entry: MacroEntry
}

export default function ActionPanel({ entry }: Props) {
  const [flipped, setFlipped] = useState(false)
  const config = actionConfig[entry.action_bias]

  return (
    <div
      style={{ perspective: '800px', cursor: 'pointer' }}
      onClick={() => setFlipped(f => !f)}
    >
      <div
        style={{
          display: 'grid',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          transition: 'transform 0.4s ease',
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Front face */}
        <div
          className={`rounded-2xl border p-6 ${config.bg}`}
          style={{ backfaceVisibility: 'hidden', gridArea: '1/1' }}
        >
          <h2 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-4">
            Action Bias
          </h2>
          <div className={`text-3xl font-black ${config.color} mb-2`}>
            {config.label}
          </div>
          <p className="text-gray-400 text-sm">{config.description}</p>
        </div>

        {/* Back face */}
        <div
          className={`rounded-2xl border p-6 flex flex-col gap-3 ${config.bg}`}
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', gridArea: '1/1' }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-gray-400 text-sm font-medium uppercase tracking-wider">
              Action Bias
            </h2>
            <span className={`text-xs font-semibold ${config.color}`}>{config.label}</span>
          </div>
          {entry.action_notes ? (
            <p className="text-gray-400 text-sm leading-relaxed flex-1">{entry.action_notes}</p>
          ) : (
            <p className="text-gray-600 text-sm leading-relaxed flex-1">No notes available for this entry.</p>
          )}
          <span className="text-gray-600 text-xs">tap to flip back</span>
        </div>
      </div>
    </div>
  )
}
