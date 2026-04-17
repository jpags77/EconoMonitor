import { NextResponse } from 'next/server'
import { generateMacroEntry } from '@/lib/claude'
import { supabase } from '@/lib/db'
import { TrendDirection, TavilyArticle } from '@/lib/types'

// PRD Section 7: compare today's score vs. 3-day average
function computeTrend(newScore: number, recentScores: number[]): TrendDirection {
  if (recentScores.length === 0) return 'stabilizing'
  const avg = recentScores.reduce((a, b) => a + b, 0) / recentScores.length
  if (newScore > avg + 5) return 'improving'
  if (newScore < avg - 5) return 'worsening'
  return 'stabilizing'
}

async function fetchMacroArticles(): Promise<TavilyArticle[]> {
  const queries = ['macroeconomic news today fed rates inflation']
  const results: TavilyArticle[] = []
  const seen = new Set<string>()

  for (const query of queries) {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        search_depth: 'basic',
        max_results: 4,
        include_domains: [],
        topic: 'news',
      }),
    })
    if (!res.ok) {
      console.error(`Tavily search failed for "${query}": ${res.status}`)
      continue
    }
    const data = await res.json()
    for (const r of data.results ?? []) {
      if (!r.url || seen.has(r.url)) continue
      seen.add(r.url)
      let source = r.url
      try { source = new URL(r.url).hostname.replace('www.', '') } catch { /* keep raw url */ }
      results.push({
        title: r.title ?? '',
        url: r.url,
        published_date: r.published_date ?? new Date().toISOString().split('T')[0],
        source,
      })
    }
  }

  return results
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

    // Step 1: Tavily — fetch grounding articles for headlines + drivers
    const articles = await fetchMacroArticles()
    if (articles.length === 0) {
      console.warn('Tavily returned no articles — proceeding with empty context')
    }

    // Step 2: Claude — generate entry (uses web_search for prices, articles for grounding)
    const entry = await generateMacroEntry(articles)

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
    const msg = err instanceof Error ? err.message : JSON.stringify(err)
    console.error('Generate error:', err)
    return NextResponse.json({ error: 'Generation failed', detail: msg }, { status: 500 })
  }
}
