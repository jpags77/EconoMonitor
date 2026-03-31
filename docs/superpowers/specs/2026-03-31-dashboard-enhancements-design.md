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

---

## Feature 1: Grounded Headlines with Timestamps

### What changes

The Claude API call in `lib/claude.ts` is upgraded to use the **web_search tool**. Claude searches for real macro news stories, cites actual URLs, and returns headlines as structured objects instead of plain strings.

### Data model

`headlines` column type changes from `jsonb` storing `string[]` to `jsonb` storing `{ text: string; url: string }[]`.

```sql
-- No column type change needed (still jsonb) — shape change only
-- Existing rows with string[] headlines remain valid (UI handles both)
```

### Claude prompt change

The prompt instructs Claude to use web search to find real articles and return:
```json
"headlines": [
  { "text": "headline text", "url": "https://..." },
  ...
]
```

### TypeScript type change

```typescript
// Before
headlines: string[]

// After
headlines: { text: string; url: string }[]
```

### UI change

`DriversHeadlines.tsx` renders each headline as an `<a>` tag opening in a new tab. A "Last updated: [date]" line appears at the top of the section using `entry.created_at`.

---

## Feature 2: Key Metrics Panel

### What changes

The Claude prompt instructs Claude to use web search to find current daily values for 7 market metrics. These are stored in a new `key_metrics` jsonb column on `macro_entries`.

### Metrics tracked

| Metric | Description |
|---|---|
| `oil_wti` | WTI crude oil price (USD/barrel) |
| `gold` | Gold spot price (USD/oz) |
| `djia` | Dow Jones Industrial Average |
| `nasdaq` | Nasdaq Composite |
| `sp500` | S&P 500 |
| `vix` | CBOE Volatility Index |
| `treasury_10y` | 10-Year Treasury yield (%) |

Each metric stored as `{ value: number; change: number; unit: string }` where `change` is the 1-day change.

### Data model

```sql
alter table macro_entries add column key_metrics jsonb not null default '{}';
```

### New component

`components/KeyMetrics.tsx` — renders a responsive grid of metric cards, each showing:
- Metric name
- Current value
- 1-day change with directional arrow (▲ green / ▼ red)

### Layout change

`KeyMetrics` inserted between the top hero row and `AssetGrid` in `app/page.tsx`.

---

## Feature 3: Macro Explainer

### What changes

Two additions to the Claude response and data model:

1. `raw_signals` (already stored) gets surfaced in the UI
2. A new `justification` text field — Claude writes 2-3 sentences explaining the environment score

### Data model

```sql
alter table macro_entries add column justification text not null default '';
```

### Claude prompt change

Claude is instructed to add a `justification` field:
```json
"justification": "Mixed reflects offsetting forces: dollar weakness is supportive but tariff-driven inflation risk and hawkish Fed repricing are headwinds."
```

### New component

`components/MacroExplainer.tsx` — renders below `MacroStatusCard`:
- 5 signal scores as a mini visual breakdown (name + score bar + label)
- `justification` text underneath

### Layout change

`MacroExplainer` inserted below the hero row (MacroStatusCard + ActionPanel) in `app/page.tsx`.

---

## Architecture Summary

### Files changed

| File | Change |
|---|---|
| `lib/types.ts` | Update `headlines` type, add `KeyMetric` interface, add `justification` field |
| `lib/claude.ts` | Enable web_search tool, update prompt for grounded headlines, key metrics, justification |
| `app/api/generate/route.ts` | No logic change needed |
| `supabase/schema.sql` | Add `key_metrics` and `justification` columns |
| `components/DriversHeadlines.tsx` | Render headlines as links, add timestamp |
| `components/KeyMetrics.tsx` | New component |
| `components/MacroExplainer.tsx` | New component |
| `app/page.tsx` | Insert new components into layout |

### Data flow

```
Cron → POST /api/generate
  → Claude (with web_search tool)
      → searches for macro news → grounded headlines with URLs
      → searches for market prices → key metrics values
      → generates justification text
  → Store in Supabase (updated schema)
  → UI renders all panels
```

### Backward compatibility

Existing `macro_entries` rows have `headlines` as `string[]`. The `DriversHeadlines` component will handle both shapes gracefully during the transition.

---

## Out of Scope

- Real-time price updates (intraday)
- Historical metric charting
- Push alerts when metrics cross thresholds
