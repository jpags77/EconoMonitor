import Anthropic from '@anthropic-ai/sdk'
import { MacroEntryInput, TavilyArticle } from './types'
import { normalizeScore } from './score'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const SYSTEM_PROMPT = `You are a macro economist analyzing global market conditions.
You will respond ONLY with valid JSON. No markdown, no explanation, no code blocks.
Your JSON must exactly match the schema provided. Be analytical and objective.`

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

For key_metrics, use your web_search tool to look up today's spot prices only. Do not use web_search for anything else.

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
  },
  "asset_notes": {
    "equities": "<2-3 plain-English sentences explaining why equities received their score today>",
    "bitcoin":  "<2-3 plain-English sentences explaining why bitcoin received its score today>",
    "gold":     "<2-3 plain-English sentences explaining why gold received its score today>",
    "bonds":    "<2-3 plain-English sentences explaining why bonds received their score today>"
  },
  "macro_summary": "<2-3 sentences explaining why the macro environment is labeled favorable/mixed/unfavorable today>",
  "action_notes": "<2-3 sentences explaining why this action bias was chosen and what an investor should do with it>"
}
`

export async function generateMacroEntry(articles: TavilyArticle[]): Promise<MacroEntryInput> {
  const today = new Date().toISOString().split('T')[0]

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    tools: [{ type: 'web_search_20250305' as const, name: 'web_search', max_uses: 2 }],
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: USER_PROMPT(today, articles) }],
  })

  // web_search returns multiple content blocks: intro text, tool use/result, then final JSON.
  // Always use the last text block — that's where the final JSON lands.
  const textBlocks = message.content.filter(b => b.type === 'text')
  const textBlock = textBlocks.at(-1)
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error(`No text block in Claude response. Content types: ${message.content.map(b => b.type).join(', ')}`)
  }

  // Strip markdown code fences if present, then extract JSON object
  let jsonText = textBlock.text.trim()
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```[a-zA-Z0-9]*\s*\n?/, '').replace(/\n?```\s*$/, '')
  }
  // Extract JSON object in case Claude adds trailing prose
  const jsonStart = jsonText.indexOf('{')
  const jsonEnd = jsonText.lastIndexOf('}')
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error(`No JSON object found in Claude response. Got: ${textBlock.text.slice(0, 200)}`)
  }
  const rawText = jsonText.slice(jsonStart, jsonEnd + 1)

  const parsed = JSON.parse(rawText)
  if (!parsed.raw_signals) throw new Error(`Claude response missing raw_signals. Got: ${rawText.slice(0, 200)}`)

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
    asset_notes: parsed.asset_notes ?? {},
    macro_summary: parsed.macro_summary ?? '',
    action_notes: parsed.action_notes ?? '',
  }
}
