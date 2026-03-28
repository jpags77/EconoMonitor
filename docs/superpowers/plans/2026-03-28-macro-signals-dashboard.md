# Macro Signals Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web dashboard that uses Claude AI to synthesize 5 macro signals into a single visual investment decision — "deploy, hold, or de-risk" — refreshed daily via cron.

**Architecture:** A Next.js app with API routes handles both the frontend and backend. A Vercel cron job hits the `/api/generate` route daily, which calls Claude to produce structured JSON, stores it in Supabase, and the UI fetches + renders the latest entry. No separate backend server needed.

**Tech Stack:** Next.js 14 (App Router), Supabase (Postgres), Anthropic Claude API, Vercel (hosting + cron), Tailwind CSS

**GitHub Repo:** https://github.com/jpags77/EconoMonitor

---

## Chunk 1: Project Foundation

### Task 1: Bootstrap the Next.js Project

**Files:**
- Create: `package.json` (auto-generated)
- Create: `.env.local` (secrets — never commit)
- Create: `.env.example` (committed, shows required keys)
- Modify: `.gitignore` (ensure `.env.local` is listed)

- [ ] **Step 1: Create the Next.js app**

Run in `/users/jeff/documents/git/EconoMonitor`:
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*"
```
When prompted: answer **Yes** to all defaults.

- [ ] **Step 2: Install dependencies**

```bash
npm install @supabase/supabase-js @anthropic-ai/sdk
npm install --save-dev @types/node
```

- [ ] **Step 3: Create `.env.local`**

Create file at root with this content (fill in real values later):
```
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
CRON_SECRET=any-random-string-you-choose
```

- [ ] **Step 4: Create `.env.example`**

```
ANTHROPIC_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
CRON_SECRET=
```

- [ ] **Step 5: Verify `.gitignore` contains `.env.local`**

Open `.gitignore` — confirm `.env.local` is listed. If not, add it.

- [ ] **Step 6: Start dev server to confirm it works**

```bash
npm run dev
```
Expected: App runs at http://localhost:3000 with Next.js default page.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: bootstrap Next.js project with Tailwind and dependencies"
git push
```

---

### Task 2: Supabase Database Setup

**Files:**
- Create: `lib/db.ts` — Supabase client singleton
- Create: `supabase/schema.sql` — table definition (for reference)

- [ ] **Step 1: Create a Supabase project**

1. Go to https://supabase.com and sign in
2. Click "New Project" → name it `econoMonitor`
3. Choose a region close to you, set a database password, click Create
4. Wait ~2 minutes for provisioning

- [ ] **Step 2: Create the `macro_entries` table**

In Supabase dashboard → SQL Editor → New Query. Paste and run:

```sql
create table macro_entries (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  date date not null,
  market_environment text not null,
  macro_score integer not null,
  trend_direction text not null,
  action_bias text not null,
  equities_score integer not null,
  bitcoin_score integer not null,
  gold_score integer not null,
  bonds_score integer not null,
  confidence text not null,
  drivers jsonb not null default '[]',
  headlines jsonb not null default '[]',
  raw_signals jsonb not null default '{}'
);

-- Most recent entry first
create index macro_entries_date_idx on macro_entries(date desc);
```

- [ ] **Step 3: Get your Supabase credentials**

In Supabase dashboard → Settings → API:
- Copy "Project URL" → paste into `.env.local` as `NEXT_PUBLIC_SUPABASE_URL`
- Copy "anon public" key → paste as `NEXT_PUBLIC_SUPABASE_ANON_KEY`

- [ ] **Step 4: Create `lib/db.ts`**

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

- [ ] **Step 3b: Enable Row Level Security (RLS) policies**

Still in the SQL Editor, run this second query so the app can actually read and write data:

```sql
alter table macro_entries enable row level security;

create policy "Allow public reads" on macro_entries
  for select using (true);

create policy "Allow public inserts" on macro_entries
  for insert with check (true);
```

> **Why this matters:** Supabase enables RLS by default. Without these policies, all reads and writes from the app will silently fail — the API will return `{ "success": true }` but no data will appear in the dashboard.

- [ ] **Step 5: Save schema to file for reference**

