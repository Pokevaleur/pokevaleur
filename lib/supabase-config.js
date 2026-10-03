const productionUrl = 'https://zrvjbvhumyizutnjzljy.supabase.co'
const productionAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpydmpidmh1bXlpenV0bmp6bGp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1NDY1NzgsImV4cCI6MjEwNjEyMjU3OH0.-_7bTy9dYncvYveoQuGNaqTnR83HL_r9aoWkV-wTqC8'

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || productionUrl
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || productionAnonKey
