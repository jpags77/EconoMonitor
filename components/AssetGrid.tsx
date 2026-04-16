'use client'

import { useState } from 'react'
import { MacroEntry, SignalScore, AssetNotes } from '@/lib/types'
import { scoreColor, scoreBgColor } from '@/lib/scoreColors'

const scoreLabel: Record<number, string> = {
  2: 'Strong Buy',
  1: 'Buy',
  0: 'Neutral',
  [-1]: 'Caution',
  [-2]: 'Avoid',
}

function AssetCard({ name, score, emoji, note }: {
  name: string
  score: SignalScore
  emoji: string
  note: string
}) {
  const [flipped, setFlipped] = useState(false)

  return (
    <div
      style={{ perspective: '600px', cursor: 'pointer', height: '170px' }}
      onClick={() => setFlipped(f => !f)}
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
        {/* Front face */}
        <div
          className="rounded-xl bg-gray-800 border border-gray-700 p-4 flex flex-col justify-between"
          style={{ backfaceVisibility: 'hidden', gridArea: '1/1' }}
        >
          <div className="flex items-center gap-2">
            <span className="text-xl">{emoji}</span>
            <span className="text-gray-300 font-medium">{name}</span>
          </div>
          <div className={`text-lg font-bold ${scoreColor[score]}`}>
            {scoreLabel[score]}
          </div>
          <div className="flex gap-1">
            {[-2, -1, 0, 1, 2].map((s) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full ${
                  s <= score ? scoreBgColor[score] : 'bg-gray-700'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Back face */}
        <div
          className="rounded-xl bg-gray-800 border border-gray-700 p-4 flex flex-col gap-2"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', gridArea: '1/1', overflow: 'hidden' }}
        >
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xl">{emoji}</span>
            <span className="text-gray-300 font-medium">{name}</span>
            <span className={`text-xs font-semibold ml-auto ${scoreColor[score]}`}>
              {scoreLabel[score]}
            </span>
          </div>
          {note ? (
            <p className="text-gray-400 text-xs leading-relaxed flex-1 overflow-y-auto">{note}</p>
          ) : (
            <p className="text-gray-600 text-xs leading-relaxed flex-1">No analysis available for this entry.</p>
          )}
          <span className="text-gray-600 text-xs shrink-0">tap to flip back</span>
        </div>
      </div>
    </div>
  )
}

interface Props {
  entry: MacroEntry
}

export default function AssetGrid({ entry }: Props) {
  const notes = (entry.asset_notes ?? {}) as Partial<AssetNotes>

  return (
    <div className="rounded-2xl bg-gray-900 border border-gray-700 p-6">
      <h2 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-4">
        Asset Signals
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <AssetCard name="Equities" score={entry.equities_score} emoji="📈" note={notes.equities ?? ''} />
        <AssetCard name="Bitcoin"  score={entry.bitcoin_score}  emoji="₿"  note={notes.bitcoin  ?? ''} />
        <AssetCard name="Gold"     score={entry.gold_score}     emoji="🟡" note={notes.gold     ?? ''} />
        <AssetCard name="Bonds"    score={entry.bonds_score}    emoji="📄" note={notes.bonds    ?? ''} />
      </div>
    </div>
  )
}
