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

// Driver: plain string (legacy) or grounded article object (new)
export type Driver =
  | string
  | { text: string; url: string; date: string; source: string }

// Headline: plain string (legacy) or grounded article object (new)
export type HeadlineItem = { text: string; url: string }
export type Headline = string | HeadlineItem

export interface KeyMetric {
  value: number
  change: number   // 1-day change in same unit as value
  unit: string     // e.g. "USD/barrel", "%", "points"
}

export interface KeyMetrics {
  oil_wti: KeyMetric
  gold: KeyMetric
  djia: KeyMetric
  nasdaq: KeyMetric
  sp500: KeyMetric
  vix: KeyMetric
  treasury_10y: KeyMetric
}

export interface TavilyArticle {
  title: string
  url: string
  published_date: string
  source: string
}

export interface AssetNotes {
  equities: string
  bitcoin: string
  gold: string
  bonds: string
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
  drivers: Driver[]
  headlines: Headline[]
  raw_signals: RawSignals
  justification: string
  key_metrics: KeyMetrics | Record<string, never>  // {} for old rows
  asset_notes: AssetNotes | Record<string, never>  // {} for old rows
}

// What Claude returns (before DB insert)
export type MacroEntryInput = Omit<MacroEntry, 'id' | 'created_at'>
