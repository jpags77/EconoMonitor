import { MacroEntry, KeyMetric } from '@/lib/types'

interface Props {
  entry: MacroEntry
}

const metricDisplayName: Record<string, string> = {
  oil_wti: 'WTI Crude',
  gold: 'Gold',
  djia: 'Dow Jones',
  nasdaq: 'Nasdaq',
  sp500: 'S&P 500',
  vix: 'VIX',
  treasury_10y: '10Y Yield',
}

function MetricCard({ name, metric }: { name: string; metric: KeyMetric }) {
  const isPositive = metric.change >= 0
  const changeColor = isPositive ? 'text-green-400' : 'text-red-400'
  const arrow = isPositive ? '▲' : '▼'

  return (
    <div className="rounded-xl bg-gray-800 border border-gray-700 p-4 flex flex-col gap-1">
      <span className="text-gray-500 text-xs uppercase tracking-wider">{name}</span>
      <span className="text-white font-semibold text-lg">
        {metric.value.toLocaleString()} <span className="text-gray-500 text-xs font-normal">{metric.unit}</span>
      </span>
      <span className={`text-xs ${changeColor}`}>
        {arrow} {Math.abs(metric.change).toLocaleString()} {metric.unit}
      </span>
    </div>
  )
}

export default function KeyMetrics({ entry }: Props) {
  const metrics = entry.key_metrics
  const isEmpty = Object.keys(metrics).length === 0

  if (isEmpty) {
    return (
      <div className="rounded-2xl bg-gray-900 border border-gray-700 p-6">
        <h2 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-4">
          Market Data
        </h2>
        <p className="text-gray-600 text-sm">Market data unavailable for this entry.</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-gray-900 border border-gray-700 p-6">
      <h2 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-4">
        Market Data
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(Object.entries(metrics) as [string, KeyMetric][]).map(([key, metric]) => (
          <MetricCard
            key={key}
            name={metricDisplayName[key] ?? key}
            metric={metric}
          />
        ))}
      </div>
    </div>
  )
}
