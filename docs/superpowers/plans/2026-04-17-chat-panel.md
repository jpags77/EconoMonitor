# Chat Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a streaming chat interface to the EconoMonitor dashboard that answers macro/finance questions using Kimi-k2.5 (Moonshot AI) with live Tavily web search and today's macro entry as context.

**Architecture:** A `POST /api/chat` route receives the conversation history + today's MacroEntry, runs a Tavily news search on the user's question, builds a system prompt embedding the macro data and search results, then streams Kimi-k2.5's response back as plain text. A `ChatPanel` client component owns conversation state and renders tokens as they arrive. Topic guardrails live in the system prompt; an on-screen disclaimer is pre-loaded as the first assistant message.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind CSS, Moonshot AI API (`api.moonshot.cn/v1`, OpenAI-compatible, model `kimi-k2.5`), Tavily search API (already wired), Jest + ts-jest for unit tests.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `jest.config.ts` | Create | Jest + ts-jest configuration with `@/` alias |
| `lib/kimi.ts` | Create | `parseSSELine`, `createSSETransform`, `streamKimiResponse` |
| `lib/chatPrompt.ts` | Create | `buildSystemPrompt(entry, articles)` — pure function |
| `app/api/chat/route.ts` | Create | POST handler: Tavily search → system prompt → Kimi stream |
| `components/ChatPanel.tsx` | Create | Client component: message state, streaming render, input form |
| `__tests__/kimi.test.ts` | Create | Unit tests for `parseSSELine` |
| `__tests__/chatPrompt.test.ts` | Create | Unit tests for `buildSystemPrompt` |
| `vercel.json` | Modify | Add `maxDuration: 30` for `/api/chat` |
| `.env.local` | Modify | Add `KIMI_API_KEY` |
| `app/page.tsx` | Modify | Insert `<ChatPanel entry={latest} />` before the last grid row |

---

## Task 1: Jest config + env var

**Files:**
- Create: `jest.config.ts`
- Modify: `.env.local`

- [ ] **Step 1: Create `jest.config.ts`**

```typescript
// jest.config.ts
import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        moduleResolution: 'node',
      },
    }],
  },
}

export default config
```

- [ ] **Step 2: Add `KIMI_API_KEY` to `.env.local`**

Open `.env.local` and add:
```
KIMI_API_KEY=sk-HByTjfchwKnzyCGERQlMozLnhxDEdjzCekiqU6Kp0VwbrrcR
```

- [ ] **Step 3: Verify Jest runs (no tests yet)**

```bash
npm test -- --passWithNoTests
```
Expected: `Test Suites: 0 skipped` with exit code 0.

- [ ] **Step 4: Commit**

```bash
git add jest.config.ts .env.local
git commit -m "chore: add jest config and KIMI_API_KEY env var"
```

---

## Task 2: `lib/kimi.ts` — SSE parsing + Kimi streaming client

**Files:**
- Create: `lib/kimi.ts`
- Create: `__tests__/kimi.test.ts`

- [ ] **Step 1: Write failing tests first**

Create `__tests__/kimi.test.ts`:

```typescript
import { parseSSELine } from '@/lib/kimi'

describe('parseSSELine', () => {
  it('extracts content from a valid SSE chunk', () => {
    const line = 'data: {"id":"x","choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}'
    expect(parseSSELine(line)).toBe('Hello')
  })

  it('returns null for [DONE] sentinel', () => {
    expect(parseSSELine('data: [DONE]')).toBeNull()
  })

  it('returns null for lines without data: prefix', () => {
    expect(parseSSELine('event: message')).toBeNull()
    expect(parseSSELine('')).toBeNull()
  })

  it('returns null for chunks with no content (role announcement)', () => {
    const line = 'data: {"id":"x","choices":[{"delta":{"role":"assistant"},"finish_reason":null}]}'
    expect(parseSSELine(line)).toBeNull()
  })

  it('returns null for malformed JSON', () => {
    expect(parseSSELine('data: {invalid json}')).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
npm test -- __tests__/kimi.test.ts
```
Expected: FAIL with `Cannot find module '@/lib/kimi'`.

