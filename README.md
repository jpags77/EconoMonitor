# EconoMonitor

A daily AI-powered macro signals dashboard that synthesizes global economic conditions into simple, actionable guidance for capital allocation. EconoMonitor reads live market data and financial news each morning, scores six key macro signals with Claude, and outputs a single market environment label, an action bias, and per-asset guidance for equities, Bitcoin, gold, and bonds.

## What It Does

Every day at 12:30 UTC, EconoMonitor:

1. **Fetches live context** — pulls today's macro and financial news headlines via Tavily search and queries live spot prices (WTI oil, gold, S&P 500, DJIA, NASDAQ, VIX, 10Y Treasury yield) via Claude's web search tool
2. **Scores six macro signals** with Claude Sonnet on a –2 to +2 scale:
   - Real yields (10Y Treasury direction)
   - Fed expectations (hawkish vs. dovish policy stance)
   - Inflation (CPI/PCE trend)
   - Oil (crude price as a cost/supply shock)
   - Dollar strength (DXY)
   - Credit stress (recession/credit risk indicators)
3. **Produces a composite macro score** (0–100) and derives a market environment label (favorable / mixed / unfavorable), an action bias (deploy / hold / bonds / de-risk), and asset-specific scores and plain-English rationale for equities, Bitcoin, gold, and bonds
4. **Writes a market commentary note** that reconciles how major U.S. indices moved against EconoMonitor's macro score trajectory
5. **Stores everything in Supabase** and surfaces it instantly on the next page load

Users can also ask follow-up questions via a built-in AI chat panel, which uses streaming responses grounded in the same Tavily news context.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router, async Server Components) |
| Language | TypeScript |
| Database | Supabase (PostgreSQL) |
| AI — macro generation | Anthropic Claude Sonnet (with `web_search` tool) |
| AI — market commentary | Anthropic Claude Sonnet |
| AI — chat | OpenAI-compatible streaming chat API |
| News grounding | Tavily Search API |
| Hosting | Vercel |
| Scheduler | GitHub Actions (daily cron) |

## Architecture

```
GitHub Actions (12:30 UTC daily)
    └── GET /api/generate (Bearer auth)
            ├── Idempotency check — skip if today's entry already exists
            ├── Tavily → macro news articles (grounding context)
            ├── Claude Sonnet + web_search → MacroEntry JSON
            │       └── 2-attempt retry on transient failures
            ├── computeTrend() — 3-day rolling score average
            ├── Claude Sonnet → market commentary note
            │       └── 2-attempt retry on transient failures
            └── Supabase INSERT → macro_entries table

User visits dashboard
    └── Next.js Server Component → Supabase SELECT (latest + 30 days history)
            └── Renders: score gauges, signal grid, trend chart,
                        asset panels, key metrics, headlines, drivers

User sends chat message
    └── POST /api/chat → Tavily search + streaming LLM response (SSE)
```

**Key design decisions:**
- **Server-side rendering only** — no client-side polling; every page load fetches the latest Supabase state, so data is always current without hydration complexity
- **Idempotent generation** — the generate endpoint checks for today's entry before running, making it safe to re-trigger manually or from a secondary scheduler without creating duplicates
- **GitHub Actions over Vercel Cron** — GitHub Actions provides email-on-failure notifications, a visible run history, and native retry on non-200 responses; Vercel Cron is best-effort with no observability
- **Retry logic on LLM calls** — both Claude calls are wrapped in a 2-attempt retry with a 3-second delay to handle transient API blips without failing the whole daily run

## Local Development

### Prerequisites

- Node.js 18+
- A Supabase project with a `macro_entries` table
- API keys for Anthropic (Claude), Tavily, and your chat LLM provider

### Environment Variables

Create a `.env.local` file:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Anthropic (Claude)
ANTHROPIC_API_KEY=

# Tavily Search
TAVILY_API_KEY=

# Chat LLM (OpenAI-compatible endpoint)
OPENAI_API_KEY=
OPENAI_BASE_URL=

# Cron authentication
CRON_SECRET=
```

### Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To trigger generation locally:

```bash
curl -X GET http://localhost:3000/api/generate \
  -H "Authorization: Bearer <your CRON_SECRET>"
```

## Deployment

### Vercel

Deploy via the Vercel dashboard or CLI. Add all environment variables from `.env.local` to your Vercel project settings.

### GitHub Actions Scheduler

The daily generation runs via `.github/workflows/daily-generate.yml`. Add two secrets to your GitHub repository (`Settings → Secrets → Actions`):

| Secret | Value |
|---|---|
| `APP_URL` | Your production URL, e.g. `https://your-app.vercel.app` |
| `CRON_SECRET` | Same value as in your Vercel environment variables |

The workflow also supports manual runs from the GitHub Actions UI (`workflow_dispatch`).
