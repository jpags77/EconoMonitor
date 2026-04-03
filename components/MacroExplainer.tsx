import { MacroEntry, MarketEnvironment } from '@/lib/types'
import { scoreBgColor } from '@/lib/scoreColors'

interface Props {
  entry: MacroEntry
}

const signalLabel: Record<number, string> = {
  2: 'Strongly Positive',
  1: 'Positive',
  0: 'Neutral',
  [-1]: 'Negative',
  [-2]: 'Strongly Negative',
}

const signalDisplayName: Record<string, string> = {
  real_yields: 'Real Yields',
  fed_expectations: 'Fed Expectations',
  inflation_oil: 'Inflation / Oil',
  dollar_dxy: 'Dollar (DXY)',
  credit_stress: 'Credit Stress',
}

const environmentLabel: Record<MarketEnvironment, string> = {
  favorable: 'Favorable',
  mixed: 'Mixed',
  unfavorable: 'Unfavorable',
}

export default function MacroExplainer({ entry }: Props) {
  const signals = Object.entries(entry.raw_signals) as [string, number][]

  return (
    <div className="rounded-2xl bg-gray-900 border border-gray-700 p-6 space-y-4">
      <h2 className="text-gray-400 text-sm font-medium uppercase tracking-wider">
        Why {environmentLabel[entry.market_environment]}?
      </h2>

      <div className="space-y-3">
        {signals.map(([key, score]) => (
          <div key={key} className="flex items-center gap-3">
            <span className="text-gray-400 text-sm w-36 shrink-0">
              {signalDisplayName[key] ?? key}
            </span>
            <div className="flex gap-1 flex-1">
              {[-2, -1, 0, 1, 2].map((s) => (
                <div
                  key={s}
                  className={`h-2 flex-1 rounded-full ${
                    s <= score ? scoreBgColor[score] : 'bg-gray-700'
                  }`}
                />
              ))}
            </div>
            <span className="text-gray-500 text-xs w-32 text-right shrink-0">
              {signalLabel[score]}
            </span>
          </div>
        ))}
      </div>

      {entry.justification && (
        <p className="text-gray-400 text-sm leading-relaxed border-t border-gray-800 pt-4">
          {entry.justification}
        </p>
      )}
    </div>
  )
}