- [ ] **Step 3: Implement `lib/kimi.ts`**

```typescript
// lib/kimi.ts

// Parses a single SSE line and returns the text delta, or null if there's nothing to emit.
// Exported for unit testing.
export function parseSSELine(line: string): string | null {
  const trimmed = line.trim()
  if (!trimmed.startsWith('data: ')) return null
  const data = trimmed.slice(6)
  if (data === '[DONE]') return null
  try {
    const parsed = JSON.parse(data)
    return (parsed.choices?.[0]?.delta?.content as string) ?? null
  } catch {
    return null
  }
}

// Transforms a raw Moonshot SSE stream (Uint8Array) into a plain-text stream of content tokens.
export function createSSETransform(): TransformStream<Uint8Array, Uint8Array> {
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  let buffer = ''

  return new TransformStream({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const content = parseSSELine(line)
        if (content) controller.enqueue(encoder.encode(content))
      }
    },
    flush(controller) {
      if (buffer) {
        const content = parseSSELine(buffer)
        if (content) controller.enqueue(encoder.encode(content))
      }
    },
  })
}

// Calls the Moonshot API with streaming enabled and returns the raw Response.
// The caller is responsible for checking response.ok before piping.
export async function streamKimiResponse(
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[]
): Promise<Response> {
  return fetch('https://api.moonshot.cn/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.KIMI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'kimi-k2.5',
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      stream: true,
      max_tokens: 1024,
    }),
  })
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
npm test -- __tests__/kimi.test.ts
```
Expected: PASS — 5 tests in `parseSSELine`.

- [ ] **Step 5: Commit**

```bash
git add lib/kimi.ts __tests__/kimi.test.ts
git commit -m "feat: add Kimi SSE client with parseSSELine and createSSETransform"
```

---

## Task 3: `lib/chatPrompt.ts` — system prompt builder

**Files:**
- Create: `lib/chatPrompt.ts`
- Create: `__tests__/chatPrompt.test.ts`

- [ ] **Step 1: Write failing tests first**

Create `__tests__/chatPrompt.test.ts`:

```typescript
import { buildSystemPrompt } from '@/lib/chatPrompt'
import { MacroEntry, TavilyArticle } from '@/lib/types'

const mockEntry: MacroEntry = {
  id: 'test-id',
  created_at: '2026-04-17T00:00:00Z',
  date: '2026-04-17',
  market_environment: 'unfavorable',
  macro_score: 30,
  trend_direction: 'worsening',
  action_bias: 'de-risk',
  equities_score: -1,
  bitcoin_score: -1,
  gold_score: 2,
  bonds_score: 0,
  confidence: 'medium',
  justification: 'Test justification',
  drivers: [],
  headlines: [],
  raw_signals: {
    real_yields: -1,
    fed_expectations: -1,
    inflation_oil: -2,
    dollar_dxy: 1,
    credit_stress: -1,
  },
  key_metrics: {} as never,
  asset_notes: {} as never,
  macro_summary: 'Test summary',
  action_notes: 'Test action notes',
}

describe('buildSystemPrompt', () => {
  it('includes key macro data fields', () => {
    const prompt = buildSystemPrompt(mockEntry, [])
    expect(prompt).toContain('2026-04-17')
    expect(prompt).toContain('unfavorable')
    expect(prompt).toContain('30/100')
    expect(prompt).toContain('de-risk')
    expect(prompt).toContain('Test summary')
  })

  it('includes search result titles and sources when provided', () => {
    const articles: TavilyArticle[] = [
      {
        title: 'Fed holds rates',
        url: 'https://reuters.com/1',
        published_date: '2026-04-17',
        source: 'reuters.com',
      },
    ]
    const prompt = buildSystemPrompt(mockEntry, articles)
    expect(prompt).toContain('Fed holds rates')
    expect(prompt).toContain('reuters.com')
  })

  it('includes fallback text when no articles provided', () => {
    const prompt = buildSystemPrompt(mockEntry, [])
    expect(prompt).toContain('No web search results available.')
  })

  it('includes topic guardrail instruction', () => {
    const prompt = buildSystemPrompt(mockEntry, [])
    expect(prompt).toContain('TOPIC GUARDRAIL')
    expect(prompt).toContain('macro economics and finance')
  })

  it('includes financial advice disclaimer', () => {
    const prompt = buildSystemPrompt(mockEntry, [])
    expect(prompt).toContain('not a financial advisor')
  })
})
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
npm test -- __tests__/chatPrompt.test.ts
```
Expected: FAIL with `Cannot find module '@/lib/chatPrompt'`.

