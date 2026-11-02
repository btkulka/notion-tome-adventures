import React, { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Dice6 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from './AuthProvider';
import { FullScreenSpinner } from './guards';

/** Only same-site paths, so `?next=` can't bounce people elsewhere. */
function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

export default function LoginPage() {
  const { loading, session, signInWithDiscord } = useAuth();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  if (loading) return <FullScreenSpinner />;
  if (session) return <Navigate to={next} replace />;

  const signIn = async () => {
    setError(null);
    setRedirecting(true);
    try {
      await signInWithDiscord(`/login?next=${encodeURIComponent(next)}`);
    } catch (err) {
      setRedirecting(false);
      setError(err instanceof Error ? err.message : 'Discord sign-in failed');
    }
  };

  return (
    <div className="min-h-svh flex items-center justify-center p-6">
      <Card className="max-w-sm w-full shadow-mystical">
        <CardHeader className="text-center">
          <Dice6 className="h-10 w-10 mx-auto text-accent mb-2" />
          <CardTitle>Tome Adventures</CardTitle>
          <CardDescription>Sign in with Discord to join the table.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full" onClick={signIn} disabled={redirecting}>
            {redirecting ? 'Opening Discord...' : 'Sign in with Discord'}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
