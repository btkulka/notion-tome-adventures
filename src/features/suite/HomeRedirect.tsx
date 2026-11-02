import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/AuthProvider';
import { FullScreenSpinner } from '@/features/auth/guards';

/** "/" — DMs go to their tools; players go to their table. */
export default function HomeRedirect() {
  const { isDm, user, signOut } = useAuth();
  const [campaigns, setCampaigns] = useState<string[] | null>(null);

  useEffect(() => {
    if (isDm || !user) return;
    supabase
      .from('campaign_members')
      .select('campaign_id')
      .eq('user_id', user.id)
      .then(({ data }) => setCampaigns((data ?? []).map((r) => r.campaign_id)));
  }, [isDm, user]);

  if (isDm) return <Navigate to="/generate" replace />;
  if (campaigns === null) return <FullScreenSpinner />;
  if (campaigns.length === 1) return <Navigate to={`/play/${campaigns[0]}`} replace />;

  return (
    <div className="min-h-svh flex items-center justify-center p-6">
      <Card className="max-w-sm w-full">
        <CardHeader>
          <CardTitle>{campaigns.length ? 'Your tables' : 'No table yet'}</CardTitle>
          <CardDescription>
            {campaigns.length ? 'Pick a campaign to join.' : 'Ask your DM for an invite link to join their table.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {campaigns.map((id, i) => (
            <Button key={id} asChild variant="outline" className="w-full">
              <Link to={`/play/${id}`}>Campaign {i + 1}</Link>
            </Button>
          ))}
          <Button variant="ghost" className="w-full" onClick={() => signOut()}>
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
