# EconoMonitor Dashboard Enhancements — Design Spec

**Date:** 2026-03-31
**Status:** Approved

---

## Overview

Three enhancements to the EconoMonitor dashboard:

1. **Grounded headlines** — real article links via Claude web search, with freshness timestamp
2. **Key metrics panel** — daily market prices (Oil, Gold, DJIA, Nasdaq, S&P 500, VIX, 10Y yield)
3. **Macro explainer** — signal score breakdown + Claude-written justification for the environment score

All three are populated during the existing daily cron job — no new scheduled tasks required.

**Deployment order:** Run the Supabase migration (new columns) BEFORE deploying the new UI code. Old rows will have `key_metrics = {}` and `justification = ''` — both are valid defaults and the UI handles them gracefully.

---

## Feature 1: Grounded Headlines with Timestamps

### What changes

The Claude API call in `lib/claude.ts` is upgraded to pass the **web_search tool** in the `tools` array. Claude autonomously uses web search to find real macro news stories, cites actual URLs, and returns headlines as `{ text, url }` objects.

### web_search tool integration

The Anthropic web_search tool is added to the `messages.create` call:

```typescript
tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }]
```

When tools are enabled, the response `content` array may contain multiple blocks of type `tool_use`, `tool_result`, and `text`. The current parser (`message.content[0].type === 'text'`) must be updated to find the final text block:

```typescript
const textBlock = message.content.find(b => b.type === 'text')
if (!textBlock || textBlock.type !== 'text') {
  throw new Error(`No text block in Claude response. Content types: ${message.content.map(b => b.type).join(', ')}`)
}
const text = textBlock.text
```

This change applies once and covers all three features (headlines, metrics, justification are all in the same JSON response).

### Data model

`headlines` column type stays `jsonb` — shape changes from `string[]` to `{ text: string; url: string }[]`. No migration needed for the column itself.

```sql
-- No column change needed; shape change only.
-- Old rows retain string[] shape and are handled by the UI union type guard.
```

### TypeScript type changes

```typescript
// lib/types.ts

export interface HeadlineItem {
  text: string
  url: string
}

// MacroEntry.headlines updated to union — reflects actual DB runtime shape
// (old rows contain string[], new rows contain HeadlineItem[])
headlines: (string | HeadlineItem)[]
```

`DriversHeadlines.tsx` discriminates old vs. new shape at render time:

```typescript
function isHeadlineItem(h: string | HeadlineItem): h is HeadlineItem {
  return typeof h === 'object' && 'url' in h
}
// Old rows render as plain text; new rows render as <a> links
```

### Timestamp display

`entry.created_at` (stored as `timestamptz`) is rendered using `toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })` — e.g. "Mar 31, 2026, 10:00 AM". Displayed at the top of the Signal Headlines section.

---

## Feature 2: Key Metrics Panel

### What changes

The same Claude call (with web_search) fetches current daily values for 7 market metrics. These are stored in a new `key_metrics` jsonb column on `macro_entries`.

### Metrics tracked

| Key | Metric | Unit |
|---|---|---|
| `oil_wti` | WTI Crude Oil | USD/barrel |
| `gold` | Gold Spot | USD/oz |
| `djia` | Dow Jones | points |
| `nasdaq` | Nasdaq Composite | points |
| `sp500` | S&P 500 | points |
| `vix` | CBOE VIX | index |
| `treasury_10y` | 10Y Treasury Yield | % |

### TypeScript types

```typescript
// lib/types.ts

export interface KeyMetric {
  value: number
  change: number    // 1-day change, always in the same unit as value
  unit: string      // "USD/barrel", "%", "points" — applies to both value and change
  // Note: treasury_10y change is in percentage points (e.g. +0.05 = 5bps)
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

// Added to MacroEntry:
key_metrics: KeyMetrics
// Added to MacroEntryInput (inherited automatically via Omit<MacroEntry, 'id'|'created_at'>)
```

### Data model migration

```sql
alter table macro_entries add column key_metrics jsonb not null default '{}';
```

Old rows will have `key_metrics = {}`. `KeyMetrics.tsx` renders an empty state ("Metrics unavailable") when `Object.keys(entry.key_metrics).length === 0`.

### web_search failure handling

