import React, { useEffect, useState } from 'react';
import { FullScreenSpinner } from '@/features/auth/guards';
import { claimCampaign, useSelectedCampaign, type SelectedCampaign } from './campaign';

/** Campaigns this tab has already claimed. Claiming is idempotent, so once a session is enough. */
const claimed = new Set<string>();

/**
 * Suite tools work on one campaign at a time, chosen in the top bar
 * (SuiteShell). This waits for that choice and makes sure the signed-in DM owns
 * the campaign before rendering the tool.
 */
export function CampaignGate({ children }: { children: (campaign: SelectedCampaign) => React.ReactNode }) {
  const [campaign] = useSelectedCampaign();
  const [, setClaimedNow] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!campaign || claimed.has(campaign.id)) return;
    let cancelled = false;
    setError(null);
    claimCampaign(campaign.id)
      .then(() => {
        claimed.add(campaign.id);
        if (!cancelled) setClaimedNow(campaign.id);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not open this campaign');
      });
    return () => {
      cancelled = true;
    };
  }, [campaign]);

  if (campaign && claimed.has(campaign.id)) return <>{children(campaign)}</>;
  if (campaign && !error) return <FullScreenSpinner label={`Opening ${campaign.name}…`} />;

  return (
    <div className="t-root min-h-svh flex items-center justify-center p-6">
      <div className="t-frame w-full max-w-md p-8 flex flex-col gap-5">
        <span className="t-label" style={{ color: 'var(--gilt)' }}>Choose a campaign</span>
        <h1 className="t-h1">Which table?</h1>
        <p className="t-body m-0">
          Maps, the live table and the roster belong to one campaign at a time. Choose it under Campaign in the bar above.
        </p>
        {error && <span className="text-blood-text">{error}</span>}
      </div>
    </div>
  );
}
