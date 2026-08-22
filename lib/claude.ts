import Anthropic from '@anthropic-ai/sdk'
import { MacroEntryInput, TavilyArticle } from './types'
import { normalizeScore } from './score'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL ?? 'openai/gpt-oss-20b:free'
const MOONSHOT_MODEL = process.env.MOONSHOT_MODEL ?? 'moonshot-v1-auto'
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL ?? 'deepseek-v4-flash'

type GenerationProvider = {
  name: 'DeepSeek' | 'Moonshot' | 'OpenRouter'
  endpoint: string
  model: string
}

export function getGenerationProvider(env: Record<string, string | undefined> = process.env): GenerationProvider | null {
  if (env.DEEPSEEK_API_KEY) {
    return { name: 'DeepSeek', endpoint: 'https://api.deepseek.com/chat/completions', model: env.DEEPSEEK_MODEL ?? DEEPSEEK_MODEL }
  }
  if (env.MOONSHOT_API_KEY) {
    return { name: 'Moonshot', endpoint: 'https://api.moonshot.ai/v1/chat/completions', model: env.MOONSHOT_MODEL ?? MOONSHOT_MODEL }
  }
  if (env.OPENROUTER_API_KEY) {
    return { name: 'OpenRouter', endpoint: 'https://openrouter.ai/api/v1/chat/completions', model: env.OPENROUTER_MODEL ?? OPENROUTER_MODEL }
  }
  return null
}

const SYSTEM_PROMPT = `You are a macro economist analyzing global market conditions.
You will respond ONLY with valid JSON. No markdown, no explanation, no code blocks.
Your JSON must exactly match the schema provided. Be analytical and objective.`

const USER_PROMPT = (today: string, articles: TavilyArticle[]) => `
Today is ${today}. Analyze current global macro conditions and return a JSON object.

Here are today's relevant macro news articles for grounding your analysis:
${articles.map((a, i) => `${i + 1}. "${a.title}" — ${a.source}, ${a.published_date} — ${a.url}`).join('\n')}

For key_metrics, use your web_search tool to look up today's spot prices only. Do not use web_search for anything else.

Score each signal from -2 (strongly negative for risk assets) to +2 (strongly positive):
- real_yields: 10Y Treasury yield direction (rising=-2, falling=+2)
- fed_expectations: Fed policy stance (hawkish=-2, dovish=+2)
- inflation: Core inflation trend, CPI/PCE direction (rising=-2, cooling=+2)
- oil: Crude oil price trend as a distinct supply/cost shock (rising=-2, falling=+2)
- dollar_dxy: USD strength (strong=-2, weak=+2)
- credit_stress: Credit/recession risk (rising=-2, low=+2)

Return exactly this JSON structure:
{
  "raw_signals": {
    "real_yields": <-2 to 2>,
    "fed_expectations": <-2 to 2>,
    "inflation": <-2 to 2>,
    "oil": <-2 to 2>,
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

  let jsonText: string
  const provider = getGenerationProvider()
  if (provider) {
    const apiKey = (process.env[`${provider.name.toUpperCase()}_API_KEY`] ?? process.env.DEEPSEEK_API_KEY)?.replace(/^"|"$/g, '')
    const isOpenRouter = provider.name === 'OpenRouter'
    const response = await fetch(provider.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(isOpenRouter ? {
          'HTTP-Referer': 'https://econo-monitor.vercel.app',
          'X-Title': 'EconoMonitor',
        } : {}),
      },
      body: JSON.stringify({
        model: provider.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: USER_PROMPT(today, articles).replace(
              'For key_metrics, use your web_search tool to look up today\'s spot prices only. Do not use web_search for anything else.',
              'For key_metrics, use the current data in the supplied articles and your best current knowledge. Return plausible approximate values.'
            ),
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 4096,
        ...(isOpenRouter ? { reasoning_effort: 'low' } : { thinking: { type: 'disabled' } }),
      }),
    })
    const payload = await response.json() as {
      error?: { message?: string }
      choices?: Array<{ message?: { content?: string | null } }>
    }
    if (!response.ok) throw new Error(`${provider.name} ${response.status}: ${payload.error?.message ?? 'request failed'}`)
    jsonText = payload.choices?.[0]?.message?.content?.trim() ?? ''
    if (!jsonText) throw new Error(`${provider.name} returned no text content`)
  } else {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      tools: [{ type: 'web_search_20250305' as const, name: 'web_search', max_uses: 2 }],
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: USER_PROMPT(today, articles) }],
    })

    const textBlocks = message.content.filter(b => b.type === 'text')
    const textBlock = textBlocks.at(-1)
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error(`No text block in Claude response. Content types: ${message.content.map(b => b.type).join(', ')}`)
    }
    jsonText = textBlock.text.trim()
  }

  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```[a-zA-Z0-9]*\s*\n?/, '').replace(/\n?```\s*$/, '')
  }
  const jsonStart = jsonText.indexOf('{')
  const jsonEnd = jsonText.lastIndexOf('}')
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error(`No JSON object found in model response. Got: ${jsonText.slice(0, 200)}`)
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
    schema_version: 2,
    macro_score: normalizeScore(rawSum, 6),
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
    market_commentary: '',
  }
}
