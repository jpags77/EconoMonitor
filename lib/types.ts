export type TrendDirection = 'improving' | 'stabilizing' | 'worsening'
export type MarketEnvironment = 'favorable' | 'mixed' | 'unfavorable'
export type ActionBias = 'deploy' | 'hold' | 'bonds' | 'de-risk'
export type Confidence = 'low' | 'medium' | 'high'

// Score range: -2 to +2
export type SignalScore = -2 | -1 | 0 | 1 | 2

export interface RawSignals {
  real_yields: SignalScore
  fed_expectations: SignalScore
  inflation_oil: SignalScore
  dollar_dxy: SignalScore
  credit_stress: SignalScore
}

export interface MacroEntry {
  id: string
  created_at: string
  date: string
  market_environment: MarketEnvironment
  macro_score: number          // 0–100 normalized
  trend_direction: TrendDirection
  action_bias: ActionBias
  equities_score: SignalScore
  bitcoin_score: SignalScore
  gold_score: SignalScore
  bonds_score: SignalScore
  confidence: Confidence
  drivers: string[]            // 2–3 bullet strings
  headlines: string[]          // 3–5 headline strings
  raw_signals: RawSignals
}

// What Claude returns (before DB insert)
export type MacroEntryInput = Omit<MacroEntry, 'id' | 'created_at'>
