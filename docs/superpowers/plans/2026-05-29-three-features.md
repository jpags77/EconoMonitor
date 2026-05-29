# EconoMonitor Three Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a quantitative ML-ready daily score series (splitting oil and inflation into separate signals), a desktop floating index ticker (S&P/DJIA/Nasdaq), and a daily LLM commentary box that rationalizes market index moves against recent EconoMonitor scores.

**Architecture:** Extend the existing `macro_entries` Supabase table rather than adding a parallel table — one daily write path via the `/api/generate` cron. Splitting `inflation_oil` into `inflation` + `oil` grows `raw_signals` from 5 to 6 dimensions (range ±10 → ±12), so we stamp `schema_version` (v1 legacy 5-signal, v2 new 6-signal) and make score normalization signal-count-aware. A SQL view flattens `raw_signals` + index closes into numeric columns for future ML export. The market-commentary LLM call runs once per day inside the cron and is stored on the row. The index ticker is a desktop-only fixed bar fed from the latest entry's `key_metrics` (no new data source).

**Tech Stack:** Next.js 16 (App Router, force-dynamic SSR), TypeScript, Supabase (Postgres/jsonb), Anthropic Claude SDK (`claude-sonnet-4-6`), Tailwind CSS v4, Jest + ts-jest.

---

## File Structure

**Modified:**
- `lib/score.ts` — make `normalizeScore` signal-count-aware (default 5 keeps legacy behavior).
- `lib/score.test.ts` — add 6-signal normalization cases.
- `lib/types.ts` — split `RawSignals`, add `schema_version` and `market_commentary` to `MacroEntry`.
- `supabase/schema.sql` — add `schema_version` + `market_commentary` columns and the `daily_scores_v` view.
- `lib/claude.ts` — emit 6 signals (separate oil + inflation), stamp `schema_version: 2`, normalize over 6 signals.
- `app/api/generate/route.ts` — fetch ~30-day history, generate + store `market_commentary`.
- `components/MacroExplainer.tsx` — add `inflation` and `oil` signal labels (keep legacy `inflation_oil`).
- `app/page.tsx` — render `<IndexTicker>` and `<MarketExplainer>`, update subtitle to 6 dimensions, add body top padding for the fixed bar.

**Created:**
- `lib/commentary.ts` — `generateMarketCommentary(entry, history)` Claude call.
- `components/IndexTicker.tsx` — desktop-only fixed index bar.
- `components/MarketExplainer.tsx` — renders `latest.market_commentary`.

**Apply order:** Task 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8. Tasks 1–6 are Feature 1 + Feature 3 plumbing; Task 7 is Feature 3 UI; Task 8 is Feature 2 (independent).

---

## Task 1: Signal-count-aware score normalization

**Files:**
- Modify: `lib/score.ts`
- Test: `lib/score.test.ts`

- [ ] **Step 1: Add failing tests for the 6-signal case**

Append to `lib/score.test.ts`:

```typescript
test('6-signal max (+12) normalizes to 100', () => {
  expect(normalizeScore(12, 6)).toBe(100)
})

test('6-signal min (-12) normalizes to 0', () => {
  expect(normalizeScore(-12, 6)).toBe(0)
})

test('6-signal neutral (0) normalizes to 50', () => {
  expect(normalizeScore(0, 6)).toBe(50)
})

test('6-signal out-of-range high (20) clamps to 100', () => {
  expect(normalizeScore(20, 6)).toBe(100)
})

test('default signalCount stays 5 (legacy behavior)', () => {
  expect(normalizeScore(10)).toBe(100)
})
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npm test -- score.test`
Expected: the 6-signal tests FAIL (`normalizeScore` ignores the second argument and uses ±10), legacy tests still pass.

- [ ] **Step 3: Make `normalizeScore` count-aware**

Replace the full contents of `lib/score.ts` with:

