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
