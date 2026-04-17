# EconoMonitor Chat Panel Design

## Goal

Add a streaming chat interface to the dashboard that lets users ask questions about today's macro conditions and current financial news, powered by Kimi-2.5 (Moonshot AI) with Tavily web search for live context.

## Architecture

### New files

| File | Responsibility |
|------|---------------|
| `app/api/chat/route.ts` | POST endpoint: receives messages + macro entry, runs Tavily search, streams Kimi-2.5 response |
| `components/ChatPanel.tsx` | Client component: conversation state, streaming rendering, input |
| `lib/kimi.ts` | Thin wrapper: constructs Moonshot streaming request, returns raw `Response` |

### Modified files

| File | Change |
|------|--------|
| `app/page.tsx` | Add `<ChatPanel entry={latest} />` between `<AssetGrid>` and the final `TrendChart`/`DriversHeadlines` row |
| `.env.local` | Add `KIMI_API_KEY` |
| Vercel env vars | Add `KIMI_API_KEY` |

---

## API Route — `app/api/chat/route.ts`

**Method:** POST

**Request body:**
```ts
{
  messages: { role: 'user' | 'assistant', content: string }[]
  entry: MacroEntry
}
```

**Behavior:**
1. Extract the latest user message from `messages`.
2. Run a Tavily search (`search_depth: 'basic'`, `max_results: 3`, `topic: 'news'`) on the user's message text.
3. Build a system prompt (see below).
4. Call Kimi-2.5 via `lib/kimi.ts` with the full message history and system prompt, streaming enabled.
5. Pipe the Moonshot stream directly back to the client as a `text/plain` streaming `Response`.

**System prompt:**
```
You are EconoMonitor's macro economics assistant. You help users understand current macro conditions, financial markets, and economic news.

TOPIC GUARDRAIL: You only discuss macro economics, financial markets, central bank policy, inflation, interest rates, currencies, commodities, equities, crypto as an asset class, and related topics. If the user asks about anything outside this scope, respond with: "I'm focused on macro economics and finance — I'm not able to help with that topic. Feel free to ask about today's market conditions or any macro/finance question."

IMPORTANT: You are not a financial advisor. Never provide personalized investment advice. Always include a brief reminder that your analysis is not financial advice when relevant.

Today's macro data:
- Date: {entry.date}
- Market environment: {entry.market_environment}
- Macro score: {entry.macro_score}/100
- Action bias: {entry.action_bias}
- Trend: {entry.trend_direction}
- Confidence: {entry.confidence}
- Equities score: {entry.equities_score} (scale: -2 to +2)
- Bitcoin score: {entry.bitcoin_score}
- Gold score: {entry.gold_score}
- Bonds score: {entry.bonds_score}
- Summary: {entry.macro_summary}
- Action notes: {entry.action_notes}
- Key metrics: {JSON.stringify(entry.key_metrics)}

Current web search results for user's question:
{tavily results — title, source, url, snippet for each}

Be concise, analytical, and direct. Cite sources from the search results when relevant.
```

**Error handling:**
- If Tavily fails, proceed without web context (log warning, don't block).
- If Kimi API returns a non-2xx status, return `{ error: 'Chat unavailable' }` with status 500.

---

## Kimi Client — `lib/kimi.ts`

Uses the Moonshot AI API (`https://api.moonshot.cn/v1/chat/completions`), which is OpenAI-compatible.

```ts
export async function streamKimiResponse(
  systemPrompt: string,
  messages: { role: string; content: string }[]
): Promise<Response>
```

- Model: `kimi-2.5` (confirm exact model name from Moonshot docs before implementing)
- `stream: true`
- `max_tokens: 1024`
- Returns the raw `fetch` `Response` so the API route can pipe it directly

---

## Client Component — `components/ChatPanel.tsx`

**Props:** `{ entry: MacroEntry }`

**State:**
```ts
const [messages, setMessages] = useState<Message[]>([disclaimer])
const [input, setInput] = useState('')
const [streaming, setStreaming] = useState(false)
```

**Initial message (pre-loaded, role: `'assistant'`):**
> "I'm EconoMonitor's macro assistant. I can answer questions about today's macro conditions, asset signals, and current financial news. Not financial advice — always do your own research."

**Submit flow:**
1. Append user message to `messages`.
2. Set `streaming = true`, clear input.
3. POST `/api/chat` with `{ messages, entry }`.
4. Read response body as a stream (`reader = response.body.getReader()`).
5. Decode chunks, append to a growing assistant message string, update state on each chunk so text renders progressively.
6. On stream end, set `streaming = false`.
7. On fetch error, append an assistant message: "Something went wrong. Please try again." and set `streaming = false`.

**Layout:**
```
┌─────────────────────────────────────────┐
│ EconoMonitor Chat              [label]  │
├─────────────────────────────────────────┤
│                                         │
│  [assistant bubble] disclaimer text     │
│                   [user bubble] msg     │
│  [assistant bubble] response...         │
│                        ···  (typing)    │
│                                         │  ← ~380px scrollable
├─────────────────────────────────────────┤
│ [Ask about today's macro conditions...] │
│                              [Send →]   │
└─────────────────────────────────────────┘
```

- Card style: `rounded-2xl bg-gray-900 border border-gray-700 p-6` — matches existing dashboard cards
- Messages area: `overflow-y-auto` with `max-h-96`, auto-scrolls to bottom on new message
- User bubbles: right-aligned, `bg-gray-700 text-white`
- Assistant bubbles: left-aligned, `bg-gray-800 text-gray-200`
- Typing indicator: three animated dots (`animate-bounce`) shown when `streaming && lastMessage.role !== 'assistant'`
- Input: disabled while `streaming === true`
- Send button: disabled while `streaming === true` or `input.trim() === ''`

---

## Page Layout Change — `app/page.tsx`

Insert `<ChatPanel entry={latest} />` between `<AssetGrid>` and the final grid row:

```tsx
<AssetGrid entry={latest} />

<ChatPanel entry={latest} />   {/* ← new */}

<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
  <TrendChart entries={entries} />
  <DriversHeadlines entry={latest} />
</div>
```

---

## Environment Variables

| Variable | Where |
|----------|-------|
| `KIMI_API_KEY` | `.env.local` + Vercel project env vars |

---

## Guardrails Summary

| Concern | Mitigation |
|---------|-----------|
| Off-topic questions | System prompt instructs Kimi to refuse with a one-sentence redirect |
| Financial advice | System prompt forbids personalized investment advice; disclaimer in first message |
| API key exposure | `KIMI_API_KEY` is server-side only (no `NEXT_PUBLIC_` prefix); never sent to client |
| Prompt injection via user input | User input goes only into the `messages` array (user role), never interpolated into the system prompt |
