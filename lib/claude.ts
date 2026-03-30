import Anthropic from '@anthropic-ai/sdk'
import { MacroEntryInput } from './types'
import { normalizeScore } from './score'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const SYSTEM_PROMPT = `You are a macro economist analyzing global market conditions.
You will respond ONLY with valid JSON. No markdown, no explanation, no code blocks.
Your JSON must exactly match the schema provided. Be analytical and objective.`

const USER_PROMPT = (today: string) => `
Today is ${today}. Analyze current global macro conditions and return a JSON object.

Score each signal from -2 (strongly negative for risk assets) to +2 (strongly positive):
- real_yields: 10Y Treasury yield direction (rising=-2, falling=+2)
- fed_expectations: Fed policy stance (hawkish=-2, dovish=+2)
- inflation_oil: Oil/inflation trend (rising=-2, falling=+2)
- dollar_dxy: USD strength (strong=-2, weak=+2)
- credit_stress: Credit/recession risk (rising=-2, low=+2)

Return exactly this JSON structure:
{
  "raw_signals": {
    "real_yields": <-2 to 2>,
    "fed_expectations": <-2 to 2>,
    "inflation_oil": <-2 to 2>,
    "dollar_dxy": <-2 to 2>,
    "credit_stress": <-2 to 2>
  },
  "market_environment": "<favorable|mixed|unfavorable>",
  "trend_direction": "<improving|stabilizing|worsening>",
  "action_bias": "<deploy|hold|bonds|de-risk>",
  "equities_score": <-2 to 2>,
  "bitcoin_score": <-2 to 2>,
  "gold_score": <-2 to 2>,
  "bonds_score": <-2 to 2>,
  "confidence": "<low|medium|high>",
  "drivers": ["<driver 1>", "<driver 2>", "<driver 3>"],
  "headlines": ["<headline 1>", "<headline 2>", "<headline 3>", "<headline 4>", "<headline 5>"]
}
`

export async function generateMacroEntry(): Promise<MacroEntryInput> {
  const today = new Date().toISOString().split('T')[0]

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: USER_PROMPT(today) }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  if (!text) throw new Error(`Claude returned no text content. Stop reason: ${message.stop_reason}`)
  const parsed = JSON.parse(text)
  if (!parsed.raw_signals) throw new Error(`Claude response missing raw_signals. Got: ${text.slice(0, 200)}`)

  const rawSum = Object.values(parsed.raw_signals as Record<string, number>).reduce(
    (a, b) => a + b,
    0
  )

  return {
    date: today,
    macro_score: normalizeScore(rawSum),
    raw_signals: parsed.raw_signals,
    market_environment: parsed.market_environment,
    trend_direction: parsed.trend_direction,
    action_bias: parsed.action_bias,
    equities_score: parsed.equities_score,
    bitcoin_score: parsed.bitcoin_score,
    gold_score: parsed.gold_score,
    bonds_score: parsed.bonds_score,
    confidence: parsed.confidence,
    drivers: parsed.drivers,
    headlines: parsed.headlines,
  }
}
