import { NextResponse } from 'next/server'
import { generateMacroEntry } from '@/lib/claude'
import { supabase } from '@/lib/db'
import { getSupabaseServer } from '@/lib/db.server'
import { TrendDirection, TavilyArticle } from '@/lib/types'

// PRD Section 7: compare today's score vs. 3-day average
function computeTrend(newScore: number, recentScores: number[]): TrendDirection {
  if (recentScores.length === 0) return 'stabilizing'
  const avg = recentScores.reduce((a, b) => a + b, 0) / recentScores.length
  if (newScore > avg + 5) return 'improving'
  if (newScore < avg - 5) return 'worsening'
  return 'stabilizing'
}

async function tavilySearch(query: string, maxResults: number): Promise<TavilyArticle[]> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      search_depth: 'basic',
      max_results: maxResults,
      topic: 'news',
    }),
  })
  if (!res.ok) {
    console.error(`Tavily search failed for "${query}": ${res.status}`)
    return []
  }
  const data = await res.json()
  return (data.results ?? []).map((r: Record<string, string>) => {
    let source = r.url
    try { source = new URL(r.url).hostname.replace('www.', '') } catch { /* keep raw url */ }
    return {
      title: r.title ?? '',
      url: r.url,
      published_date: r.published_date ?? new Date().toISOString().split('T')[0],
      source,
    }
  })
}

async function fetchMacroArticles(): Promise<TavilyArticle[]> {
  return tavilySearch('macroeconomic news today fed rates inflation', 4)
}

async function fetchPriceArticles(): Promise<TavilyArticle[]> {
  return tavilySearch('WTI crude oil gold price S&P 500 NASDAQ VIX 10-year treasury yield today', 3)
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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

    // Step 1: Tavily — fetch grounding articles and spot price data in parallel
    const [articles, priceArticles] = await Promise.all([
      fetchMacroArticles(),
      fetchPriceArticles(),
    ])
    if (articles.length === 0) {
      console.warn('Tavily returned no macro articles — proceeding with empty context')
    }

    // Step 2: Kimi (NVIDIA NIM) — generate entry with grounding articles + price context
    const entry = await generateMacroEntry(articles, priceArticles)

    // Override Claude's trend_direction with computed value from historical data
    entry.trend_direction = computeTrend(entry.macro_score, recentScores)

    const { data, error } = await getSupabaseServer()
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
