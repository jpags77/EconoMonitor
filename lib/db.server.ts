import { createClient } from '@supabase/supabase-js'

// Server-only client using the secret key — bypasses RLS for trusted server-side writes.
// Never import this in client components or pages with 'use client'.
// Initialized lazily so the env var is read at request time, not build time.
export function getSupabaseServer() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}
