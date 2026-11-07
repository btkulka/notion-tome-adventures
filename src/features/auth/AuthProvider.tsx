import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { AuthContext, type AuthState, type Profile } from './useAuth';

const fetchMe = () => api<{ user: Profile }>('/api/me');

// Asked for as soon as the bundle runs rather than after the first render, so the
// session check overlaps the route chunks loading. The first refresh() takes it.
let firstCheck: ReturnType<typeof fetchMe> | null = fetchMe();
firstCheck.catch(() => undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const check = firstCheck ?? fetchMe();
    firstCheck = null;
    try {
      const { user } = await check;
      setProfile(user);
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 401)) console.error('Failed to load session:', err);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signInWithDiscord = useCallback((returnTo?: string) => {
    const next = returnTo ?? `${window.location.pathname}${window.location.search}`;
    window.location.assign(`/auth/discord?next=${encodeURIComponent(next)}`);
  }, []);

  const signOut = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' });
    setProfile(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ loading, profile, isDm: profile?.isDm ?? false, signInWithDiscord, signOut, refresh }),
    [loading, profile, signInWithDiscord, signOut, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
