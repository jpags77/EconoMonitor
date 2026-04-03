# Design Spec: Grounded Key Drivers with Article Links

**Date:** 2026-04-03  
**Status:** Approved

## Overview

Enhance the Key Drivers section so each driver displays a date stamp, source name, and link to the original news article. URLs are grounded via Tavily web search at generation time — Claude is given real articles as context and cites them directly in structured output.

---

## Data Model

### TypeScript (`lib/types.ts`)

Add a `Driver` union type. The `MacroEntry.drivers` field changes from `string[]` to `Driver[]`:

```ts
export type Driver =
  | string
  | { text: string; url: string; date: string; source: string }
```

Old entries (plain strings) and new entries (objects) coexist — no backfill required. A type guard in the component handles both shapes.

### Database (`supabase/schema.sql`)

No migration needed. The `drivers` column is already `jsonb` and can store either format.

---

## Generation Flow

### Step 1 — Tavily Search (`app/api/generate/route.ts`)

Before calling Claude, the cron handler calls Tavily with two queries:

- `"macroeconomic news today"`
- `"fed interest rates inflation tariffs"`

Fetch the top 5–8 articles. Extract per article:
- `title` — article headline
- `url` — canonical URL
- `published_date` — ISO date string
- `source` — domain or publication name

### Step 2 — Claude Generation (`lib/claude.ts`)

Inject the Tavily results into the Claude prompt as a numbered article list:

```
Here are today's relevant news articles:
1. [Title] — [Source], [Date] — [URL]
2. ...

Write 2–3 key drivers. Each driver must cite one article from the list above using this JSON shape:
{ "text": "...", "url": "...", "date": "...", "source": "..." }
```

For each driver, Claude selects the most relevant article from the provided list and copies its `url`, `published_date`, and source name verbatim into the output object. Claude does not invent or paraphrase these fields.

### Step 3 — Store

The generated `Driver[]` array is stored as-is in the `drivers` JSONB column. No changes to the insert logic.

---

## Component (`components/DriversHeadlines.tsx`)

Add a type guard and conditional rendering per driver:

```tsx
{entry.drivers.map((driver, i) => {
  const isObject = typeof driver === 'object'
  return (
    <li key={i}>
      <span>▶</span>
      {isObject ? (
        <div>
          <a href={driver.url} target="_blank" rel="noopener noreferrer">
            {driver.text}
          </a>
          <span>{driver.date} · {driver.source}</span>
        </div>
      ) : (
        <span>{driver}</span>
      )}
    </li>
  )
})}
```

Plain string entries render exactly as today. New entries render the text as a link with the date and source below.

---

## Error Handling

- If Tavily search fails or returns no results, fall back to generating drivers as plain strings (existing behavior). The cron job must not fail silently — log the Tavily error but continue.
- If Claude returns a mix of object and string drivers (partial failure), store as-is — the type guard handles it.

---

## Files Changed

| File | Change |
|------|--------|
| `lib/types.ts` | Add `Driver` union type; update `MacroEntry.drivers` |
| `lib/claude.ts` | Add Tavily search call; update prompt and output schema |
| `app/api/generate/route.ts` | Orchestrate Tavily before Claude call |
| `components/DriversHeadlines.tsx` | Add type guard + link/date/source rendering |
| `.env.example` | Add `TAVILY_API_KEY=` placeholder (already done) |

---

## Out of Scope

- Backfilling old entries
- Grounding the `headlines` array (separate spec already exists)
- Per-driver dates that differ from the article's published date
