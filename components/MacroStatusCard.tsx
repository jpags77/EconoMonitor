import { MacroEntry } from '@/lib/types'

const environmentColors: Record<string, string> = {
  favorable: 'bg-green-500',
  mixed: 'bg-yellow-500',
  unfavorable: 'bg-red-500',
}

const trendIcons: Record<string, string> = {
  improving: '▲',
  stabilizing: '▶',
  worsening: '▼',
}

const trendColors: Record<string, string> = {
  improving: 'text-green-400',
  stabilizing: 'text-yellow-400',
  worsening: 'text-red-400',
}

interface Props {
  entry: MacroEntry
}

export default function MacroStatusCard({ entry }: Props) {
  const color = environmentColors[entry.market_environment] ?? 'bg-gray-500'
  const trendIcon = trendIcons[entry.trend_direction]
  const trendColor = trendColors[entry.trend_direction]

  return (
    <div className="rounded-2xl bg-gray-900 border border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-gray-400 text-sm font-medium uppercase tracking-wider">
          Macro Environment
        </h2>
        <span className="text-gray-500 text-xs">{entry.date}</span>
      </div>

      <div className="flex items-center gap-4">
        <div className={`w-4 h-4 rounded-full ${color}`} />
        <span className="text-white text-2xl font-bold capitalize">
          {entry.market_environment}
        </span>
        <span className={`text-xl font-bold ${trendColor}`}>
          {trendIcon} {entry.trend_direction}
        </span>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-gray-500 text-xs">Macro Score</span>
          <span className="text-white text-xs font-mono">{entry.macro_score}/100</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${color}`}
            style={{ width: `${entry.macro_score}%` }}
          />
        </div>
      </div>

      <div className="mt-3 text-right">
        <span className="text-gray-500 text-xs">
          Confidence: <span className="text-gray-300 capitalize">{entry.confidence}</span>
        </span>
      </div>
    </div>
  )
}