- [ ] **Step 3: Implement `lib/chatPrompt.ts`**

```typescript
// lib/chatPrompt.ts
import { MacroEntry, TavilyArticle } from '@/lib/types'

export function buildSystemPrompt(entry: MacroEntry, articles: TavilyArticle[]): string {
  const searchContext =
    articles.length > 0
      ? articles
          .map(a => `- "${a.title}" (${a.source}, ${a.published_date}): ${a.url}`)
          .join('\n')
      : 'No web search results available.'

  return `You are EconoMonitor's macro economics assistant. You help users understand current macro conditions, financial markets, and economic news.

TOPIC GUARDRAIL: You only discuss macro economics, financial markets, central bank policy, inflation, interest rates, currencies, commodities, equities, crypto as an asset class, and related topics. If the user asks about anything outside this scope, respond with exactly: "I'm focused on macro economics and finance — I'm not able to help with that topic. Feel free to ask about today's market conditions or any macro/finance question."

IMPORTANT: You are not a financial advisor. Never provide personalized investment advice. Keep responses concise and analytical.

TODAY'S MACRO DATA (${entry.date}):
- Market environment: ${entry.market_environment}
- Macro score: ${entry.macro_score}/100
- Action bias: ${entry.action_bias}
- Trend: ${entry.trend_direction}
- Confidence: ${entry.confidence}
- Equities score: ${entry.equities_score} (range: -2 to +2)
- Bitcoin score: ${entry.bitcoin_score} (range: -2 to +2)
- Gold score: ${entry.gold_score} (range: -2 to +2)
- Bonds score: ${entry.bonds_score} (range: -2 to +2)
- Summary: ${entry.macro_summary}
- Action notes: ${entry.action_notes}
- Key metrics: ${JSON.stringify(entry.key_metrics)}

CURRENT WEB SEARCH RESULTS FOR USER'S QUESTION:
${searchContext}

Cite sources when relevant. Be concise and direct.`
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
npm test -- __tests__/chatPrompt.test.ts
```
Expected: PASS — 5 tests in `buildSystemPrompt`.

- [ ] **Step 5: Commit**

```bash
git add lib/chatPrompt.ts __tests__/chatPrompt.test.ts
git commit -m "feat: add buildSystemPrompt with guardrails and macro context"
```

---

## Task 4: `app/api/chat/route.ts` — streaming POST handler

**Files:**
- Create: `app/api/chat/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Create `app/api/chat/route.ts`**

```typescript
// app/api/chat/route.ts
import { NextResponse } from 'next/server'
import { streamKimiResponse, createSSETransform } from '@/lib/kimi'
import { buildSystemPrompt } from '@/lib/chatPrompt'
import { MacroEntry, TavilyArticle } from '@/lib/types'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

async function searchForContext(query: string): Promise<TavilyArticle[]> {
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        search_depth: 'basic',
        max_results: 3,
        topic: 'news',
      }),
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.results ?? []).map((r: Record<string, string>) => ({
      title: r.title ?? '',
      url: r.url ?? '',
      published_date: r.published_date ?? '',
      source: (() => {
        try { return new URL(r.url).hostname.replace('www.', '') } catch { return r.url }
      })(),
    }))
  } catch {
    return []
  }
}

