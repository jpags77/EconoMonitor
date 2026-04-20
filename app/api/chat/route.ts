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
