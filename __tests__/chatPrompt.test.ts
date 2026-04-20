import { buildSystemPrompt } from '@/lib/chatPrompt'
import { MacroEntry, TavilyArticle } from '@/lib/types'

const mockEntry: MacroEntry = {
  id: 'test-id',
  created_at: '2026-04-17T00:00:00Z',
  date: '2026-04-17',
  market_environment: 'unfavorable',
  macro_score: 30,
  trend_direction: 'worsening',
  action_bias: 'de-risk',
  equities_score: -1,
  bitcoin_score: -1,
  gold_score: 2,
  bonds_score: 0,
  confidence: 'medium',
  justification: 'Test justification',
  drivers: [],
  headlines: [],
  raw_signals: {
    real_yields: -1,
    fed_expectations: -1,
    inflation_oil: -2,
    dollar_dxy: 1,
    credit_stress: -1,
  },
  key_metrics: {} as never,
  asset_notes: {} as never,
  macro_summary: 'Test summary',
  action_notes: 'Test action notes',
}

describe('buildSystemPrompt', () => {
  it('includes key macro data fields', () => {
    const prompt = buildSystemPrompt(mockEntry, [])
    expect(prompt).toContain('2026-04-17')
    expect(prompt).toContain('unfavorable')
    expect(prompt).toContain('30/100')
    expect(prompt).toContain('de-risk')
    expect(prompt).toContain('Test summary')
  })

  it('includes search result titles and sources when provided', () => {
    const articles: TavilyArticle[] = [
      {
        title: 'Fed holds rates',
        url: 'https://reuters.com/1',
        published_date: '2026-04-17',
        source: 'reuters.com',
      },
    ]
    const prompt = buildSystemPrompt(mockEntry, articles)
    expect(prompt).toContain('Fed holds rates')
    expect(prompt).toContain('reuters.com')
  })

  it('includes fallback text when no articles provided', () => {
    const prompt = buildSystemPrompt(mockEntry, [])
    expect(prompt).toContain('No web search results available.')
  })

  it('includes topic guardrail instruction', () => {
    const prompt = buildSystemPrompt(mockEntry, [])
    expect(prompt).toContain('TOPIC GUARDRAIL')
    expect(prompt).toContain('macro economics and finance')
  })

  it('includes financial advice disclaimer', () => {
    const prompt = buildSystemPrompt(mockEntry, [])
    expect(prompt).toContain('not a financial advisor')
  })
})
