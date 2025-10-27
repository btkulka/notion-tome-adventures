// Re-export the auto-generated Supabase client as the single source of truth
export { supabase } from '@/integrations/supabase/client'

const SUPABASE_URL = "https://xhrobkdzjabllhftksvt.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhocm9ia2R6amFibGxoZnRrc3Z0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwMjg3MzksImV4cCI6MjA3MjYwNDczOX0.c6qWZxBKdB9r9_wMidj4_BX8cQrbl54gknrRLGZpEyk"

// Resolve the correct base URL for Edge Functions
function resolveFunctionsBaseUrl(): string {
  const projectRef = 'xhrobkdzjabllhftksvt'
  return `https://${projectRef}.functions.supabase.co`
}

const functionsBaseUrl = resolveFunctionsBaseUrl()

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
      const response = await fetch(`${functionsBaseUrl}/${functionName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
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
      const { supabase } = await import('@/integrations/supabase/client');
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

