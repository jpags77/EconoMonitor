import { NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const parsed = parseInt(searchParams.get('limit') ?? '30')
  const limit = isNaN(parsed) || parsed < 1 ? 30 : Math.min(parsed, 100)

  const { data, error } = await supabase
    .from('macro_entries')
    .select('*')
    .order('date', { ascending: false })
    .limit(limit)

  if (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json(data)
}
