import { createClient } from '@supabase/supabase-js'
import { env } from '@/core/constants/env'

/** Shared Supabase client singleton. */
export const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
