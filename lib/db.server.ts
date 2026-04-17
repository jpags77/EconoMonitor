import { createClient } from '@supabase/supabase-js'

// Server-only client using the secret key — bypasses RLS for trusted server-side writes.
// Never import this in client components or pages with 'use client'.
export const supabaseServer = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)
