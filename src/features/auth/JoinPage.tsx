import React, { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { FullScreenSpinner } from './guards';

/** /join/:code — signed-in players redeem an invite and land at the table. */
export default function JoinPage() {
  const { code } = useParams();
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    supabase.rpc('join_campaign', { invite_code: code }).then(({ data, error: rpcError }) => {
      if (rpcError) setError(rpcError.message);
      else setCampaignId(data);
    });
  }, [code]);

  if (campaignId) return <Navigate to={`/play/${campaignId}`} replace />;
  if (!error) return <FullScreenSpinner label="Joining the table..." />;
  return (
    <div className="min-h-svh flex items-center justify-center p-6">
      <Card className="max-w-sm w-full">
        <CardHeader>
          <CardTitle>Couldn't join</CardTitle>
          <CardDescription>{error}</CardDescription>
          <Link to="/" className="text-sm text-accent underline pt-2">
            Back
          </Link>
        </CardHeader>
      </Card>
    </div>
  );
}
