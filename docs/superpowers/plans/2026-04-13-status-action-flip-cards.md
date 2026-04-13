# Status & Action Flip Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add flip card interaction to MacroStatusCard and ActionPanel, revealing plain-English explanations on the back face when clicked.

**Architecture:** Two new `text` columns (`macro_summary`, `action_notes`) are added to `macro_entries`. The Claude prompt is extended to generate both. `MacroStatusCard` and `ActionPanel` gain `useState` flip state and CSS grid flip structure matching the existing `AssetGrid` pattern. `ActionPanel`'s prop signature widens from `{ actionBias }` to `{ entry }`.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS, Anthropic SDK, Supabase

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `lib/types.ts` | Modify | Add `macro_summary` and `action_notes` to `MacroEntry` |
| `supabase/schema.sql` | Modify | Add migration for both columns |
| `lib/claude.ts` | Modify | Add both fields to prompt schema and return value |
| `components/MacroStatusCard.tsx` | Modify | Add flip interaction with `macro_summary` on back |
| `components/ActionPanel.tsx` | Modify | Widen prop to `entry: MacroEntry`, add flip with `action_notes` on back |
| `app/page.tsx` | Modify | Update `ActionPanel` call site to pass `entry={latest}` |

---

## Task 1: Update TypeScript types

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Add `macro_summary` and `action_notes` to `MacroEntry`**

In `lib/types.ts`, add both fields after `asset_notes`:

```typescript
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
  macro_summary: string
  action_notes: string
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/jeff/Documents/git/EconoMonitor && npx tsc --noEmit 2>&1 | head -20
```

Expected: errors only in `lib/claude.ts` about missing `macro_summary`/`action_notes` in the return value. No errors in `lib/types.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add macro_summary and action_notes fields to MacroEntry"
```

---

## Task 2: Add Supabase migration

**Files:**
- Modify: `supabase/schema.sql`

- [ ] **Step 1: Append migration to `supabase/schema.sql`**

Append to the end of `supabase/schema.sql`:

```sql
-- Flip card notes migration (2026-04-13)
alter table macro_entries add column if not exists macro_summary text not null default '';
alter table macro_entries add column if not exists action_notes text not null default '';
```

- [ ] **Step 2: Run migration in Supabase dashboard**

Go to Supabase dashboard → SQL Editor, run:

```sql
alter table macro_entries add column if not exists macro_summary text not null default '';
alter table macro_entries add column if not exists action_notes text not null default '';
```

Verify: `select column_name from information_schema.columns where table_name = 'macro_entries' and column_name in ('macro_summary', 'action_notes');` should return two rows.

- [ ] **Step 3: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: add macro_summary and action_notes columns to macro_entries"
```

---

## Task 3: Update Claude prompt

**Files:**
- Modify: `lib/claude.ts`

- [ ] **Step 1: Add both fields to `USER_PROMPT` JSON schema**

In `lib/claude.ts`, find the `asset_notes` block at the end of the JSON schema in `USER_PROMPT` and add the two new fields after it:

```typescript
  "asset_notes": {
    "equities": "<2-3 plain-English sentences explaining why equities received their score today>",
    "bitcoin":  "<2-3 plain-English sentences explaining why bitcoin received its score today>",
    "gold":     "<2-3 plain-English sentences explaining why gold received its score today>",
    "bonds":    "<2-3 plain-English sentences explaining why bonds received their score today>"
  },
  "macro_summary": "<2-3 sentences explaining why the macro environment is labeled favorable/mixed/unfavorable today>",
  "action_notes": "<2-3 sentences explaining why this action bias was chosen and what an investor should do with it>"
}
```

- [ ] **Step 2: Add both fields to the `generateMacroEntry` return value**

In `lib/claude.ts`, find the return statement and add after `asset_notes`:

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
    macro_summary: parsed.macro_summary ?? '',
    action_notes: parsed.action_notes ?? '',
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
  --max-time 90 | jq '{success, macro_summary: .entry.macro_summary, action_notes: .entry.action_notes}'
```

Expected:
```json
{
  "success": true,
  "macro_summary": "<non-empty string>",
  "action_notes": "<non-empty string>"
}
```

- [ ] **Step 5: Commit**

```bash
git add lib/claude.ts
git commit -m "feat: add macro_summary and action_notes to Claude prompt and generation output"
```

