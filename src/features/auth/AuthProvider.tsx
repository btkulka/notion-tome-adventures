import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export interface Profile {
  id: string;
  discord_id: string | null;
  discord_username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

interface AuthState {
  /** True until the stored session (and the DM check) have been resolved. */
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isDm: boolean;
  signInWithDiscord: (returnTo?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isDm, setIsDm] = useState(false);
  const [identityLoaded, setIdentityLoaded] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionLoaded(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setSessionLoaded(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!sessionLoaded) return;
    if (!userId) {
      setProfile(null);
      setIsDm(false);
      setIdentityLoaded(true);
      return;
    }
    let cancelled = false;
    setIdentityLoaded(false);
    Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.rpc('is_dm'),
    ]).then(([profileResult, dmResult]) => {
      if (cancelled) return;
      if (profileResult.error) console.error('Failed to load profile:', profileResult.error);
      if (dmResult.error) console.error('Failed to check DM access:', dmResult.error);
      setProfile((profileResult.data as Profile) ?? null);
      setIsDm(dmResult.data === true);
      setIdentityLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [sessionLoaded, userId]);

  const signInWithDiscord = useCallback(async (returnTo?: string) => {
    const target = new URL(returnTo ?? window.location.pathname, window.location.origin);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo: target.toString(), scopes: 'identify' },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      loading: !sessionLoaded || !identityLoaded,
      session,
      user: session?.user ?? null,
      profile,
      isDm,
      signInWithDiscord,
      signOut,
    }),
    [sessionLoaded, identityLoaded, session, profile, isDm, signInWithDiscord, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
