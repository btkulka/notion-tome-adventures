// Caller identity for edge functions. Every function checks the Supabase user
// JWT the app sends; the anon key alone is never enough to read Notion data.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.57.0'

export const authCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export interface Caller {
  userId: string
  /** Client acting as the caller, so RLS and auth.uid() apply. */
  client: SupabaseClient
}

export type CampaignRole = 'dm' | 'player'

function deny(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...authCorsHeaders, 'Content-Type': 'application/json' },
  })
}

export async function requireUser(req: Request): Promise<Caller | Response> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return deny(401, 'Sign in with Discord to use this')

  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !anonKey) return deny(500, 'Supabase environment missing')

  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await client.auth.getUser(token)
  if (error || !data.user) return deny(401, 'Sign in with Discord to use this')
  return { userId: data.user.id, client }
}

/** The caller must be an allowlisted DM. */
export async function requireDm(req: Request): Promise<Caller | Response> {
  const caller = await requireUser(req)
  if (caller instanceof Response) return caller
  const { data, error } = await caller.client.rpc('is_dm')
  if (error) return deny(500, `Could not check DM access: ${error.message}`)
  if (!data) return deny(403, 'Only the DM can use this')
  return caller
}

export async function campaignRole(caller: Caller, campaignId: string): Promise<CampaignRole | null> {
  const { data, error } = await caller.client
    .from('campaign_members')
    .select('role')
    .eq('campaign_id', campaignId)
    .eq('user_id', caller.userId)
    .maybeSingle()
  if (error) throw new Error(`Could not check campaign membership: ${error.message}`)
  return (data?.role as CampaignRole) ?? null
}

/** The caller must belong to the campaign. Returns their role. */
export async function requireMember(
  req: Request,
  campaignId: string,
): Promise<(Caller & { role: CampaignRole }) | Response> {
  const caller = await requireUser(req)
  if (caller instanceof Response) return caller
  const role = await campaignRole(caller, campaignId)
  if (!role) return deny(403, 'You are not part of this campaign')
  return { ...caller, role }
}