Create `supabase/schema.sql` and paste both SQL blocks from Steps 2 and 3b into it.

- [ ] **Step 6: Commit**

```bash
git add lib/db.ts supabase/schema.sql .env.example
git commit -m "feat: add Supabase client and schema"
git push
```

---

### Task 3: Define TypeScript Types

**Files:**
- Create: `lib/types.ts` — all shared types used across the app

- [ ] **Step 1: Create `lib/types.ts`**

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
  drivers: string[]            // 2–3 bullet strings
  headlines: string[]          // 3–5 headline strings
  raw_signals: RawSignals
}

// What Claude returns (before DB insert)
export type MacroEntryInput = Omit<MacroEntry, 'id' | 'created_at'>
```

- [ ] **Step 2: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add shared TypeScript types"
git push
```

---

## Chunk 2: AI Engine

### Task 4: Claude AI Integration

**Files:**
- Create: `lib/claude.ts` — prompt construction + API call
- Create: `lib/score.ts` — score normalization utility

- [ ] **Step 1: Install and configure Jest**

```bash
npm install --save-dev jest @types/jest ts-jest
```

Open `package.json` and add a `"jest"` key and update `"scripts"`. The relevant sections should look like this after editing:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "jest"
  },
  "jest": {
    "preset": "ts-jest",
    "testEnvironment": "node",
    "testPathIgnorePatterns": ["/node_modules/", "/.next/"]
  }
}
```

- [ ] **Step 2: Write a failing test for score normalization**

Create `lib/score.test.ts`:
```typescript
import { normalizeScore } from './score'

test('max score (+10) normalizes to 100', () => {
  expect(normalizeScore(10)).toBe(100)
})

test('min score (-10) normalizes to 0', () => {
  expect(normalizeScore(-10)).toBe(0)
})

test('neutral score (0) normalizes to 50', () => {
  expect(normalizeScore(0)).toBe(50)
})
```

- [ ] **Step 2b: Run test to confirm it fails**

```bash
npm test -- lib/score.test.ts --no-coverage 2>&1 | head -20
```
Expected: error — `Cannot find module './score'`.

- [ ] **Step 3: Create `lib/score.ts`**

```typescript
// 5 signals × max ±2 = range of -10 to +10
export function normalizeScore(rawSum: number): number {
  const min = -10
  const max = 10
  const clamped = Math.max(min, Math.min(max, rawSum))
  return Math.round(((clamped - min) / (max - min)) * 100)
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npm test -- lib/score.test.ts --no-coverage
```
Expected: 3 tests pass.

- [ ] **Step 5: Create `lib/claude.ts`**

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

const USER_PROMPT = (today: string) => `
Today is ${today}. Analyze current global macro conditions and return a JSON object.

Score each signal from -2 (strongly negative for risk assets) to +2 (strongly positive):
- real_yields: 10Y Treasury yield direction (rising=-2, falling=+2)
- fed_expectations: Fed policy stance (hawkish=-2, dovish=+2)
- inflation_oil: Oil/inflation trend (rising=-2, falling=+2)
- dollar_dxy: USD strength (strong=-2, weak=+2)
- credit_stress: Credit/recession risk (rising=-2, low=+2)

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
  "drivers": ["<driver 1>", "<driver 2>", "<driver 3>"],
  "headlines": ["<headline 1>", "<headline 2>", "<headline 3>", "<headline 4>", "<headline 5>"]
}
`

export async function generateMacroEntry(): Promise<MacroEntryInput> {
  const today = new Date().toISOString().split('T')[0]

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: USER_PROMPT(today) }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const parsed = JSON.parse(text)

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
    drivers: parsed.drivers,
    headlines: parsed.headlines,
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/claude.ts lib/score.ts lib/score.test.ts
git commit -m "feat: add Claude AI macro generation and score normalization"
git push
```

---

## Chunk 3: API Routes

### Task 5: Generate API Route

**Files:**
- Create: `app/api/generate/route.ts` — POST endpoint, triggers AI + stores result

- [ ] **Step 1: Create `app/api/generate/route.ts`**

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

