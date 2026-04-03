import Anthropic from '@anthropic-ai/sdk'
import { MacroEntryInput } from './types'
import { normalizeScore } from './score'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const SYSTEM_PROMPT = `You are a macro economist analyzing global market conditions.
You will respond ONLY with valid JSON. No markdown, no explanation, no code blocks.
Your JSON must exactly match the schema provided. Be analytical and objective.`

interface TavilyArticle {
  title: string
  url: string
  published_date: string
  source: string
}

const USER_PROMPT = (today: string, articles: TavilyArticle[]) => `
Today is ${today}. Analyze current global macro conditions and return a JSON object.

Here are today's relevant macro news articles for grounding your analysis:
${articles.map((a, i) => `${i + 1}. "${a.title}" — ${a.source}, ${a.published_date} — ${a.url}`).join('\n')}

Score each signal from -2 (strongly negative for risk assets) to +2 (strongly positive):
- real_yields: 10Y Treasury yield direction (rising=-2, falling=+2)
- fed_expectations: Fed policy stance (hawkish=-2, dovish=+2)
- inflation_oil: Oil/inflation trend (rising=-2, falling=+2)
- dollar_dxy: USD strength (strong=-2, weak=+2)
- credit_stress: Credit/recession risk (rising=-2, low=+2)

For key_metrics, use your web_search tool to find today's current market prices.

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
  "justification": "<2-3 sentences explaining why the macro score landed where it did>",
  "drivers": [
    { "text": "<driver 1>", "url": "<url from article list>", "date": "<published_date from article>", "source": "<source from article>" },
    { "text": "<driver 2>", "url": "<url from article list>", "date": "<published_date from article>", "source": "<source from article>" }
  ],
  "headlines": [
    { "text": "<headline 1>", "url": "<url from article list>" },
    { "text": "<headline 2>", "url": "<url from article list>" },
    { "text": "<headline 3>", "url": "<url from article list>" }
  ],
  "key_metrics": {
    "oil_wti":      { "value": <number>, "change": <number>, "unit": "USD/barrel" },
    "gold":         { "value": <number>, "change": <number>, "unit": "USD/oz" },
    "djia":         { "value": <number>, "change": <number>, "unit": "points" },
    "nasdaq":       { "value": <number>, "change": <number>, "unit": "points" },
    "sp500":        { "value": <number>, "change": <number>, "unit": "points" },
    "vix":          { "value": <number>, "change": <number>, "unit": "index" },
    "treasury_10y": { "value": <number>, "change": <number>, "unit": "%" }
  }
}
`

export async function generateMacroEntry(articles: TavilyArticle[]): Promise<MacroEntryInput> {
  const today = new Date().toISOString().split('T')[0]

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    tools: [{ type: 'web_search_20250305' as const, name: 'web_search', max_uses: 5 }],
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: USER_PROMPT(today, articles) }],
  })

  // With tools enabled, content may have tool_use/tool_result blocks — find the text block
  const textBlock = message.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error(`No text block in Claude response. Content types: ${message.content.map(b => b.type).join(', ')}`)
  }

  // Strip markdown code fences if present (Claude sometimes wraps JSON in ```json ... ```)
  let rawText = textBlock.text.trim()
  if (rawText.startsWith('```')) {
    rawText = rawText.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
  }

  const parsed = JSON.parse(rawText)
  if (!parsed.raw_signals) throw new Error(`Claude response missing raw_signals. Got: ${textBlock.text.slice(0, 200)}`)

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
    justification: parsed.justification ?? '',
    drivers: parsed.drivers ?? [],
    headlines: parsed.headlines ?? [],
    key_metrics: parsed.key_metrics ?? {},
  }
}
