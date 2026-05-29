# Asset Notes (Flip Cards) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 2-3 sentence plain-English explanation to each asset card that reveals on click via a 180° CSS flip animation.

**Architecture:** A new `asset_notes` JSONB column stores Claude-generated per-asset reasoning. `AssetGrid.tsx` gains flip state per card using `useState`. The existing Claude prompt is extended with an `asset_notes` object in the JSON schema. No extra API calls.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS, Anthropic SDK, Supabase

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `lib/types.ts` | Modify | Add `AssetNotes` interface; add `asset_notes` to `MacroEntry` |
| `lib/claude.ts` | Modify | Add `asset_notes` to prompt schema; return with `?? {}` default |
| `supabase/schema.sql` | Modify | Add `asset_notes` column |
| `components/AssetGrid.tsx` | Modify | Add flip interaction and back-face note rendering |

---

## Task 1: Add `AssetNotes` type and `asset_notes` field to `MacroEntry`

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Add `AssetNotes` interface and `asset_notes` field**

In `lib/types.ts`, add the `AssetNotes` interface after the `TavilyArticle` interface (after line 47), and add `asset_notes` to `MacroEntry` after the `key_metrics` field.

The complete updated `lib/types.ts`:

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

export interface TavilyArticle {
  title: string
  url: string
  published_date: string
  source: string
}

export interface AssetNotes {
  equities: string
  bitcoin: string
  gold: string
  bonds: string
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
  asset_notes: AssetNotes | Record<string, never>  // {} for old rows
}

// What Claude returns (before DB insert)
export type MacroEntryInput = Omit<MacroEntry, 'id' | 'created_at'>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/jeff/Documents/git/EconoMonitor && npx tsc --noEmit 2>&1 | head -20
```

Expected: one new error in `lib/claude.ts` about missing `asset_notes` in the return value. No errors in `lib/types.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add AssetNotes type and asset_notes field to MacroEntry"
```

---

## Task 2: Add `asset_notes` to Supabase schema

**Files:**
- Modify: `supabase/schema.sql`

- [ ] **Step 1: Append migration to `supabase/schema.sql`**

Append to the end of `supabase/schema.sql`:

```sql
-- Asset notes migration (2026-04-03)
alter table macro_entries add column if not exists asset_notes jsonb not null default '{}';
```

- [ ] **Step 2: Run migration in Supabase dashboard**

Go to Supabase dashboard → SQL Editor, run:

```sql
alter table macro_entries add column if not exists asset_notes jsonb not null default '{}';
```

Verify: `select column_name from information_schema.columns where table_name = 'macro_entries' and column_name = 'asset_notes';` should return one row.

- [ ] **Step 3: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: add asset_notes column to macro_entries"
```

---

## Task 3: Update Claude prompt to generate `asset_notes`

**Files:**
- Modify: `lib/claude.ts`

- [ ] **Step 1: Add `asset_notes` to the USER_PROMPT JSON schema**

In `lib/claude.ts`, find the closing of the JSON structure in `USER_PROMPT` — the line with the closing `}` after `key_metrics`. Add `asset_notes` before it.

Replace the section from `"key_metrics": {` to the end of the template literal with:

```typescript
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
  }
}
`
```

- [ ] **Step 2: Add `asset_notes` to the return value of `generateMacroEntry`**

In `lib/claude.ts`, find the return statement and add `asset_notes` after `key_metrics`:

```typescript
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
  }
```

- [ ] **Step 3: Verify TypeScript compiles cleanly**

```bash
cd /Users/jeff/Documents/git/EconoMonitor && npx tsc --noEmit 2>&1 | head -20
```

Expected: zero errors.

- [ ] **Step 4: Test locally**

```bash
curl -s -X GET http://localhost:3000/api/generate \
  -H "Authorization: Bearer $(grep CRON_SECRET .env.local | cut -d= -f2)" \
  --max-time 90 | jq '{success, asset_notes: .entry.asset_notes}'