export async function POST(request: Request) {
  // Always require CRON_SECRET — both manual triggers and Vercel cron must pass it
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

    const entry = await generateMacroEntry()

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

- [ ] **Step 2: Test the route manually**

With dev server running (`npm run dev`), run:
```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Authorization: Bearer $(grep CRON_SECRET .env.local | cut -d= -f2)"
```
Expected: JSON with `{ "success": true, "entry": { ... } }` and a new row in Supabase.

Check Supabase dashboard → Table Editor → `macro_entries` to confirm the row appears.

- [ ] **Step 3: Commit**

```bash
git add app/api/generate/route.ts
git commit -m "feat: add generate API route with cron auth"
git push
```

---

### Task 6: Entries API Route

**Files:**
- Create: `app/api/entries/route.ts` — GET endpoint, returns latest entries for the UI

- [ ] **Step 1: Create `app/api/entries/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') ?? '30')

  const { data, error } = await supabase
    .from('macro_entries')
    .select('*')
    .order('date', { ascending: false })
    .limit(limit)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
```

- [ ] **Step 2: Test the route**

```bash
curl http://localhost:3000/api/entries
```
Expected: JSON array of macro entries (at least the one created in Task 5).

- [ ] **Step 3: Commit**

```bash
git add app/api/entries/route.ts
git commit -m "feat: add entries API route"
git push
```

---

## Chunk 4: UI Components

### Task 7: Macro Status Card

**Files:**
- Create: `components/MacroStatusCard.tsx`

This is the hero card — shows the overall score, environment label, and trend.

- [ ] **Step 1: Create `components/MacroStatusCard.tsx`**

```typescript
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
  const color = environmentColors[entry.market_environment] ?? 'bg-gray-500'
  const trendIcon = trendIcons[entry.trend_direction]
  const trendColor = trendColors[entry.trend_direction]

  return (
    <div className="rounded-2xl bg-gray-900 border border-gray-700 p-6">
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
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/MacroStatusCard.tsx
git commit -m "feat: add MacroStatusCard component"
git push
```

---

### Task 8: Action Panel

**Files:**
- Create: `components/ActionPanel.tsx`

Shows the core investment decision with visual emphasis.

- [ ] **Step 1: Create `components/ActionPanel.tsx`**

```typescript
import { ActionBias } from '@/lib/types'

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
  actionBias: ActionBias
}

export default function ActionPanel({ actionBias }: Props) {
  const config = actionConfig[actionBias]

  return (
    <div className={`rounded-2xl border p-6 ${config.bg}`}>
      <h2 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-4">
        Action Bias
      </h2>
      <div className={`text-3xl font-black ${config.color} mb-2`}>
        {config.label}
      </div>
      <p className="text-gray-400 text-sm">{config.description}</p>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/ActionPanel.tsx
git commit -m "feat: add ActionPanel component"
git push
```

---

### Task 9: Asset Grid

**Files:**
- Create: `components/AssetGrid.tsx`

Shows 4 asset signal scores (Equities, Bitcoin, Gold, Bonds).

- [ ] **Step 1: Create `components/AssetGrid.tsx`**

```typescript
import { MacroEntry, SignalScore } from '@/lib/types'

const scoreLabel: Record<number, string> = {
  2: 'Strong Buy',
  1: 'Buy',
  0: 'Neutral',
  [-1]: 'Caution',
  [-2]: 'Avoid',
}

const scoreColor: Record<number, string> = {
  2: 'text-green-400',
  1: 'text-green-300',
  0: 'text-gray-400',
  [-1]: 'text-orange-400',
  [-2]: 'text-red-400',
}

function AssetCard({ name, score, emoji }: { name: string; score: SignalScore; emoji: string }) {
  return (
    <div className="rounded-xl bg-gray-800 border border-gray-700 p-4 flex flex-col gap-2">
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
              s <= score ? scoreColor[score].replace('text-', 'bg-') : 'bg-gray-700'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

interface Props {
  entry: MacroEntry
}

export default function AssetGrid({ entry }: Props) {
  return (
    <div className="rounded-2xl bg-gray-900 border border-gray-700 p-6">
      <h2 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-4">
        Asset Signals
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <AssetCard name="Equities" score={entry.equities_score} emoji="📈" />
        <AssetCard name="Bitcoin" score={entry.bitcoin_score} emoji="₿" />
        <AssetCard name="Gold" score={entry.gold_score} emoji="🟡" />
        <AssetCard name="Bonds" score={entry.bonds_score} emoji="📄" />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/AssetGrid.tsx
git commit -m "feat: add AssetGrid component"
git push
```

---

### Task 10: Trend Chart

**Files:**
- Create: `components/TrendChart.tsx`

A simple sparkline showing macro score over the last 30 days.

- [ ] **Step 1: Install recharts**

```bash
npm install recharts
```

- [ ] **Step 2: Create `components/TrendChart.tsx`**

```typescript
'use client'
import { MacroEntry } from '@/lib/types'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

interface Props {
  entries: MacroEntry[]
}

export default function TrendChart({ entries }: Props) {
  // Need at least 2 points to draw a line
  if (entries.length < 2) {
    return (
      <div className="rounded-2xl bg-gray-900 border border-gray-700 p-6">
        <h2 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-4">
          Macro Score Trend (30 days)
        </h2>
        <p className="text-gray-600 text-sm text-center py-8">
          Trend will appear after 2+ days of data
        </p>
      </div>
    )
  }

  // Oldest first for the chart
  const data = [...entries]
    .reverse()
    .map((e) => ({
      date: e.date.slice(5), // MM-DD
      score: e.macro_score,
    }))

  return (
    <div className="rounded-2xl bg-gray-900 border border-gray-700 p-6">
      <h2 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-4">
        Macro Score Trend (30 days)
      </h2>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={data}>
          <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} />
          <YAxis domain={[0, 100]} hide />
          <Tooltip
            contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#9ca3af' }}
            itemStyle={{ color: '#60a5fa' }}
          />
          <ReferenceLine y={50} stroke="#374151" strokeDasharray="4 4" />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#60a5fa"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/TrendChart.tsx
git commit -m "feat: add TrendChart sparkline component"
git push
```

---

### Task 11: Drivers & Headlines Panel

**Files:**
- Create: `components/DriversHeadlines.tsx`

- [ ] **Step 1: Create `components/DriversHeadlines.tsx`**

```typescript
import { MacroEntry } from '@/lib/types'

interface Props {
  entry: MacroEntry
}

export default function DriversHeadlines({ entry }: Props) {
  return (
    <div className="rounded-2xl bg-gray-900 border border-gray-700 p-6 space-y-6">
      <div>
        <h2 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-3">
          Key Drivers
        </h2>
        <ul className="space-y-2">
          {entry.drivers.map((driver, i) => (
            <li key={i} className="flex gap-2 text-gray-300 text-sm">
              <span className="text-blue-400 mt-0.5">▸</span>
              {driver}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-3">
          Signal Headlines
        </h2>
        <ul className="space-y-2">
          {entry.headlines.map((headline, i) => (
            <li key={i} className="text-gray-400 text-sm border-l-2 border-gray-700 pl-3">
              {headline}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/DriversHeadlines.tsx
git commit -m "feat: add DriversHeadlines component"
git push
```

---

## Chunk 5: Dashboard Page & Deployment

### Task 12: Main Dashboard Page

**Files:**
- Modify: `app/page.tsx` — replaces default Next.js page with the dashboard
- Modify: `app/layout.tsx` — set title and dark background

- [ ] **Step 1: Update `app/layout.tsx`**

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'EconoMonitor',
  description: 'Macro signals dashboard for capital allocation decisions',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-gray-950 text-white min-h-screen`}>
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Create the dashboard `app/page.tsx`**

```typescript
import MacroStatusCard from '@/components/MacroStatusCard'
import ActionPanel from '@/components/ActionPanel'
import AssetGrid from '@/components/AssetGrid'
import TrendChart from '@/components/TrendChart'
import DriversHeadlines from '@/components/DriversHeadlines'
import { supabase } from '@/lib/db'
import { MacroEntry } from '@/lib/types'

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
          POST /api/generate
        </code>
      </main>
    )
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">EconoMonitor</h1>
        <p className="text-gray-500 text-sm">
          "We are not predicting the future. We are detecting when the present is changing."
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MacroStatusCard entry={latest} />
        <ActionPanel actionBias={latest.action_bias} />
      </div>

      <AssetGrid entry={latest} />
      <TrendChart entries={entries} />
      <DriversHeadlines entry={latest} />
    </main>
  )
}
```

- [ ] **Step 3: Test locally end-to-end**

```bash
npm run dev
```
Open http://localhost:3000. If you have data from Task 5, the full dashboard should render.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx app/layout.tsx
git commit -m "feat: build main dashboard page with all components"
git push
```

