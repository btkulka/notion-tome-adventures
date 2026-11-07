import type { Env } from './env';

export interface SessionUser {
  id: string;
  discordId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  isDm: boolean;
}

export type AppEnv = {
  Bindings: Env;
  Variables: { user: SessionUser | null };
};