```

Expected:
```json
{
  "success": true,
  "asset_notes": {
    "equities": "<non-empty string>",
    "bitcoin": "<non-empty string>",
    "gold": "<non-empty string>",
    "bonds": "<non-empty string>"
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add lib/claude.ts
git commit -m "feat: add asset_notes to Claude prompt and generation output"
```

---

## Task 4: Update `AssetGrid.tsx` with flip card interaction

**Files:**
- Modify: `components/AssetGrid.tsx`

- [ ] **Step 1: Replace `components/AssetGrid.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { MacroEntry, SignalScore, AssetNotes } from '@/lib/types'
import { scoreColor, scoreBgColor } from '@/lib/scoreColors'

const scoreLabel: Record<number, string> = {
  2: 'Strong Buy',
  1: 'Buy',
  0: 'Neutral',
  [-1]: 'Caution',
  [-2]: 'Avoid',
}

function AssetCard({ name, score, emoji, note }: {
  name: string
  score: SignalScore
  emoji: string
  note: string
}) {
  const [flipped, setFlipped] = useState(false)

  return (
    <div
      style={{ perspective: '600px', cursor: 'pointer' }}
      onClick={() => setFlipped(f => !f)}
    >
      <div
        style={{
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          transition: 'transform 0.4s ease',
          transformStyle: 'preserve-3d',
          position: 'relative',
          minHeight: '110px',
        }}
      >
        {/* Front face */}
        <div
          className="rounded-xl bg-gray-800 border border-gray-700 p-4 flex flex-col gap-2 absolute inset-0"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <div className="flex items-center gap-2">
            <span className="text-xl">{emoji}</span>
            <span className="text-gray-300 font-medium">{name}</span>
          </div>
          <div className={`text-lg font-bold ${scoreColor[score]}`}>
            {scoreLabel[score]}
          </div>
          <div className="flex gap-1">
            {[-2, -1, 0, 1, 2].map((s) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full ${
                  s <= score ? scoreBgColor[score] : 'bg-gray-700'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Back face */}
        <div
          className="rounded-xl bg-gray-800 border border-gray-700 p-4 flex flex-col gap-2 absolute inset-0"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <div className="flex items-center gap-2">
            <span className="text-xl">{emoji}</span>
            <span className="text-gray-300 font-medium">{name}</span>
            <span className={`text-xs font-semibold ml-auto ${scoreColor[score]}`}>
              {scoreLabel[score]}
            </span>
          </div>
          {note ? (
            <p className="text-gray-400 text-xs leading-relaxed flex-1">{note}</p>
          ) : (
            <p className="text-gray-600 text-xs leading-relaxed flex-1">No analysis available for this entry.</p>
          )}
          <span className="text-gray-600 text-xs">tap to flip back</span>
        </div>
      </div>
    </div>
  )
}

interface Props {
  entry: MacroEntry
}

export default function AssetGrid({ entry }: Props) {
  const notes = entry.asset_notes as AssetNotes

  return (
    <div className="rounded-2xl bg-gray-900 border border-gray-700 p-6">
      <h2 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-4">
        Asset Signals
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <AssetCard name="Equities" score={entry.equities_score} emoji="📈" note={notes.equities ?? ''} />
        <AssetCard name="Bitcoin"  score={entry.bitcoin_score}  emoji="₿"  note={notes.bitcoin  ?? ''} />
        <AssetCard name="Gold"     score={entry.gold_score}     emoji="🟡" note={notes.gold     ?? ''} />
        <AssetCard name="Bonds"    score={entry.bonds_score}    emoji="📄" note={notes.bonds    ?? ''} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
cd /Users/jeff/Documents/git/EconoMonitor && npx tsc --noEmit 2>&1 | head -20
```

Expected: zero errors.

- [ ] **Step 3: Check dev server renders**

```bash
curl -s http://localhost:3000 | grep -i 'Asset Signals' | head -3
```

Expected: HTML containing "Asset Signals".

- [ ] **Step 4: Commit**

```bash
git add components/AssetGrid.tsx
git commit -m "feat: add flip card interaction with per-asset reasoning to AssetGrid"
```

---

## Task 5: Push and verify production

- [ ] **Step 1: Push to production**

```bash
git push origin main
```

- [ ] **Step 2: Wait for deployment**

```bash
sleep 45 && curl -s "https://api.vercel.com/v6/deployments?projectId=prj_7FURp5RLQ3pisWobLdnh6L1003bA&teamId=team_KUvomcq7xRpSXNKvkPGbKMdU&limit=1" \
  -H "Authorization: Bearer $(grep VERCEL_TOKEN .env.local | cut -d= -f2)" | \
  jq -r '.deployments[0].state'
```

Expected: `READY`

- [ ] **Step 3: End-to-end production test**

```bash
curl -s -X GET https://econo-monitor.vercel.app/api/generate \
  -H "Authorization: Bearer $(grep CRON_SECRET .env.local | cut -d= -f2)" \
  --max-time 90 | jq '{success, gold_note: .entry.asset_notes.gold}'
```

Expected:
```json
{
  "success": true,
  "gold_note": "<non-empty string>"
}
```

- [ ] **Step 4: Visit production site**

Open `https://econo-monitor.vercel.app` — tap a card in the Asset Signals section and confirm it flips to show the explanation.