export async function POST(request: Request) {
  const { messages, entry }: { messages: Message[]; entry: MacroEntry } =
    await request.json()

  const latestUserMessage = [...messages].reverse().find(m => m.role === 'user')
  const query = latestUserMessage?.content ?? 'macroeconomic news today'

  const articles = await searchForContext(query)
  const systemPrompt = buildSystemPrompt(entry, articles)
  const kimiResponse = await streamKimiResponse(systemPrompt, messages)

  if (!kimiResponse.ok || !kimiResponse.body) {
    console.error('Kimi API error:', kimiResponse.status)
    return NextResponse.json({ error: 'Chat unavailable' }, { status: 500 })
  }

  const transformed = kimiResponse.body.pipeThrough(createSSETransform())

  return new Response(transformed, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
```

- [ ] **Step 2: Add `maxDuration` for `/api/chat` to `vercel.json`**

Current `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/generate",
      "schedule": "0 14 * * *"
    }
  ],
  "functions": {
    "app/api/generate/route.ts": {
      "maxDuration": 60
    }
  }
}
```

Update to:
```json
{
  "crons": [
    {
      "path": "/api/generate",
      "schedule": "0 14 * * *"
    }
  ],
  "functions": {
    "app/api/generate/route.ts": {
      "maxDuration": 60
    },
    "app/api/chat/route.ts": {
      "maxDuration": 30
    }
  }
}
```

- [ ] **Step 3: Verify build passes**

```bash
npm run build
```
Expected: `✓ Compiled successfully` with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/chat/route.ts vercel.json
git commit -m "feat: add /api/chat streaming route with Tavily + Kimi"
```

---

## Task 5: `components/ChatPanel.tsx` — client component

**Files:**
- Create: `components/ChatPanel.tsx`

- [ ] **Step 1: Create `components/ChatPanel.tsx`**

```typescript
// components/ChatPanel.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { MacroEntry } from '@/lib/types'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const DISCLAIMER: Message = {
  role: 'assistant',
  content:
    "I'm EconoMonitor's macro assistant. I can answer questions about today's macro conditions, asset signals, and current financial news. Not financial advice — always do your own research.",
}

export default function ChatPanel({ entry }: { entry: MacroEntry }) {
  const [messages, setMessages] = useState<Message[]>([DISCLAIMER])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || streaming) return

    const userMessage: Message = { role: 'user', content: text }
    const nextMessages = [...messages, userMessage]
    setMessages([...nextMessages, { role: 'assistant', content: '' }])
    setInput('')
    setStreaming(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages, entry }),
      })

      if (!res.ok || !res.body) throw new Error('Request failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            role: 'assistant',
            content: updated[updated.length - 1].content + chunk,
          }
          return updated
        })
      }
    } catch {
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          role: 'assistant',
          content: 'Something went wrong — please try again.',
        }
        return updated
      })
    } finally {
      setStreaming(false)
    }
  }

  return (
    <div className="rounded-2xl bg-gray-900 border border-gray-700 p-6">
      <h2 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-4">
        EconoMonitor Chat
      </h2>

      {/* Messages */}
      <div className="overflow-y-auto max-h-96 flex flex-col gap-3 mb-4 pr-1">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-4 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-gray-700 text-white'
                  : 'bg-gray-800 text-gray-200'
              }`}
            >
              {msg.content ||
                (streaming && i === messages.length - 1 ? (
                  <span className="flex gap-1 items-center h-4">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
                    <span
                      className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: '0.15s' }}
                    />
                    <span
                      className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: '0.3s' }}
                    />
                  </span>
                ) : null)}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={streaming}
          placeholder="Ask about today's macro conditions..."
          className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gray-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={streaming || !input.trim()}
          className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm px-4 py-2 rounded-xl transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```
Expected: `✓ Compiled successfully`.

- [ ] **Step 3: Commit**

```bash
git add components/ChatPanel.tsx
git commit -m "feat: add ChatPanel streaming client component"
```

---

## Task 6: Wire into `app/page.tsx` + add Vercel env var + end-to-end test

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Add `KIMI_API_KEY` to Vercel project env vars**

Run this command (it reads the key from your local `.env.local`):

```bash
KIMI_KEY=$(grep KIMI_API_KEY .env.local | cut -d= -f2)
curl -s -X POST "https://api.vercel.com/v10/projects/prj_7FURp5RLQ3pisWobLdnh6L1003bA/env" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"key\":\"KIMI_API_KEY\",\"value\":\"${KIMI_KEY}\",\"type\":\"encrypted\",\"target\":[\"production\",\"preview\",\"development\"]}"
```

Replace `$VERCEL_TOKEN` with your Vercel API token (set it as an env var, do not hardcode).

Verify:
```bash
curl -s "https://api.vercel.com/v9/projects/prj_7FURp5RLQ3pisWobLdnh6L1003bA/env" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  | grep -o '"KIMI_API_KEY"'
```
Expected: `"KIMI_API_KEY"`.

- [ ] **Step 2: Update `app/page.tsx`**

Add the import at the top:
```typescript
import ChatPanel from '@/components/ChatPanel'
```

Insert `<ChatPanel entry={latest} />` between `<AssetGrid>` and the final grid:

```typescript
      <AssetGrid entry={latest} />

      <ChatPanel entry={latest} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TrendChart entries={entries} />
        <DriversHeadlines entry={latest} />
      </div>
