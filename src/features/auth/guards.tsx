import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from './AuthProvider';

export function FullScreenSpinner({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="min-h-svh flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-muted-foreground">{label}</p>
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
  const { loading, session } = useAuth();
  const redirect = useLoginRedirect();
  if (loading) return <FullScreenSpinner />;
  if (!session) return redirect;
  return <>{children}</>;
}

/** An allowlisted DM. Everyone else sees why they can't get in. */
export function RequireDm({ children }: { children: React.ReactNode }) {
  const { loading, session, isDm, profile, signOut } = useAuth();
  const redirect = useLoginRedirect();
  if (loading) return <FullScreenSpinner />;
  if (!session) return redirect;
  if (!isDm) {
    return (
      <div className="min-h-svh flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-accent" />
              DM tools only
            </CardTitle>
            <CardDescription>
              Signed in as {profile?.display_name ?? profile?.discord_username ?? 'unknown'}, which isn't on the DM
              allowlist. Players join through the invite link their DM shares.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {profile?.discord_id && (
              <p className="text-sm text-muted-foreground">
                Setting up? Add Discord ID <code className="text-foreground">{profile.discord_id}</code> to the{' '}
                <code>dm_allowlist</code> table in Supabase, then reload.
              </p>
            )}
            <Button variant="outline" onClick={() => signOut()}>
              Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  return <>{children}</>;
}
