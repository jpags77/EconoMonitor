import { MacroEntry, KeyMetric, KeyMetrics } from '@/lib/types'

interface Props {
  entry: MacroEntry
}

const TICKER_ITEMS: { key: keyof KeyMetrics; label: string }[] = [
  { key: 'sp500', label: 'S&P 500' },
  { key: 'djia', label: 'Dow' },
  { key: 'nasdaq', label: 'Nasdaq' },
]

function TickerItem({ label, metric }: { label: string; metric: KeyMetric }) {
  const isPositive = metric.change >= 0
  const color = isPositive ? 'text-green-400' : 'text-red-400'
  const arrow = isPositive ? '▲' : '▼'
  return (
    <span className="flex items-baseline gap-2 whitespace-nowrap">
      <span className="text-gray-400 text-xs uppercase tracking-wider">{label}</span>
      <span className="text-white font-semibold text-sm">{metric.value.toLocaleString()}</span>
      <span className={`text-xs ${color}`}>
        {arrow} {Math.abs(metric.change).toLocaleString()}
      </span>
    </span>
  )
}

export default function IndexTicker({ entry }: Props) {
  const km = entry.key_metrics as KeyMetrics | Record<string, never>
  const items = TICKER_ITEMS.filter((i) => i.key in km)
  if (items.length === 0) return null

  return (
    <div className="hidden md:flex fixed top-0 inset-x-0 z-50 h-10 items-center justify-center gap-8 border-b border-gray-800 bg-gray-950/95 backdrop-blur px-4">
      {items.map((i) => (
        <TickerItem key={i.key} label={i.label} metric={(km as KeyMetrics)[i.key]} />
      ))}
    </div>
  )
}