```typescript
// Each signal ranges ±2. With N signals, raw sum ranges ±(2N).
// Default N=5 preserves legacy 5-signal (±10) behavior.
export function normalizeScore(rawSum: number, signalCount = 5): number {
  const max = signalCount * 2
  const min = -max
  const clamped = Math.max(min, Math.min(max, rawSum))
  return Math.round(((clamped - min) / (max - min)) * 100)
}
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `npm test -- score.test`
Expected: PASS (all legacy + new 6-signal tests green).

- [ ] **Step 5: Commit**

```bash
git add lib/score.ts lib/score.test.ts
git commit -m "feat: make normalizeScore signal-count-aware for 6-signal split"
```

---

## Task 2: Split RawSignals and extend MacroEntry types

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Split `RawSignals` into 6 dimensions**

In `lib/types.ts`, replace the `RawSignals` interface:

```typescript
export interface RawSignals {
  real_yields: SignalScore
  fed_expectations: SignalScore
  inflation: SignalScore
  oil: SignalScore
  dollar_dxy: SignalScore
  credit_stress: SignalScore
}
```

- [ ] **Step 2: Add `schema_version` and `market_commentary` to `MacroEntry`**

In `lib/types.ts`, inside the `MacroEntry` interface, add these two fields after `action_notes`:

```typescript
  schema_version: number       // 1 = legacy 5-signal (±10), 2 = 6-signal (±12)
  market_commentary: string    // LLM commentary contrasting index moves vs macro scores
```

(Note: `MacroEntryInput = Omit<MacroEntry, 'id' | 'created_at'>` already picks these up — no change needed there.)

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: errors ONLY in `lib/claude.ts` (still emits `inflation_oil` / missing new fields) — those are fixed in Task 4. No errors in `lib/types.ts` itself.

- [ ] **Step 4: Commit**

```bash
git add lib/types.ts
git commit -m "feat: split RawSignals oil/inflation, add schema_version and market_commentary"
```

---

## Task 3: Database migration — columns + ML view

**Files:**
- Modify: `supabase/schema.sql`

- [ ] **Step 1: Append migration SQL**

Append to the end of `supabase/schema.sql`:

```sql
-- Three-features migration (2026-05-29)
-- schema_version: 1 = legacy 5-signal (inflation_oil), 2 = 6-signal (inflation + oil split)
alter table macro_entries add column if not exists schema_version integer not null default 1;
alter table macro_entries add column if not exists market_commentary text not null default '';

-- ML-ready flattened numeric view. v2 rows only (consistent 6-signal schema).
create or replace view daily_scores_v as
select
  date,
  schema_version,
  (raw_signals->>'real_yields')::int       as real_yields,
  (raw_signals->>'fed_expectations')::int  as fed_expectations,
  (raw_signals->>'inflation')::int         as inflation,
  (raw_signals->>'oil')::int               as oil,
  (raw_signals->>'dollar_dxy')::int        as dollar_dxy,
  (raw_signals->>'credit_stress')::int     as credit_stress,
  macro_score,
  (key_metrics->'sp500'->>'value')::numeric        as sp500,
  (key_metrics->'djia'->>'value')::numeric         as djia,
  (key_metrics->'nasdaq'->>'value')::numeric       as nasdaq,
  (key_metrics->'oil_wti'->>'value')::numeric      as oil_wti,
  (key_metrics->'gold'->>'value')::numeric         as gold,
  (key_metrics->'vix'->>'value')::numeric          as vix,
  (key_metrics->'treasury_10y'->>'value')::numeric as treasury_10y
from macro_entries
where schema_version = 2
order by date;
```

- [ ] **Step 2: Apply migration to Supabase**

Run the two `alter table` statements and the `create or replace view` against the live database via the Supabase SQL editor (dashboard) or `psql`. The `add column if not exists` statements are idempotent and safe to re-run.

> Note: new column default is `1` so existing legacy rows are correctly tagged v1. Task 4 makes new inserts write `schema_version: 2`. The view returns zero rows until the first v2 row lands — expected.

- [ ] **Step 3: Verify the view exists**

In the Supabase SQL editor run: `select * from daily_scores_v limit 1;`
Expected: succeeds (0 rows until first v2 insert). If it errors on a column, re-check the `raw_signals`/`key_metrics` key names against `lib/types.ts`.

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: add schema_version, market_commentary columns and daily_scores_v ML view"
```

