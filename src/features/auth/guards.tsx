import React from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { BusyDiamond } from '@/components/ui/tome-loading';
import { useAuth } from './useAuth';

/** The boot loader in index.html draws the same thing, so React takes over without a blink. */
export function FullScreenSpinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="t-root min-h-svh flex flex-col items-center justify-center gap-4" role="status">
      <BusyDiamond style={{ width: 14, height: 14 }} />
      <p className="t-small m-0">{label}</p>
    </div>
  );
}

/** A framed message on an empty page, for errors and dead ends. */
export function Notice({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="t-root min-h-svh flex items-center justify-center p-6">
      <div className="t-frame w-full max-w-md p-8 flex flex-col gap-4">
        <h1 className="t-h2">{title}</h1>
        <div className="t-body flex flex-col gap-3">{children}</div>
        {action}
      </div>
    </div>
  );
}

function useLoginRedirect() {
  const location = useLocation();
  const next = `${location.pathname}${location.search}`;
  return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
}

/** Any signed-in Discord user (players). */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { loading, profile } = useAuth();
  const redirect = useLoginRedirect();
  if (loading) return <FullScreenSpinner />;
  if (!profile) return redirect;
  return <>{children}</>;
}

/** An allowlisted DM. Everyone else sees why they can't get in. */
export function RequireDm({ children }: { children: React.ReactNode }) {
  const { loading, isDm, profile, signOut } = useAuth();
  const redirect = useLoginRedirect();
  if (loading) return <FullScreenSpinner />;
  if (!profile) return redirect;
  if (!isDm) {
    return (
      <Notice
        title="For the DM only"
        action={
          <div className="flex flex-wrap gap-2.5">
            <Link to="/" className="t-btn">Go to my table</Link>
            <button type="button" className="t-btn t-btn--quiet" onClick={() => signOut()}>Sign out</button>
          </div>
        }
      >
        <p className="m-0">
          Signed in as {profile.displayName ?? profile.username}, who isn't on the DM allowlist. Players join through the
          invite link their DM shares.
        </p>
        <p className="t-small m-0 text-[14px]">
          Should you be a DM? Ask one to add the Discord username <code className="text-bone">{profile.username}</code> under
          Settings, then reload this page.
        </p>
      </Notice>
    );
  }
  return <>{children}</>;
}