---

### Task 13: Vercel Cron Job

**Files:**
- Create: `vercel.json` — cron schedule config

- [ ] **Step 1: Create `vercel.json`**

```json
{
  "crons": [
    {
      "path": "/api/generate",
      "schedule": "0 14 * * *"
    }
  ]
}
```

> This runs the generate endpoint every day at 14:00 UTC (10am ET). Adjust the schedule as needed. Cron syntax: `minute hour day month weekday`.

- [ ] **Step 2: Update `vercel.json` to pass the secret as a header to the cron**

Vercel crons don't send auth headers by default. Update `vercel.json` so the cron passes your secret:

```json
{
  "crons": [
    {
      "path": "/api/generate",
      "schedule": "0 14 * * *"
    }
  ]
}
```

> The cron will call the route. Since it won't carry an Authorization header, you have two options:
> **Option A (simplest for MVP):** In `app/api/generate/route.ts`, also allow requests that come from Vercel's internal IP range by checking `process.env.VERCEL === '1'` in addition to the Bearer check.
> **Option B (more secure):** Use a Vercel cron secret. See https://vercel.com/docs/cron-jobs/manage-cron-jobs for the official approach.
>
> For the MVP, use Option A — add this to the auth check in `route.ts`:
> ```typescript
> const isVercel = process.env.VERCEL === '1' && request.headers.get('user-agent')?.includes('vercel-cron')
> if (!isVercel && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
>   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
> }
> ```

