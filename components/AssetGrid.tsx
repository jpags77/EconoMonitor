import { MacroEntry, SignalScore } from '@/lib/types'

const scoreLabel: Record<number, string> = {
  2: 'Strong Buy',
  1: 'Buy',
  0: 'Neutral',
  [-1]: 'Caution',
  [-2]: 'Avoid',
}

const scoreColor: Record<number, string> = {
  2: 'text-green-400',
  1: 'text-green-300',
  0: 'text-gray-400',
  [-1]: 'text-orange-400',
  [-2]: 'text-red-400',
}

function AssetCard({ name, score, emoji }: { name: string; score: SignalScore; emoji: string }) {
  return (
    <div className="rounded-xl bg-gray-800 border border-gray-700 p-4 flex flex-col gap-2">
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
              s <= score ? scoreColor[score].replace('text-', 'bg-') : 'bg-gray-700'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

interface Props {
  entry: MacroEntry
}

export default function AssetGrid({ entry }: Props) {
  return (
    <div className="rounded-2xl bg-gray-900 border border-gray-700 p-6">
      <h2 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-4">
        Asset Signals
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <AssetCard name="Equities" score={entry.equities_score} emoji="📈" />
        <AssetCard name="Bitcoin" score={entry.bitcoin_score} emoji="₿" />
        <AssetCard name="Gold" score={entry.gold_score} emoji="🟡" />
        <AssetCard name="Bonds" score={entry.bonds_score} emoji="📄" />
      </div>
    </div>
  )
}