---

## Task 4: Update Claude generation prompt to 6 signals

**Files:**
- Modify: `lib/claude.ts`

- [ ] **Step 1: Replace the signal-scoring instructions in `USER_PROMPT`**

In `lib/claude.ts`, replace the block listing the five signals (the lines from `Score each signal...` through `- credit_stress: ...`) with:

```typescript
Score each signal from -2 (strongly negative for risk assets) to +2 (strongly positive):
- real_yields: 10Y Treasury yield direction (rising=-2, falling=+2)
- fed_expectations: Fed policy stance (hawkish=-2, dovish=+2)
- inflation: Core inflation trend, CPI/PCE direction (rising=-2, cooling=+2)
- oil: Crude oil price trend as a distinct supply/cost shock (rising=-2, falling=+2)
- dollar_dxy: USD strength (strong=-2, weak=+2)
- credit_stress: Credit/recession risk (rising=-2, low=+2)
```

- [ ] **Step 2: Replace the `raw_signals` block in the JSON schema string**

In the same `USER_PROMPT`, replace the `"raw_signals": { ... }` object with:

```typescript
  "raw_signals": {
    "real_yields": <-2 to 2>,
    "fed_expectations": <-2 to 2>,
    "inflation": <-2 to 2>,
    "oil": <-2 to 2>,
    "dollar_dxy": <-2 to 2>,
    "credit_stress": <-2 to 2>
  },
```

- [ ] **Step 3: Pass the 6-signal count to `normalizeScore` and stamp `schema_version`**

In `generateMacroEntry`, change the `macro_score` line and add `schema_version` to the returned object. The `rawSum` computation already sums all keys generically — no change there. Update the return:

```typescript
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
```

(`market_commentary` is set to `''` here and populated in Task 5 inside the route, so the `MacroEntryInput` shape is complete.)