---

## Task 4: Update `MacroStatusCard.tsx` with flip interaction

**Files:**
- Modify: `components/MacroStatusCard.tsx`

- [ ] **Step 1: Replace `components/MacroStatusCard.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { MacroEntry } from '@/lib/types'

const environmentColors: Record<string, string> = {
  favorable: 'bg-green-500',
  mixed: 'bg-yellow-500',
  unfavorable: 'bg-red-500',
}

const trendIcons: Record<string, string> = {
  improving: '▲',
  stabilizing: '▶',
  worsening: '▼',
}

const trendColors: Record<string, string> = {
  improving: 'text-green-400',
  stabilizing: 'text-yellow-400',
  worsening: 'text-red-400',
}

interface Props {
  entry: MacroEntry
}

export default function MacroStatusCard({ entry }: Props) {
  const [flipped, setFlipped] = useState(false)
  const color = environmentColors[entry.market_environment] ?? 'bg-gray-500'
  const trendIcon = trendIcons[entry.trend_direction]
  const trendColor = trendColors[entry.trend_direction]

  return (
    <div
      style={{ perspective: '800px', cursor: 'pointer' }}
      onClick={() => setFlipped(f => !f)}
    >
      <div
        style={{
          display: 'grid',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          transition: 'transform 0.4s ease',
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Front face */}
        <div
          className="rounded-2xl bg-gray-900 border border-gray-700 p-6"
          style={{ backfaceVisibility: 'hidden', gridArea: '1/1' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-gray-400 text-sm font-medium uppercase tracking-wider">
              Macro Environment
            </h2>
            <span className="text-gray-500 text-xs">{entry.date}</span>
          </div>

          <div className="flex items-center gap-4">
            <div className={`w-4 h-4 rounded-full ${color}`} />
            <span className="text-white text-2xl font-bold capitalize">
              {entry.market_environment}
            </span>
            <span className={`text-xl font-bold ${trendColor}`}>
              {trendIcon} {entry.trend_direction}
            </span>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-gray-500 text-xs">Macro Score</span>
              <span className="text-white text-xs font-mono">{entry.macro_score}/100</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${color}`}
                style={{ width: `${entry.macro_score}%` }}
              />
            </div>
          </div>

          <div className="mt-3 text-right">
            <span className="text-gray-500 text-xs">
              Confidence: <span className="text-gray-300 capitalize">{entry.confidence}</span>
            </span>
          </div>
        </div>

        {/* Back face */}
        <div
          className="rounded-2xl bg-gray-900 border border-gray-700 p-6 flex flex-col gap-3"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', gridArea: '1/1' }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-gray-400 text-sm font-medium uppercase tracking-wider">
              Macro Environment
            </h2>
            <span className="text-gray-500 text-xs capitalize">{entry.market_environment}</span>
          </div>
          {entry.macro_summary ? (
            <p className="text-gray-400 text-sm leading-relaxed flex-1">{entry.macro_summary}</p>
          ) : (
            <p className="text-gray-600 text-sm leading-relaxed flex-1">No summary available for this entry.</p>
          )}
          <span className="text-gray-600 text-xs">tap to flip back</span>
        </div>
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

- [ ] **Step 3: Verify dev server renders**

```bash
curl -s http://localhost:3000 | grep -o 'next-error-message="[^"]*"' | head -3
```

Expected: no output (no errors).

- [ ] **Step 4: Commit**

```bash
git add components/MacroStatusCard.tsx
git commit -m "feat: add flip card interaction to MacroStatusCard with macro_summary on back"
```

---

## Task 5: Update `ActionPanel.tsx` and `app/page.tsx`

**Files:**
- Modify: `components/ActionPanel.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace `components/ActionPanel.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { MacroEntry, ActionBias } from '@/lib/types'

const actionConfig: Record<ActionBias, { label: string; color: string; bg: string; description: string }> = {
  deploy: {
    label: 'DEPLOY CAPITAL',
    color: 'text-green-400',
    bg: 'border-green-500/40 bg-green-950/30',
    description: 'Macro conditions support putting cash to work.',
  },
  hold: {
    label: 'HOLD POSITIONS',
    color: 'text-yellow-400',
    bg: 'border-yellow-500/40 bg-yellow-950/30',
    description: 'Mixed signals — stay put, watch for clarity.',
  },
  bonds: {
    label: 'SHIFT TO BONDS',
    color: 'text-blue-400',
    bg: 'border-blue-500/40 bg-blue-950/30',
    description: 'Rate pressure easing — bonds offer value.',
  },
  'de-risk': {
    label: 'DE-RISK NOW',
    color: 'text-red-400',
    bg: 'border-red-500/40 bg-red-950/30',
    description: 'Conditions deteriorating — reduce exposure.',
  },
}

