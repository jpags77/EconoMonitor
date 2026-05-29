import Anthropic from '@anthropic-ai/sdk'
import { MacroEntryInput, MacroEntry, KeyMetrics } from './types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a macro strategist writing a short daily note.
You reconcile how the major U.S. equity indices have moved against EconoMonitor's
internal macro scores. Be concrete, reference specific score moves and index moves,
and call out agreement or divergence between them. 3-5 sentences. Plain prose, no markdown.`

type IndexCloses = { sp500?: number; djia?: number; nasdaq?: number; macro_score: number; date: string }

function extractCloses(e: Pick<MacroEntry, 'date' | 'macro_score' | 'key_metrics'>): IndexCloses {
  const km = e.key_metrics as KeyMetrics | Record<string, never>
  const val = (k: keyof KeyMetrics) =>
    k in km ? (km as KeyMetrics)[k]?.value : undefined
  return {
    date: e.date,
    macro_score: e.macro_score,
    sp500: val('sp500'),
    djia: val('djia'),
    nasdaq: val('nasdaq'),
  }
}

// `history` is prior entries, newest first (excludes today's new entry).
export async function generateMarketCommentary(
  entry: MacroEntryInput,
  history: Pick<MacroEntry, 'date' | 'macro_score' | 'key_metrics'>[]
): Promise<string> {
  const series = [
    { date: entry.date, macro_score: entry.macro_score, key_metrics: entry.key_metrics },
    ...history,
  ]
    .map(extractCloses)
    .reverse() // oldest first for readability

  if (series.length < 2) {
    return '' // not enough history to compare movements yet
  }

  const table = series
    .map(
      (s) =>
        `${s.date}: macro_score=${s.macro_score}` +
        ` sp500=${s.sp500 ?? 'n/a'} djia=${s.djia ?? 'n/a'} nasdaq=${s.nasdaq ?? 'n/a'}`
    )
    .join('\n')

  const userPrompt = `Here is the recent daily series (oldest first). macro_score is EconoMonitor's 0-100 composite (higher = more favorable for risk assets); the others are index closing levels.

${table}

Write a 3-5 sentence note explaining how the S&P 500, Dow, and Nasdaq moved over the past week and month relative to EconoMonitor's macro_score trajectory. Where did the market agree with the macro signals, and where did it diverge? Be specific with directions and rough magnitudes.`

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const textBlock = message.content.filter((b) => b.type === 'text').at(-1)
  if (!textBlock || textBlock.type !== 'text') return ''
  return textBlock.text.trim()
}