If Claude cannot retrieve metric values via web search, the cron job throws and returns a 500 — no partial row is inserted. The dashboard continues showing the previous day's data.

### New component: `components/KeyMetrics.tsx`

Renders a responsive 4-column grid (2-col on mobile) of metric cards. Each card shows:
- Metric name label
- Current value (formatted with `toLocaleString()`)
- 1-day change with ▲ (green) / ▼ (red) directional arrow
- Unit label

Empty state: if `key_metrics` is `{}`, renders a single muted card: "Market data unavailable for this entry."

### Layout

`KeyMetrics` inserted between the hero row and `AssetGrid` in `app/page.tsx`.

---

## Feature 3: Macro Explainer

### What changes

Two additions to the Claude response:

1. `justification` — Claude writes 2-3 sentences explaining why the environment score landed where it did
2. `raw_signals` (already stored, already in `MacroEntry`) gets surfaced visually

### Data model migration

```sql
alter table macro_entries add column justification text not null default '';
```

Old rows will have `justification = ''`. `MacroExplainer` renders nothing for the justification section when the string is empty.

### TypeScript types

```typescript
// Added to MacroEntry (and MacroEntryInput by inheritance):
justification: string
```

### Signal score display

Raw signals use a -2 to +2 scale. `MacroExplainer` renders each as a 5-segment bar (one segment per integer step), with the active segments filled based on score. Segment fill uses the same `scoreBgColor` map from `AssetGrid.tsx` (extracted to a shared `lib/scoreColors.ts` utility to avoid duplication).

Score labels:
| Score | Label |
|---|---|
| -2 | Strongly Negative |
| -1 | Negative |
| 0 | Neutral |
| +1 | Positive |
| +2 | Strongly Positive |

Signal display names:
| Key | Display name |
|---|---|
| `real_yields` | Real Yields |
| `fed_expectations` | Fed Expectations |
| `inflation_oil` | Inflation / Oil |
| `dollar_dxy` | Dollar (DXY) |
| `credit_stress` | Credit Stress |

### New component: `components/MacroExplainer.tsx`

Renders below the hero row (MacroStatusCard + ActionPanel):
- Header: "Why Mixed?" (or "Why Favorable?" etc. — dynamic based on `market_environment`)
- 5 signal rows: name + 5-segment score bar + label
- Justification text below the bars (hidden when empty)

### Layout

`MacroExplainer` inserted below the hero grid and above `KeyMetrics` in `app/page.tsx`.

---

## Architecture Summary

### Files changed

| File | Change |
|---|---|
| `lib/types.ts` | Add `HeadlineItem`, `KeyMetric`, `KeyMetrics` interfaces; update `MacroEntry` with new fields |
| `lib/scoreColors.ts` | Extract `scoreBgColor` and `scoreColor` maps from `AssetGrid.tsx` into shared utility |
| `lib/claude.ts` | Add web_search tool, update prompt, fix response parser to find text block among tool-use blocks |
| `supabase/schema.sql` | Add `key_metrics` and `justification` columns |
| `components/DriversHeadlines.tsx` | Union type guard for legacy/new headlines, render links, add timestamp |
| `components/KeyMetrics.tsx` | New component |
| `components/MacroExplainer.tsx` | New component |
| `components/AssetGrid.tsx` | Import `scoreBgColor` from `lib/scoreColors.ts` instead of local definition |
| `app/page.tsx` | Insert `MacroExplainer` and `KeyMetrics` into layout |

### Data flow

```
Cron → POST /api/generate
  → Claude (with web_search tool, up to 5 searches)
      → searches for macro news → grounded headlines with URLs
      → searches for market prices → key metrics values
      → generates justification text + all existing fields
  → lib/claude.ts extracts final text block from tool-use response
  → Store in Supabase (updated schema)
  → UI renders all panels
```

### MacroEntryInput inheritance

`MacroEntryInput = Omit<MacroEntry, 'id' | 'created_at'>` — new fields (`key_metrics`, `justification`, updated `headlines`) are automatically included in `MacroEntryInput` since they live on `MacroEntry`. No explicit change to `MacroEntryInput` needed beyond the `MacroEntry` update.

---

## Out of Scope

- Real-time price updates (intraday)
- Historical metric charting
- Push alerts when metrics cross thresholds