interface Props {
  entry: MacroEntry
}

export default function ActionPanel({ entry }: Props) {
  const [flipped, setFlipped] = useState(false)
  const config = actionConfig[entry.action_bias]

  return (
    <div
      style={{ perspective: '800px', cursor: 'pointer' }}
      onClick={() => setFlipped(f => !f)}
    >
      <div
        style={{
          display: 'grid',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          transition: 'transform 0.4s ease',
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Front face */}
        <div
          className={`rounded-2xl border p-6 ${config.bg}`}
          style={{ backfaceVisibility: 'hidden', gridArea: '1/1' }}
        >
          <h2 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-4">
            Action Bias
          </h2>
          <div className={`text-3xl font-black ${config.color} mb-2`}>
            {config.label}
          </div>
          <p className="text-gray-400 text-sm">{config.description}</p>
        </div>

        {/* Back face */}
        <div
          className={`rounded-2xl border p-6 flex flex-col gap-3 ${config.bg}`}
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', gridArea: '1/1' }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-gray-400 text-sm font-medium uppercase tracking-wider">
              Action Bias
            </h2>
            <span className={`text-xs font-semibold ${config.color}`}>{config.label}</span>
          </div>
          {entry.action_notes ? (
            <p className="text-gray-400 text-sm leading-relaxed flex-1">{entry.action_notes}</p>
          ) : (
            <p className="text-gray-600 text-sm leading-relaxed flex-1">No notes available for this entry.</p>
          )}
          <span className="text-gray-600 text-xs">tap to flip back</span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update `ActionPanel` call site in `app/page.tsx`**

Find the line:

```tsx
<ActionPanel actionBias={latest.action_bias} />
```

Replace with:

```tsx
<ActionPanel entry={latest} />
```

- [ ] **Step 3: Verify TypeScript compiles cleanly**

```bash
cd /Users/jeff/Documents/git/EconoMonitor && npx tsc --noEmit 2>&1 | head -20
```

Expected: zero errors.

- [ ] **Step 4: Verify dev server renders**

```bash
curl -s http://localhost:3000 | grep -o 'next-error-message="[^"]*"' | head -3
```

Expected: no output (no errors).

- [ ] **Step 5: Commit**

```bash
git add components/ActionPanel.tsx app/page.tsx
git commit -m "feat: add flip card interaction to ActionPanel with action_notes on back"
```

---

## Task 6: Push and verify production

- [ ] **Step 1: Push to production**

```bash
git push origin main
```

- [ ] **Step 2: Wait for deployment**

```bash
VERCEL_TOKEN=$(grep VERCEL_TOKEN .env.local | cut -d= -f2)
for i in $(seq 1 16); do
  STATE=$(curl -s "https://api.vercel.com/v6/deployments?projectId=prj_7FURp5RLQ3pisWobLdnh6L1003bA&teamId=team_KUvomcq7xRpSXNKvkPGbKMdU&limit=1" \
    -H "Authorization: Bearer $VERCEL_TOKEN" | jq -r '.deployments[0].state')
  echo "$STATE"
  if [ "$STATE" = "READY" ] || [ "$STATE" = "ERROR" ]; then break; fi
  sleep 15
done
```

Expected: `READY`

- [ ] **Step 3: End-to-end production test**

```bash
curl -s -X GET https://econo-monitor.vercel.app/api/generate \
  -H "Authorization: Bearer $(grep CRON_SECRET .env.local | cut -d= -f2)" \
  --max-time 90 | jq '{success, macro_summary: .entry.macro_summary, action_notes: .entry.action_notes}'
```

Expected:
```json
{
  "success": true,
  "macro_summary": "<non-empty string>",
  "action_notes": "<non-empty string>"
}
```

- [ ] **Step 4: Visit production site**

Open `https://econo-monitor.vercel.app` — click the Macro Environment card and Action Bias card to confirm both flip and show their back-face text.
