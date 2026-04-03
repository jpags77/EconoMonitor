# Dashboard Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add grounded headlines (Tavily), key metrics panel (Claude web_search), macro explainer with signal bars and justification, and per-driver article links (Tavily) — all populated in the existing daily cron.

**Architecture:** Tavily search runs first in the cron handler and passes articles to Claude. Claude's API call gains the `web_search` tool for autonomous price lookups. Claude returns an expanded JSON payload including `justification`, `key_metrics`, structured `HeadlineItem[]`, and structured `Driver[]`. Two new DB columns (`justification`, `key_metrics`) are added. Three new/updated components render the data.

**Tech Stack:** Next.js App Router, TypeScript, Supabase (Postgres/JSONB), Tailwind CSS, Anthropic SDK (`@anthropic-ai/sdk ^0.80`), Tavily API (`TAVILY_API_KEY`)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `lib/types.ts` | Modify | Add `Driver`, `HeadlineItem`, `KeyMetric`, `KeyMetrics` types; update `MacroEntry` |
| `lib/scoreColors.ts` | Create | Shared `scoreBgColor` / `scoreColor` maps extracted from `AssetGrid.tsx` |
| `lib/claude.ts` | Modify | Add web_search tool, update prompt, fix response parser, accept Tavily articles |
| `app/api/generate/route.ts` | Modify | Add Tavily search step; pass articles to `generateMacroEntry` |
| `supabase/schema.sql` | Modify | Add `key_metrics jsonb` and `justification text` columns |
| `components/AssetGrid.tsx` | Modify | Import `scoreBgColor`/`scoreColor` from `lib/scoreColors.ts` |
| `components/DriversHeadlines.tsx` | Modify | Union type guard for `Driver[]` and `HeadlineItem[]`; render links, dates, sources, timestamp |
| `components/MacroExplainer.tsx` | Create | Signal bars + justification text |
| `components/KeyMetrics.tsx` | Create | 4-col market price grid |
| `app/page.tsx` | Modify | Insert `MacroExplainer` and `KeyMetrics` into layout |

---

## Task 1: Extract shared score color maps

**Files:**
- Create: `lib/scoreColors.ts`
- Modify: `components/AssetGrid.tsx`

- [ ] **Step 1: Create `lib/scoreColors.ts`**

```typescript
// lib/scoreColors.ts
export const scoreColor: Record<number, string> = {
  2: 'text-green-400',
  1: 'text-green-300',
  0: 'text-gray-400',
  [-1]: 'text-orange-400',
  [-2]: 'text-red-400',
}

// Explicit bg map — avoids dynamic class construction that Tailwind can't purge-scan
export const scoreBgColor: Record<number, string> = {
  2: 'bg-green-400',
  1: 'bg-green-300',
  0: 'bg-gray-400',
  [-1]: 'bg-orange-400',
  [-2]: 'bg-red-400',
}
```

- [ ] **Step 2: Update `components/AssetGrid.tsx` to import from shared utility**

Replace the local `scoreColor` and `scoreBgColor` declarations (lines 11–26) with imports:

```typescript
import { MacroEntry, SignalScore } from '@/lib/types'
import { scoreColor, scoreBgColor } from '@/lib/scoreColors'

const scoreLabel: Record<number, string> = {
  2: 'Strong Buy',
  1: 'Buy',
  0: 'Neutral',
  [-1]: 'Caution',
  [-2]: 'Avoid',
}
```

Remove the now-duplicate `scoreColor` and `scoreBgColor` const blocks. The rest of the file is unchanged.

- [ ] **Step 3: Verify the app still renders**

```bash
curl -s http://localhost:3000 | grep -i 'econoMonitor\|Strong Buy\|Neutral' | head -5
```

Expected: HTML containing dashboard content (no 500 error).

- [ ] **Step 4: Commit**

```bash
git add lib/scoreColors.ts components/AssetGrid.tsx
git commit -m "refactor: extract scoreBgColor/scoreColor to lib/scoreColors.ts"
```

---

## Task 2: Update TypeScript types

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Replace `lib/types.ts` with the updated version**

```typescript
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
}

// What Claude returns (before DB insert)
export type MacroEntryInput = Omit<MacroEntry, 'id' | 'created_at'>
```

