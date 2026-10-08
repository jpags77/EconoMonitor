import { MacroEntry } from '@/lib/types'
import InfoAffordance from './InfoAffordance'

interface Props {
  entry: MacroEntry
}

export default function MarketExplainer({ entry }: Props) {
  if (!entry.market_commentary) return null

  return (
    <div className="panel p-6 space-y-3 mt-4">
      <div className="panel-topline"><h2 className="panel-title">Market vs. Macro</h2><InfoAffordance label="Open market commentary details" /></div>
      <p className="text-gray-300 text-sm leading-relaxed">
        {entry.market_commentary}
      </p>
      <p className="text-gray-600 text-xs">
        How the S&amp;P 500, Dow, and Nasdaq moved relative to EconoMonitor&apos;s recent scores.
      </p>
    </div>
  )
}
