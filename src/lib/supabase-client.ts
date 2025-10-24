import { createClient } from '@supabase/supabase-js'
import { createLogger } from '@/utils/logger'

// Lazy logger - only creates when needed
let _logger: ReturnType<typeof createLogger> | null = null;
const getLogger = () => {
  if (!_logger) {
    _logger = createLogger('Supabase');
  }
  return _logger;
};

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
  try {
    getLogger().warn('Supabase env not set (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY). Edge calls will fail until configured.');
  } catch (e) {
    console.warn('[Supabase] Env not set');
  }
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
    getLogger().info(`📡 Calling edge function: ${functionName}`);
    getLogger().debug('Request details:', {
      function: functionName,
      hasBody: !!body,
      hasCancelSignal: !!signal,
      bodyPreview: body ? JSON.stringify(body).substring(0, 100) : 'none',
    });
    
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
      getLogger().error(`Edge function error for ${functionName}`, {
        message: error.message,
        details: error,
      });
      
      // Don't log verbose errors for expected failures (like missing Notion setup)
      if (error.message?.includes('NOTION_API_KEY') || error.message?.includes('DATABASE_ID')) {
        getLogger().warn(`${functionName}: Notion integration not configured`);
      } else {
        getLogger().error(`Edge function ${functionName} failed`, error.message);
      }
      throw error;
    }

    const callDuration = (performance.now() - callStartTime).toFixed(2);
    getLogger().info(`✅ Edge function ${functionName} succeeded (${callDuration}ms)`);
    getLogger().debug('Response preview:', {
      dataKeys: data ? Object.keys(data) : [],
      dataSize: JSON.stringify(data).length,
    });
    return data;

  } catch (error) {
    // Handle abort errors specially
    if (error instanceof DOMException && error.name === 'AbortError') {
      getLogger().info(`Edge function ${functionName} was cancelled`)
      throw error
    }
    
    getLogger().error(`Exception calling ${functionName}`, error)
    
    // Simplified error logging for cleaner output
    if (error instanceof Error && error.message?.includes('non-2xx status code')) {
      getLogger().warn(`${functionName}: Service returned non-2xx status code`)
      getLogger().debug('Error details', error.message)
    } else {
      getLogger().error('Exception details', error instanceof Error ? error.message : 'Unknown error')
    }
    throw error
  }
}

// HMR: Reset logger on module reload
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    console.log('🔄 Supabase client module reloaded');
    _logger = null;
  });
}