```

Full updated `app/page.tsx`:
```typescript
import MacroStatusCard from '@/components/MacroStatusCard'
import ActionPanel from '@/components/ActionPanel'
import AssetGrid from '@/components/AssetGrid'
import TrendChart from '@/components/TrendChart'
import DriversHeadlines from '@/components/DriversHeadlines'
import MacroExplainer from '@/components/MacroExplainer'
import KeyMetrics from '@/components/KeyMetrics'
import ChatPanel from '@/components/ChatPanel'
import { supabase } from '@/lib/db'
import { MacroEntry } from '@/lib/types'

export const dynamic = 'force-dynamic'

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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">EconoMonitor</h1>
        <p className="text-gray-500 text-sm">
          Scores 5 macro signals daily — real yields, Fed expectations, inflation/oil, USD strength, and credit stress — synthesized by Claude AI from live market data and news into an environment label, action bias, and per-asset guidance. Not financial advice.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MacroStatusCard entry={latest} />
        <ActionPanel entry={latest} />
      </div>

      <MacroExplainer entry={latest} />

      <KeyMetrics entry={latest} />

      <AssetGrid entry={latest} />

      <ChatPanel entry={latest} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TrendChart entries={entries} />
        <DriversHeadlines entry={latest} />
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Run full test suite and build**

```bash
npm test && npm run build
```
Expected: all tests pass, build succeeds with no TypeScript errors.

- [ ] **Step 4: Smoke test locally**

```bash
npm run dev
```

Open `http://localhost:3000` in a browser. Scroll to the "EconoMonitor Chat" panel. Verify:
1. Disclaimer message is pre-loaded: *"I'm EconoMonitor's macro assistant..."*
2. Type "Why is gold scored bullish today?" and hit Send.
3. Typing indicator (three bouncing dots) appears immediately.
4. Response text streams in token-by-token.
5. Type "What's a good pizza recipe?" — response should be the guardrail refusal: *"I'm focused on macro economics and finance..."*
6. Input is disabled while response streams.

- [ ] **Step 5: Commit and push**

```bash
git add app/page.tsx
git commit -m "feat: add ChatPanel to dashboard between AssetGrid and chart row"
git push
```

- [ ] **Step 6: Verify production deployment**

After Vercel deploys, open `https://econo-monitor.vercel.app` and repeat the smoke tests from Step 4.