- [ ] **Step 3: Commit**

```bash
git add vercel.json app/api/generate/route.ts
git commit -m "feat: add Vercel cron job for daily macro generation"
git push
```

---

### Task 14: Deploy to Vercel

- [ ] **Step 1: Install Vercel CLI**

```bash
npm install -g vercel
```

- [ ] **Step 2: Deploy**

```bash
vercel
```
Follow the prompts:
- Link to existing project or create new → name it `econoMonitor`
- Select the `/users/jeff/documents/git/EconoMonitor` directory
- Accept default build settings

- [ ] **Step 3: Add environment variables in Vercel dashboard**

Go to https://vercel.com → your project → Settings → Environment Variables. Add all 4 keys from `.env.local`:
- `ANTHROPIC_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `CRON_SECRET`

- [ ] **Step 4: Trigger a production generation**

```bash
curl -X POST https://your-app.vercel.app/api/generate \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```
Expected: `{ "success": true, "entry": { ... } }`

- [ ] **Step 5: Open your live dashboard**

Visit your Vercel URL — the full dashboard should render with live data.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete EconoMonitor MVP deployment"
git push
```

---

## Summary

| Task | What it builds |
|------|---------------|
| 1 | Next.js project scaffold |
| 2 | Supabase DB + client |
| 3 | TypeScript types |
| 4 | Claude AI engine + scoring |
| 5 | POST /api/generate route |
| 6 | GET /api/entries route |
| 7 | MacroStatusCard UI |
| 8 | ActionPanel UI |
| 9 | AssetGrid UI |
| 10 | TrendChart (sparkline) |
| 11 | DriversHeadlines UI |
| 12 | Main dashboard page |
| 13 | Vercel cron config |
| 14 | Production deployment |

**End state:** A live URL showing today's macro environment, action bias, asset signals, and 30-day trend — refreshed every day at 10am ET by a cron job calling Claude.

---

## Deferred (post-MVP)

- **Change Triggers** (PRD Section 8): "Explicit macro shifts" — e.g. flagging when `action_bias` changes from the previous day. Not in MVP data model; add as a computed field in a follow-up.
- **Real-time data feeds** — replacing Claude's knowledge-based scoring with live market data APIs
- **Alerts** — push/email when regime changes
- **Portfolio integration**
