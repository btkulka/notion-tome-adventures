import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Helper function to call Edge Functions
export async function callEdgeFunction(functionName: string, body?: any) {
  try {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: body ? JSON.stringify(body) : undefined,
    })

    if (error) {
      throw error
    }

    return data
  } catch (error) {
    console.error(`Error calling ${functionName}:`, error)
    throw error
  }
}