import { createClient } from '@supabase/supabase-js'

// Sustituye los textos entre comillas por tus claves reales
const supabaseUrl = 'https://dxfgbvdtbgjlaxvibemv.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4ZmdidmR0YmdqbGF4dmliZW12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MDE1NzYsImV4cCI6MjA5NDA3NzU3Nn0.km9qZpbcb4Hzi46YQ2HpcyYQgFNXcvGqQ-UcIlGJB-g'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)