import { ImageResponse } from 'next/og'
import { supabase } from '@/lib/db'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const environmentColors: Record<string, string> = {
  favorable:   '#22c55e',
  mixed:       '#eab308',
  unfavorable: '#ef4444',
}

const actionLabels: Record<string, string> = {
  deploy:    'DEPLOY CAPITAL',
  hold:      'HOLD POSITIONS',
  bonds:     'SHIFT TO BONDS',
  'de-risk': 'DE-RISK NOW',
}

const actionColors: Record<string, string> = {
  deploy:    '#4ade80',
  hold:      '#facc15',
  bonds:     '#60a5fa',
  'de-risk': '#f87171',
}

export default async function Image() {
  const { data } = await supabase
    .from('macro_entries')
    .select('market_environment, action_bias, macro_score, confidence, date')
    .order('date', { ascending: false })
    .limit(1)
    .single()

  const env        = data?.market_environment ?? 'mixed'
  const bias       = data?.action_bias        ?? 'hold'
  const score      = data?.macro_score        ?? 50
  const confidence = data?.confidence         ?? 'medium'
  const date       = data?.date               ?? ''
  const envColor   = environmentColors[env]   ?? '#9ca3af'
  const biasColor  = actionColors[bias]       ?? '#9ca3af'
  const biasLabel  = actionLabels[bias]       ?? bias.toUpperCase()

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#030712',
        padding: '60px 80px',
        fontFamily: 'sans-serif',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '52px' }}>
        <span style={{ color: '#9ca3af', fontSize: '26px', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
          EconoMonitor
        </span>
        <span style={{ color: '#4b5563', fontSize: '22px' }}>{date}</span>
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, gap: '72px', alignItems: 'stretch' }}>

        {/* Left: environment + score */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
            <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: envColor, flexShrink: 0 }} />
            <span style={{ color: '#ffffff', fontSize: '54px', fontWeight: 700, textTransform: 'capitalize' }}>
              {env}
            </span>
          </div>

          {/* Score bar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6b7280', fontSize: '20px' }}>Macro Score</span>
              <span style={{ color: '#e5e7eb', fontSize: '20px' }}>{score} / 100</span>
            </div>
            <div style={{ width: '100%', height: '10px', backgroundColor: '#1f2937', borderRadius: '5px', display: 'flex' }}>
              <div style={{ width: `${score}%`, height: '10px', backgroundColor: envColor, borderRadius: '5px' }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <span style={{ color: '#6b7280', fontSize: '20px' }}>Confidence:</span>
            <span style={{ color: '#d1d5db', fontSize: '20px', textTransform: 'capitalize' }}>{confidence}</span>
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: '1px', backgroundColor: '#1f2937', flexShrink: 0 }} />

        {/* Right: action bias */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', gap: '20px' }}>
          <span style={{ color: '#6b7280', fontSize: '20px', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
            Action Bias
          </span>
          <span style={{ color: biasColor, fontSize: '58px', fontWeight: 900, lineHeight: 1.1 }}>
            {biasLabel}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', marginTop: '44px', borderTop: '1px solid #1f2937', paddingTop: '24px' }}>
        <span style={{ color: '#374151', fontSize: '18px' }}>
          Daily macro signals powered by Claude AI · Not financial advice
        </span>
      </div>
    </div>
  )
}
