import { createContext, useContext } from 'react';
import { keepAcrossHmr } from '@/lib/hmr';

/** The signed-in Discord user, as the Worker reports it (worker/types.ts). */
export interface Profile {
  id: string;
  discordId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  isDm: boolean;
}

export interface AuthState {
  /** True until the session check has come back. */
  loading: boolean;
  profile: Profile | null;
  isDm: boolean;
  signInWithDiscord: (returnTo?: string) => void;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

// Lives apart from <AuthProvider> so editing the provider hot-swaps it in place.
export const AuthContext = keepAcrossHmr(import.meta.hot, 'AuthContext', () => createContext<AuthState | null>(null));

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
