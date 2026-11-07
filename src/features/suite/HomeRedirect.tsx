import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuth } from '@/features/auth/useAuth';
import { FullScreenSpinner, Notice } from '@/features/auth/guards';

/** "/" — DMs go to the live table; players go to theirs. */
export default function HomeRedirect() {
  const { isDm, profile, signOut } = useAuth();
  const [campaigns, setCampaigns] = useState<string[] | null>(null);

  useEffect(() => {
    if (isDm || !profile) return;
    api<{ campaigns: { campaignId: string }[] }>('/api/campaigns/mine')
      .then(({ campaigns: mine }) => setCampaigns(mine.map((m) => m.campaignId)))
      .catch(() => setCampaigns([]));
  }, [isDm, profile]);

  if (isDm) return <Navigate to="/table" replace />;
  if (campaigns === null) return <FullScreenSpinner />;
  if (campaigns.length === 1) return <Navigate to={`/play/${campaigns[0]}`} replace />;

  return (
    <Notice
      title={campaigns.length ? 'Your tables' : 'No table yet'}
      action={
        <div className="flex flex-col gap-2.5">
          {campaigns.map((id, i) => <Link key={id} to={`/play/${id}`} className="t-btn">Table {i + 1}</Link>)}
          <button type="button" className="t-btn t-btn--quiet" onClick={() => signOut()}>Sign out</button>
        </div>
      }
    >
      <p className="m-0">{campaigns.length ? 'You sit at more than one table. Pick one.' : 'Ask your DM for an invite link to join their table.'}</p>
    </Notice>
  );
}
