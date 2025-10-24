import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined
const supabaseProjectId = import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined

// Resolve the correct base URL for Edge Functions
function resolveFunctionsBaseUrl(): string | null {
  const url = supabaseUrl?.trim()
  if (!url) return null
  try {
    const u = new URL(url)
    // Hosted Supabase projects live at <ref>.supabase.co and functions at <ref>.functions.supabase.co
    if (u.hostname.endsWith('.supabase.co')) {
      const projectRef = u.hostname.split('.')[0]
      return `${u.protocol}//${projectRef}.functions.supabase.co`
    }
    // Local dev (e.g., http://127.0.0.1:54321) proxies functions under /functions/v1
    return `${url.replace(/\/$/, '')}/functions/v1`
  } catch {
    return null
  }
}

const functionsBaseUrl = resolveFunctionsBaseUrl()

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] Env not set');
}

export const supabase = createClient(
  // Only instantiate with a real URL/key; otherwise use obvious placeholders to avoid DNS lookups
  supabaseUrl || 'http://invalid.local',
  supabaseAnonKey || 'invalid-key'
)

// Helper function to call Edge Functions
export async function callEdgeFunction(functionName: string, body?: unknown, signal?: AbortSignal) {
  const callStartTime = performance.now();
  
  try {
    
    // Check if already aborted before starting
    if (signal?.aborted) {
      throw new DOMException('Operation was aborted', 'AbortError');
    }

    let data, error;

    // Use direct fetch for better AbortSignal support when signal is provided
    if (signal) {
      // Fail fast with a clear message if env is missing
      if (!functionsBaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.')
      }

      const response = await fetch(`${functionsBaseUrl}/${functionName}`, {
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
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.')
      }
      const result = await supabase.functions.invoke(functionName, {
        body: body ? JSON.stringify(body) : undefined,
      });
      
      data = result.data;
      error = result.error;
    }

    // Check for errors from Supabase client
    if (error) {
      throw error;
    }

    return data;

  } catch (error) {
    throw error
  }
}

