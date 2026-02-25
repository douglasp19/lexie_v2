// @route apps/web/lib/db/client.ts
import { createClient } from '@supabase/supabase-js'

// Usa service_role — nunca expor no client-side
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)
