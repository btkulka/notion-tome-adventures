import React, { useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import hero from '@/assets/dnd-hero-banner.jpg';
import { api } from '@/lib/api';
import { useAuth } from './useAuth';
import { FullScreenSpinner } from './guards';

/** Only same-site paths, so `?next=` can't bounce people elsewhere. */
function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

export default function LoginPage() {
  const { loading, profile, signInWithDiscord } = useAuth();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const [error, setError] = useState<string | null>(params.get('error'));
  const [redirecting, setRedirecting] = useState(false);
  const joining = next.startsWith('/join/');

  if (loading) return <FullScreenSpinner />;
  if (profile) return <Navigate to={next} replace />;

  const signIn = () => {
    setError(null);
    setRedirecting(true);
    signInWithDiscord(next);
  };

  return (
    <div className="t-root min-h-svh flex flex-wrap">
      <div
        className="flex-[1_1_520px] min-h-[320px] md:min-h-0 flex items-end p-8 md:p-[52px] bg-cover bg-center border-b md:border-b-0 md:border-r border-gilt-deep"
        style={{ backgroundImage: `linear-gradient(180deg, rgba(10,10,11,0.1) 35%, rgba(10,10,11,0.96)), url(${hero})`, filter: 'saturate(0.7)' }}
      >
        <div className="flex flex-col gap-[18px] max-w-[520px]">
          <Sigil />
          <p className="t-lore m-0 text-[20px] md:text-[24px] leading-normal">The map is only as large as the company's courage. What lies past the fog is yours to find.</p>
        </div>
      </div>

      <div className="flex-[1_1_480px] p-8 md:p-[52px] flex flex-col justify-center">
        <section aria-label={joining ? 'Join the table' : 'Sign in'} className="t-frame flex flex-col gap-5 max-w-[470px] p-8">
          <div className="flex flex-col gap-2.5">
            <span className="t-label">{joining ? 'You have been summoned to a table' : 'Tome'}</span>
            <h1 className="t-display text-[34px]">{joining ? 'Take your seat' : 'Sign in'}</h1>
          </div>
          <button type="button" className="t-btn h-[54px] gap-3.5 border-gilt" onClick={signIn} disabled={redirecting}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#5865F2" aria-hidden="true"><path d="M19.6 5.3A16.5 16.5 0 0 0 15.5 4l-.5 1a15 15 0 0 0-6 0l-.5-1a16.5 16.5 0 0 0-4.1 1.3C2 9.2 1.3 13 1.6 16.7a16.6 16.6 0 0 0 5 2.5l1.1-1.7a10.7 10.7 0 0 1-1.7-.8l.4-.3a11.8 11.8 0 0 0 11.2 0l.4.3a10.7 10.7 0 0 1-1.7.8l1.1 1.7a16.6 16.6 0 0 0 5-2.5c.4-4.3-.6-8-2.8-11.4zM8.7 14.5c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2zm6.6 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2z" /></svg>
            {redirecting ? 'Opening Discord…' : 'Continue with Discord'}
          </button>
          <p className="t-small m-0 text-[14px] leading-relaxed">Only your Discord name and portrait are used, so the DM knows who sits at the table. No account to make.</p>
          {error && <p className="m-0 text-blood-text text-[14px]">{error}</p>}
        </section>
        {import.meta.env.DEV && <DevSignIn next={next} />}
      </div>
    </div>
  );
}

interface DevUser {
  id: string;
  username: string;
  displayName: string | null;
  isDm: boolean;
}

/**
 * Dev builds only: sign in as anyone already in the local database, or as a new test
 * player, without Discord. Hidden unless the Worker has DEV_LOGIN=1 (worker/auth.ts).
 */
function DevSignIn({ next }: { next: string }) {
  const [users, setUsers] = useState<DevUser[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ users: DevUser[] }>('/auth/dev')
      .then((r) => setUsers(r.users))
      .catch(() => setUsers(null));
  }, []);

  if (!users) return null;

  const signInAs = async (userId?: string) => {
    setBusy(true);
    try {
      await api('/auth/dev', { method: 'POST', body: { userId } });
      window.location.assign(next);
    } catch (err) {
      console.error('Dev sign-in failed:', err);
      setBusy(false);
    }
  };

  return (
    <section aria-label="Dev sign-in" className="t-frame flex flex-col gap-3 max-w-[470px] p-6 mt-6 border-dashed">
      <span className="t-label">Dev sign-in · skips Discord</span>
      <div className="flex flex-wrap gap-2">
        {users.map((u) => (
          <button key={u.id} type="button" className="t-btn h-[40px] px-4" onClick={() => signInAs(u.id)} disabled={busy}>
            {u.displayName || u.username}
            {u.isDm ? ' · DM' : ''}
          </button>
        ))}
        <button type="button" className="t-btn h-[40px] px-4" onClick={() => signInAs()} disabled={busy}>
          New test player
        </button>
      </div>
    </section>
  );
}

export function Sigil({ size = 46 }: { size?: number }) {
  return (
    <span className="t-sigil" style={{ width: size, height: size }}>
      <svg width={size * 0.52} height={size * 0.52} viewBox="0 0 256 256" aria-hidden="true">
        <g fill="none" stroke="#C4A35A" strokeWidth="14" strokeLinejoin="miter"><polygon points="128,40 204,84 204,172 128,216 52,172 52,84" /><polygon points="128,84 82,168 174,168" /></g>
      </svg>
    </span>
  );
}
