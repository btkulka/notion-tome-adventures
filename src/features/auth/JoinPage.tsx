import React, { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { FullScreenSpinner, Notice } from './guards';

/** /join/:code — signed-in players redeem an invite; the table asks which character is theirs. */
export default function JoinPage() {
  const { code } = useParams();
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    api<{ campaignId: string }>(`/api/join/${encodeURIComponent(code)}`, { method: 'POST' })
      .then(({ campaignId: joined }) => setCampaignId(joined))
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not join'));
  }, [code]);

  if (campaignId) return <Navigate to={`/play/${campaignId}`} replace />;
  if (!error) return <FullScreenSpinner label="Joining the table…" />;
  return (
    <Notice title="Couldn't join" action={<Link to="/" className="t-btn self-start">Back</Link>}>
      <p className="m-0">{error}</p>
      <p className="t-small m-0 text-[14px]">Ask your DM for a fresh invite link.</p>
    </Notice>
  );
}
