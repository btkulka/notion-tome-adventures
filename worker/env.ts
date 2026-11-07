/** Bindings and secrets the Worker runs with (see wrangler.toml and .dev.vars). */
export interface Env {
  DB: D1Database;
  TABLE: DurableObjectNamespace;
  ASSETS: Fetcher;
  /** Bound once R2 is enabled on the account (see wrangler.toml). */
  FILES?: R2Bucket;

  /** Origin players reach the app on; used for the Discord redirect. Falls back to the request origin. */
  PUBLIC_ORIGIN?: string;
  DISCORD_CLIENT_ID?: string;
  DISCORD_CLIENT_SECRET?: string;
  /** "1" turns on the local sign-in that skips Discord (worker/auth.ts). .dev.vars only. */
  DEV_LOGIN?: string;

  VERBOSE_LOGGING?: string;
}