- [ ] **Step 2: Check TypeScript compiles**

```bash
cd /Users/jeff/Documents/git/EconoMonitor && npx tsc --noEmit 2>&1 | head -30
```

Expected: errors only in files that haven't been updated yet (`DriversHeadlines.tsx`, `lib/claude.ts`). That's fine — they'll be fixed in later tasks.

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add Driver, HeadlineItem, KeyMetric types to MacroEntry"
```

---

## Task 3: Run Supabase migration

**Files:**
- Modify: `supabase/schema.sql`

- [ ] **Step 1: Add columns to `supabase/schema.sql`**

Append to the end of `supabase/schema.sql`:

```sql
-- Dashboard enhancements migration (2026-04-03)
alter table macro_entries add column if not exists key_metrics jsonb not null default '{}';
alter table macro_entries add column if not exists justification text not null default '';
```

- [ ] **Step 2: Run the migration in Supabase**

Go to the Supabase dashboard → SQL Editor, paste and run:

```sql
alter table macro_entries add column if not exists key_metrics jsonb not null default '{}';
alter table macro_entries add column if not exists justification text not null default '';
```

Verify: `select column_name from information_schema.columns where table_name = 'macro_entries';` should include `key_metrics` and `justification`.

- [ ] **Step 3: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: add key_metrics and justification columns to macro_entries"
```

---

## Task 4: Update Claude generation — Tavily + web_search + expanded prompt

**Files:**
- Modify: `lib/claude.ts`
- Modify: `app/api/generate/route.ts`

- [ ] **Step 1: Update `lib/claude.ts`**

Replace the entire file:

```typescript
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

  const parsed = JSON.parse(textBlock.text)
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
```

- [ ] **Step 2: Update `app/api/generate/route.ts` to add Tavily search**

Replace the entire file:

```typescript
import { NextResponse } from 'next/server'
import { generateMacroEntry } from '@/lib/claude'
import { supabase } from '@/lib/db'
import { TrendDirection } from '@/lib/types'

// PRD Section 7: compare today's score vs. 3-day average
function computeTrend(newScore: number, recentScores: number[]): TrendDirection {
  if (recentScores.length === 0) return 'stabilizing'
  const avg = recentScores.reduce((a, b) => a + b, 0) / recentScores.length
  if (newScore > avg + 5) return 'improving'
  if (newScore < avg - 5) return 'worsening'
  return 'stabilizing'
}

interface TavilyResult {
  title: string
  url: string
  published_date: string
  source: string
}

async function fetchMacroArticles(): Promise<TavilyResult[]> {
  const queries = ['macroeconomic news today', 'fed interest rates inflation tariffs']
  const results: TavilyResult[] = []

  for (const query of queries) {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        search_depth: 'basic',
        max_results: 4,
        include_domains: [],
        topic: 'news',
      }),
    })
    if (!res.ok) {
      console.error(`Tavily search failed for "${query}": ${res.status}`)
      continue
    }
    const data = await res.json()
    for (const r of data.results ?? []) {
      results.push({
        title: r.title ?? '',
        url: r.url ?? '',
        published_date: r.published_date ?? new Date().toISOString().split('T')[0],
        source: new URL(r.url).hostname.replace('www.', ''),
      })
    }
  }

  return results
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get last 3 entries to compute trend
    const { data: recent } = await supabase
      .from('macro_entries')
      .select('macro_score')
      .order('date', { ascending: false })
      .limit(3)

    const recentScores = (recent ?? []).map((r: { macro_score: number }) => r.macro_score)

    // Step 1: Tavily — fetch grounding articles for headlines + drivers
    const articles = await fetchMacroArticles()
    if (articles.length === 0) {
      console.warn('Tavily returned no articles — proceeding with empty context')
    }

    // Step 2: Claude — generate entry (uses web_search for prices, articles for grounding)
    const entry = await generateMacroEntry(articles)

    // Override Claude's trend_direction with computed value from historical data
    entry.trend_direction = computeTrend(entry.macro_score, recentScores)

    const { data, error } = await supabase
      .from('macro_entries')
      .insert(entry)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, entry: data })
  } catch (err) {
    console.error('Generate error:', err)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Check TypeScript compiles**

```bash
cd /Users/jeff/Documents/git/EconoMonitor && npx tsc --noEmit 2>&1 | head -30
```

Expected: only errors in component files not yet updated (`DriversHeadlines.tsx`). No errors in `lib/claude.ts` or `app/api/generate/route.ts`.

- [ ] **Step 4: Test locally**

```bash
curl -s -X GET http://localhost:3000/api/generate \
  -H "Authorization: Bearer $(grep CRON_SECRET .env.local | cut -d= -f2)" \
  --max-time 90 | jq '{success, date: .entry.date, justification: .entry.justification, key_metrics_keys: (.entry.key_metrics | keys), driver_type: (.entry.drivers[0] | type)}'
