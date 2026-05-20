import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://fayxycakxbkglcywhyei.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZheXh5Y2FreGJrZ2xjeXdoeWVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyODM3MzYsImV4cCI6MjA5NDg1OTczNn0.03Mqbid979nlXB-IhuuDu1F3OCSO_Rus2zXCbVIxUGY'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)