- [ ] **Step 4: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no errors in `lib/claude.ts` or `lib/types.ts`. (Errors may still appear in `app/api/generate/route.ts` only if Task 5 not yet done — but Task 4 alone should leave the route compiling since it doesn't reference new fields yet.)

- [ ] **Step 5: Commit**

```bash
git add lib/claude.ts
git commit -m "feat: generate 6 signals with separate oil and inflation, stamp schema_version 2"
```

---

## Task 5: Market-vs-macro commentary generation

**Files:**
- Create: `lib/commentary.ts`
- Modify: `app/api/generate/route.ts`

- [ ] **Step 1: Create the commentary generator**

Create `lib/commentary.ts`:

```typescript
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
```

- [ ] **Step 2: Wire commentary into the generate route**

In `app/api/generate/route.ts`:

(a) Add the import near the top with the other lib imports:

```typescript
import { generateMarketCommentary } from '@/lib/commentary'
```

(b) Replace the recent-entries query (the block that selects `macro_score` limited to 3) so it pulls the fields commentary needs, while still computing trend from the same data. Replace:

```typescript
    // Get last 3 entries to compute trend
    const { data: recent } = await supabase
      .from('macro_entries')
      .select('macro_score')
      .order('date', { ascending: false })
      .limit(3)

    const recentScores = (recent ?? []).map((r: { macro_score: number }) => r.macro_score)
```

with:

```typescript
    // Pull recent history: trend uses last 3, commentary uses up to 30.
    const { data: history } = await supabase
      .from('macro_entries')
      .select('date, macro_score, key_metrics')
      .order('date', { ascending: false })
      .limit(30)

    const historyRows = history ?? []
    const recentScores = historyRows
      .slice(0, 3)
      .map((r: { macro_score: number }) => r.macro_score)
```

(c) After the `entry.trend_direction = computeTrend(...)` line and before the insert, generate and attach the commentary:

```typescript
    // Feature 3: reconcile market moves against macro scores
    entry.market_commentary = await generateMarketCommentary(entry, historyRows)
```

- [ ] **Step 3: Verify the whole project typechecks and builds**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS, no type errors. (`history` rows are typed structurally by the `Pick<...>` in `generateMarketCommentary`.)

- [ ] **Step 4: Commit**

```bash
git add lib/commentary.ts app/api/generate/route.ts
git commit -m "feat: generate and store daily market-vs-macro commentary"
```

---

## Task 6: Show separate oil + inflation in the macro explainer

**Files:**
- Modify: `components/MacroExplainer.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Add new signal labels (keep legacy)**

In `components/MacroExplainer.tsx`, replace the `signalDisplayName` map:

```typescript
const signalDisplayName: Record<string, string> = {
  real_yields: 'Real Yields',
  fed_expectations: 'Fed Expectations',
  inflation: 'Inflation',
  oil: 'Oil',
  inflation_oil: 'Inflation / Oil', // legacy v1 rows
  dollar_dxy: 'Dollar (DXY)',
  credit_stress: 'Credit Stress',
}
```

(The component already iterates `Object.entries(entry.raw_signals)`, so v2 rows render 6 bars and legacy v1 rows still render their combined bar.)

- [ ] **Step 2: Update the dashboard subtitle to list 6 dimensions**

In `app/page.tsx`, replace the subtitle `<p>` text:

```tsx
        <p className="text-gray-400 text-sm max-w-2xl">
          Scores 6 macro signals daily — real yields, Fed expectations, inflation, oil, USD strength, and credit stress — synthesized by Claude AI from live market data and news into an environment label, action bias, and per-asset guidance. Not financial advice.
        </p>
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/MacroExplainer.tsx app/page.tsx
git commit -m "feat: render separate inflation and oil signals, update subtitle"
```

---

## Task 7: Market explainer UI box (Feature 3 render)

**Files:**
- Create: `components/MarketExplainer.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Create the component**

Create `components/MarketExplainer.tsx`:

```tsx
import { MacroEntry } from '@/lib/types'

interface Props {
  entry: MacroEntry
}

export default function MarketExplainer({ entry }: Props) {
  if (!entry.market_commentary) return null

  return (
    <div className="rounded-2xl bg-gray-900 border border-gray-700 p-6 space-y-3">
      <h2 className="text-gray-400 text-sm font-medium uppercase tracking-wider">
        Market vs. Macro
      </h2>
      <p className="text-gray-300 text-sm leading-relaxed">
        {entry.market_commentary}
      </p>
      <p className="text-gray-600 text-xs">
        How the S&amp;P 500, Dow, and Nasdaq moved relative to EconoMonitor&apos;s recent scores.
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Render it on the dashboard**

In `app/page.tsx`, add the import with the other component imports:

```tsx
import MarketExplainer from '@/components/MarketExplainer'
```

Then place it after `<KeyMetrics entry={latest} />` and before `<AssetGrid entry={latest} />`:

```tsx
      <MarketExplainer entry={latest} />
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/MarketExplainer.tsx app/page.tsx
git commit -m "feat: add market-vs-macro explainer box to dashboard"
```

---

## Task 8: Floating desktop index ticker (Feature 2)

**Files:**
- Create: `components/IndexTicker.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Create the ticker component**

Create `components/IndexTicker.tsx`:

```tsx
import { MacroEntry, KeyMetric, KeyMetrics } from '@/lib/types'

interface Props {
  entry: MacroEntry
}

const TICKER_ITEMS: { key: keyof KeyMetrics; label: string }[] = [
  { key: 'sp500', label: 'S&P 500' },
  { key: 'djia', label: 'Dow' },
  { key: 'nasdaq', label: 'Nasdaq' },
]

function TickerItem({ label, metric }: { label: string; metric: KeyMetric }) {
  const isPositive = metric.change >= 0
  const color = isPositive ? 'text-green-400' : 'text-red-400'
  const arrow = isPositive ? '▲' : '▼'
  return (
    <span className="flex items-baseline gap-2 whitespace-nowrap">
      <span className="text-gray-400 text-xs uppercase tracking-wider">{label}</span>
      <span className="text-white font-semibold text-sm">{metric.value.toLocaleString()}</span>
      <span className={`text-xs ${color}`}>
        {arrow} {Math.abs(metric.change).toLocaleString()}
      </span>
    </span>
  )
}

export default function IndexTicker({ entry }: Props) {
  const km = entry.key_metrics as KeyMetrics | Record<string, never>
  const items = TICKER_ITEMS.filter((i) => i.key in km)
  if (items.length === 0) return null

  return (
    <div className="hidden md:flex fixed top-0 inset-x-0 z-50 h-10 items-center justify-center gap-8 border-b border-gray-800 bg-gray-950/95 backdrop-blur px-4">
      {items.map((i) => (
        <TickerItem key={i.key} label={i.label} metric={(km as KeyMetrics)[i.key]} />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Render it and offset desktop content so the bar doesn't overlap**

In `app/page.tsx`:

(a) Add the import:

```tsx
import IndexTicker from '@/components/IndexTicker'
```

(b) The dashboard has two return paths (the "no data" branch and the main branch). Render the ticker at the top of the main `<main>` and add desktop top padding so content clears the 40px (`h-10`) fixed bar. Change the main wrapper opening tag:

```tsx
    <main className="max-w-6xl mx-auto px-4 py-8 md:pt-14 space-y-4">
      <IndexTicker entry={latest} />
```

(The `<IndexTicker>` is `position: fixed` so it does not occupy flow; `md:pt-14` (56px) on desktop pushes the H1 below the 40px bar. Mobile keeps `py-8` and never shows the bar.)

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Manual verification in the browser**

Run: `npm run dev`, open http://localhost:3000 on a desktop-width window.
Expected: a thin bar pinned to the top showing S&P 500 / Dow / Nasdaq with values and colored change; the H1 sits below it (not hidden behind it). Narrow the window below the `md` breakpoint (768px): the bar disappears and layout is unchanged.

- [ ] **Step 5: Commit**

```bash
git add components/IndexTicker.tsx app/page.tsx
git commit -m "feat: add desktop floating S&P/Dow/Nasdaq index ticker"
```

---

## Final Verification

- [ ] **Full typecheck + build**

Run: `npx tsc --noEmit && npm run build && npm test`
Expected: all green.

- [ ] **End-to-end generation (writes one v2 row + commentary)**

With the dev server running and `CRON_SECRET` set in `.env.local`, trigger a real generation:

```bash
curl -s -H "Authorization: Bearer $(grep '^CRON_SECRET=' .env.local | cut -d= -f2)" http://localhost:3000/api/generate | head -c 400
```

Expected: JSON `{"success":true,"entry":{...}}` where the entry has `schema_version: 2`, six keys in `raw_signals` (incl. separate `inflation` and `oil`), and a non-empty `market_commentary` (if ≥1 prior row exists).

- [ ] **Verify ML view returns the new row**

In the Supabase SQL editor: `select date, inflation, oil, macro_score, sp500 from daily_scores_v order by date desc limit 3;`
Expected: the freshly generated v2 row appears with separate `inflation` and `oil` integer columns.

- [ ] **Dashboard smoke test**

Reload http://localhost:3000: the macro explainer shows 6 signal bars, the "Market vs. Macro" box shows commentary, and the desktop index ticker is pinned at top.

---

## Notes & Deferred

- **Schema seam:** the `TrendChart` plots `macro_score` across both v1 and v2 rows. Because v2 reweights the composite, there is a one-time discontinuity at the first v2 date. Acceptable for MVP; a visual marker on the chart is deferred.
- **Live quotes:** the ticker uses the daily snapshot from `key_metrics`; intraday/live quotes via a market-data API are explicitly deferred (no API key today, free tiers often expose only ETF proxies).
- **Legacy rows:** v1 rows keep `inflation_oil` in `raw_signals` and are excluded from `daily_scores_v` (ML trains on consistent v2 data only).