```

Expected output:
```json
{
  "success": true,
  "date": "2026-04-03",
  "justification": "<non-empty string>",
  "key_metrics_keys": ["djia", "gold", "nasdaq", "oil_wti", "sp500", "treasury_10y", "vix"],
  "driver_type": "object"
}
```

- [ ] **Step 5: Commit**

```bash
git add lib/claude.ts app/api/generate/route.ts
git commit -m "feat: add Tavily grounding and Claude web_search for metrics in cron"
```

---

## Task 5: Update `DriversHeadlines.tsx`

**Files:**
- Modify: `components/DriversHeadlines.tsx`

- [ ] **Step 1: Replace `components/DriversHeadlines.tsx`**

```tsx
import { MacroEntry, Driver, Headline } from '@/lib/types'

interface Props {
  entry: MacroEntry
}

function isDriverObject(d: Driver): d is { text: string; url: string; date: string; source: string } {
  return typeof d === 'object'
}

function isHeadlineObject(h: Headline): h is { text: string; url: string } {
  return typeof h === 'object' && 'url' in h
}

export default function DriversHeadlines({ entry }: Props) {
  const timestamp = new Date(entry.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="rounded-2xl bg-gray-900 border border-gray-700 p-6 space-y-6">
      <div>
        <h2 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-3">
          Key Drivers
        </h2>
        <ul className="space-y-3">
          {entry.drivers.map((driver, i) => (
            <li key={i} className="flex gap-2 text-sm">
              <span className="text-blue-400 mt-0.5 shrink-0">▸</span>
              {isDriverObject(driver) ? (
                <div>
                  <a
                    href={driver.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-300 border-b border-gray-600 hover:border-gray-400 hover:text-white transition-colors"
                  >
                    {driver.text}
                  </a>
                  <div className="text-gray-500 text-xs mt-0.5">
                    {driver.date} · {driver.source}
                  </div>
                </div>
              ) : (
                <span className="text-gray-300">{driver}</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-gray-400 text-sm font-medium uppercase tracking-wider">
            Signal Headlines
          </h2>
          <span className="text-gray-600 text-xs">{timestamp}</span>
        </div>
        <ul className="space-y-2">
          {entry.headlines.map((headline, i) => (
            <li key={i} className="text-sm border-l-2 border-gray-700 pl-3">
              {isHeadlineObject(headline) ? (
                <a
                  href={headline.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-gray-200 transition-colors"
                >
                  {headline.text}
                </a>
              ) : (
                <span className="text-gray-400">{headline}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Check TypeScript compiles cleanly**

```bash
cd /Users/jeff/Documents/git/EconoMonitor && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors in `DriversHeadlines.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/DriversHeadlines.tsx
git commit -m "feat: render grounded driver links and headline links in DriversHeadlines"
```

---

## Task 6: Create `MacroExplainer.tsx`

**Files:**
- Create: `components/MacroExplainer.tsx`

- [ ] **Step 1: Create `components/MacroExplainer.tsx`**

```tsx
import { MacroEntry, MarketEnvironment } from '@/lib/types'
import { scoreBgColor } from '@/lib/scoreColors'

interface Props {
  entry: MacroEntry
}

const signalLabel: Record<number, string> = {
  2: 'Strongly Positive',
  1: 'Positive',
  0: 'Neutral',
  [-1]: 'Negative',
  [-2]: 'Strongly Negative',
}

const signalDisplayName: Record<string, string> = {
  real_yields: 'Real Yields',
  fed_expectations: 'Fed Expectations',
  inflation_oil: 'Inflation / Oil',
  dollar_dxy: 'Dollar (DXY)',
  credit_stress: 'Credit Stress',
}

const environmentLabel: Record<MarketEnvironment, string> = {
  favorable: 'Favorable',
  mixed: 'Mixed',
  unfavorable: 'Unfavorable',
}

export default function MacroExplainer({ entry }: Props) {
  const signals = Object.entries(entry.raw_signals) as [string, number][]

  return (
    <div className="rounded-2xl bg-gray-900 border border-gray-700 p-6 space-y-4">
      <h2 className="text-gray-400 text-sm font-medium uppercase tracking-wider">
        Why {environmentLabel[entry.market_environment]}?
      </h2>

      <div className="space-y-3">
        {signals.map(([key, score]) => (
          <div key={key} className="flex items-center gap-3">
            <span className="text-gray-400 text-sm w-36 shrink-0">
              {signalDisplayName[key] ?? key}
            </span>
            <div className="flex gap-1 flex-1">
              {[-2, -1, 0, 1, 2].map((s) => (
                <div
                  key={s}
                  className={`h-2 flex-1 rounded-full ${
                    s <= score ? scoreBgColor[score] : 'bg-gray-700'
                  }`}
                />
              ))}
            </div>
            <span className="text-gray-500 text-xs w-32 text-right shrink-0">
              {signalLabel[score]}
            </span>
          </div>
        ))}
      </div>

      {entry.justification && (
        <p className="text-gray-400 text-sm leading-relaxed border-t border-gray-800 pt-4">
          {entry.justification}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Check TypeScript compiles**

```bash
cd /Users/jeff/Documents/git/EconoMonitor && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/MacroExplainer.tsx
git commit -m "feat: add MacroExplainer component with signal bars and justification"
```

---

## Task 7: Create `KeyMetrics.tsx`

**Files:**
- Create: `components/KeyMetrics.tsx`

- [ ] **Step 1: Create `components/KeyMetrics.tsx`**

```tsx
import { MacroEntry, KeyMetric } from '@/lib/types'

interface Props {
  entry: MacroEntry
}

const metricDisplayName: Record<string, string> = {
  oil_wti: 'WTI Crude',
  gold: 'Gold',
  djia: 'Dow Jones',
  nasdaq: 'Nasdaq',
  sp500: 'S&P 500',
  vix: 'VIX',
  treasury_10y: '10Y Yield',
}

function MetricCard({ name, metric }: { name: string; metric: KeyMetric }) {
  const isPositive = metric.change >= 0
  const changeColor = isPositive ? 'text-green-400' : 'text-red-400'
  const arrow = isPositive ? '▲' : '▼'

  return (
    <div className="rounded-xl bg-gray-800 border border-gray-700 p-4 flex flex-col gap-1">
      <span className="text-gray-500 text-xs uppercase tracking-wider">{name}</span>
      <span className="text-white font-semibold text-lg">
        {metric.value.toLocaleString()} <span className="text-gray-500 text-xs font-normal">{metric.unit}</span>
      </span>
      <span className={`text-xs ${changeColor}`}>
        {arrow} {Math.abs(metric.change).toLocaleString()} {metric.unit}
      </span>
    </div>
  )
}

export default function KeyMetrics({ entry }: Props) {
  const metrics = entry.key_metrics
  const isEmpty = Object.keys(metrics).length === 0

  if (isEmpty) {
    return (
      <div className="rounded-2xl bg-gray-900 border border-gray-700 p-6">
        <h2 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-4">
          Market Data
        </h2>
        <p className="text-gray-600 text-sm">Market data unavailable for this entry.</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-gray-900 border border-gray-700 p-6">
      <h2 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-4">
        Market Data
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(Object.entries(metrics) as [string, KeyMetric][]).map(([key, metric]) => (
          <MetricCard
            key={key}
            name={metricDisplayName[key] ?? key}
            metric={metric}
          />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Check TypeScript compiles**

```bash
cd /Users/jeff/Documents/git/EconoMonitor && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/KeyMetrics.tsx
git commit -m "feat: add KeyMetrics component with 4-col market price grid"
```

---

## Task 8: Wire components into `app/page.tsx`

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Update `app/page.tsx`**

```tsx
import MacroStatusCard from '@/components/MacroStatusCard'
import ActionPanel from '@/components/ActionPanel'
import AssetGrid from '@/components/AssetGrid'
import TrendChart from '@/components/TrendChart'
import DriversHeadlines from '@/components/DriversHeadlines'
import MacroExplainer from '@/components/MacroExplainer'
import KeyMetrics from '@/components/KeyMetrics'
import { supabase } from '@/lib/db'
import { MacroEntry } from '@/lib/types'

export const dynamic = 'force-dynamic'

// Query Supabase directly — no self-referential HTTP call needed in App Router
async function getEntries(): Promise<MacroEntry[]> {
  const { data, error } = await supabase
    .from('macro_entries')
    .select('*')
    .order('date', { ascending: false })
    .limit(30)

  if (error) {
    console.error('Failed to load entries:', error.message)
    return []
  }
  return data as MacroEntry[]
}

export default async function Dashboard() {
  const entries = await getEntries()
  const latest = entries[0]

  if (!latest) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-12 text-center">
        <h1 className="text-3xl font-bold text-white mb-2">EconoMonitor</h1>
        <p className="text-gray-400 mb-6">No data yet. Trigger a generation to get started.</p>
        <code className="text-sm text-gray-500 bg-gray-900 px-4 py-2 rounded">
          GET /api/generate
        </code>
      </main>
    )
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">EconoMonitor</h1>
        <p className="text-gray-500 text-sm">
          &ldquo;We are not predicting the future. We are detecting when the present is changing.&rdquo;
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MacroStatusCard entry={latest} />
        <ActionPanel actionBias={latest.action_bias} />
      </div>

      <MacroExplainer entry={latest} />

      <KeyMetrics entry={latest} />

      <AssetGrid entry={latest} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TrendChart entries={entries} />
        <DriversHeadlines entry={latest} />
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Full TypeScript check**

```bash
cd /Users/jeff/Documents/git/EconoMonitor && npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 3: Verify dev server renders**

```bash
curl -s http://localhost:3000 | grep -i 'Why\|Market Data\|Key Drivers' | head -5
```

Expected: HTML containing "Why", "Market Data", "Key Drivers".

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add MacroExplainer and KeyMetrics to dashboard layout"
```

---

## Task 9: Add TAVILY_API_KEY to Vercel production env and deploy

- [ ] **Step 1: Add TAVILY_API_KEY to Vercel**

Go to `vercel.com/jpags77/econo-monitor/settings/environment-variables` and add:

| Key | Value | Environments |
|-----|-------|--------------|
| `TAVILY_API_KEY` | *(from `.env.local`)* | Production, Preview, Development |

- [ ] **Step 2: Push and deploy**

```bash
git push origin main
```

- [ ] **Step 3: Verify production deployment**

```bash
curl -s "https://api.vercel.com/v6/deployments?projectId=prj_7FURp5RLQ3pisWobLdnh6L1003bA&teamId=team_KUvomcq7xRpSXNKvkPGbKMdU&limit=1" \
  -H "Authorization: Bearer $(grep VERCEL_TOKEN .env.local | cut -d= -f2)" | \
  jq -r '.deployments[0].state'
```

Expected: `READY`

- [ ] **Step 4: End-to-end test on production**

```bash
curl -s -X GET https://econo-monitor.vercel.app/api/generate \
  -H "Authorization: Bearer $(grep CRON_SECRET .env.local | cut -d= -f2)" \
  --max-time 90 | jq '{success, justification: .entry.justification, vix: .entry.key_metrics.vix, driver_type: (.entry.drivers[0] | type)}'
```

Expected:
```json
{
  "success": true,
  "justification": "<non-empty string>",
  "vix": { "value": <number>, "change": <number>, "unit": "index" },
  "driver_type": "object"
}
```

- [ ] **Step 5: Check dashboard renders new components**

Visit `https://econo-monitor.vercel.app` — confirm "Why Mixed?" (or equivalent), market data grid, and linked drivers are visible.
