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

export async function GET(request: Request) {
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
    const message = err instanceof Error ? err.message : String(err)
    console.error('Generate error:', message)
    return NextResponse.json({ error: 'Generation failed', detail: message }, { status: 500 })
  }
}
