import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables. Some features may not work.')
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder-key'
)

// Helper function to call Edge Functions
export async function callEdgeFunction(functionName: string, body?: unknown, signal?: AbortSignal) {
  try {
    console.log(`🔮 Calling edge function: ${functionName}`, body ? 'with body' : 'without body')
    
    // Check if already aborted before starting
    if (signal?.aborted) {
      throw new DOMException('Operation was aborted', 'AbortError');
    }

    let data, error;

    // Use direct fetch for better AbortSignal support when signal is provided
    if (signal) {
      const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'apikey': supabaseAnonKey,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal, // Direct signal support
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorData.message || errorText;
        } catch {
          errorMessage = errorText || `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      data = await response.json();
    } else {
      // Use Supabase client for non-cancellable requests
      const result = await supabase.functions.invoke(functionName, {
        body: body ? JSON.stringify(body) : undefined,
      });
      
      data = result.data;
      error = result.error;
    }

    // Check for errors from Supabase client
    if (error) {
      console.error(`❌ Edge function error for ${functionName}:`, {
        message: error.message,
        details: error,
      });
      
      // Don't log verbose errors for expected failures (like missing Notion setup)
      if (error.message?.includes('NOTION_API_KEY') || error.message?.includes('DATABASE_ID')) {
        console.log(`⚠️ ${functionName}: Notion integration not configured`);
      } else {
        console.error(`💥 Edge function ${functionName} failed:`, error.message);
      }
      throw error;
    }

    console.log(`✅ Edge function ${functionName} succeeded:`, data);
    return data;

    if (error) {
      console.error(`❌ Edge function error for ${functionName}:`, {
        message: error.message,
        details: error,
      })
      
      // Don't log verbose errors for expected failures (like missing Notion setup)
      if (error.message?.includes('NOTION_API_KEY') || error.message?.includes('DATABASE_ID')) {
        console.log(`⚠️ ${functionName}: Notion integration not configured`)
      } else {
        console.error(`💥 Edge function ${functionName} failed:`, error.message)
      }
      throw error
    }

    console.log(`✅ Edge function ${functionName} succeeded:`, data)
    return data
  } catch (error) {
    // Handle abort errors specially
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.log(`🚫 Edge function ${functionName} was cancelled`)
      throw error
    }
    
    console.error(`🔥 Exception calling ${functionName}:`, error)
    
    // Simplified error logging for cleaner console
    if (error instanceof Error && error.message?.includes('non-2xx status code')) {
      console.log(`⚠️ ${functionName}: Service returned non-2xx status code`)
      console.log(`🔍 Error details:`, error.message)
    } else {
      console.error(`� Exception details:`, error instanceof Error ? error.message : 'Unknown error')
    }
    throw error
  }
}