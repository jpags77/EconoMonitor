import { ActionBias } from '@/lib/types'

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
  actionBias: ActionBias
}

export default function ActionPanel({ actionBias }: Props) {
  const config = actionConfig[actionBias]

  return (
    <div className={`rounded-2xl border p-6 ${config.bg}`}>
      <h2 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-4">
        Action Bias
      </h2>
      <div className={`text-3xl font-black ${config.color} mb-2`}>
        {config.label}
      </div>
      <p className="text-gray-400 text-sm">{config.description}</p>
    </div>
  )
}
