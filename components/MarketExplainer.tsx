import { MacroEntry } from '@/lib/types'

interface Props {
  entry: MacroEntry
}

export default function MarketExplainer({ entry }: Props) {
  if (!entry.market_commentary) return null

  return (
    <div className="rounded-2xl bg-gray-900 border border-gray-700 p-6 space-y-3">
      <h2 className="text-gray-400 text-sm font-medium uppercase tracking-wider">
        Market vs. Macro
      </h2>
      <p className="text-gray-300 text-sm leading-relaxed">
        {entry.market_commentary}
      </p>
      <p className="text-gray-600 text-xs">
        How the S&amp;P 500, Dow, and Nasdaq moved relative to EconoMonitor&apos;s recent scores.
      </p>
    </div>
  )
}
