import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loading, Shimmer } from '@/components/ui/tome-loading';
import { CampaignGate } from '@/features/suite/CampaignGate';
import { sameVersion, useCached } from '@/lib/cached';
import type { SelectedCampaign } from '@/features/suite/campaign';
import { formatWorldTime } from './travel/travel';
import { mapsApi } from './api';
import { GenerateDialog } from './GenerateDialog';
import { Minimap } from './Minimap';
import type { LiveSession, MapDoc, MapSummary } from './types';

interface Atlas {
  maps: MapSummary[];
  live: LiveSession | null;
  docs: Record<string, MapDoc>;
}

const NO_DOCS: Record<string, MapDoc> = {};

async function loadAtlas(campaignId: string): Promise<Atlas> {
  const [maps, live] = await Promise.all([mapsApi.list(campaignId), mapsApi.live(campaignId)]);
  // Terrain is a few kilobytes per map, so the cards can paint real minimaps.
  const full = await Promise.all(maps.slice(0, 24).map((m) => mapsApi.get(m.id)));
  return { maps, live, docs: Object.fromEntries(full.map((d) => [d.id, d])) };
}

/** Maps that come back at the same version keep their old documents, so their minimaps don't redraw. */
const keepAtlas = (old: Atlas, next: Atlas): Atlas => ({
  ...next,
  docs: Object.fromEntries(Object.entries(next.docs).map(([id, d]) => [id, old.docs[id] ? sameVersion(old.docs[id], d) : d])),
});

export default function MapLibraryPage() {
  return <CampaignGate>{(campaign) => <Library campaign={campaign} />}</CampaignGate>;
}

function Library({ campaign }: { campaign: SelectedCampaign }) {
  const navigate = useNavigate();
  const [generating, setGenerating] = useState(false);
  const atlas = useCached(['atlas', campaign.id], () => loadAtlas(campaign.id), { keep: keepAtlas });
  const maps = atlas.data?.maps ?? null;
  const docs = atlas.data?.docs ?? NO_DOCS;
  const live = atlas.data?.live ?? null;
  const error = atlas.error ? atlas.error.message || 'Could not load maps' : null;

  const liveId = live?.status === 'live' ? live.activeMapId : null;
  const hero = (maps ?? []).find((m) => m.id === liveId) ?? maps?.[0];
  const others = (maps ?? []).filter((m) => m.id !== hero?.id);
  const roots = (maps ?? []).filter((m) => !m.parentMapId);
  const childrenOf = (id: string) => (maps ?? []).filter((m) => m.parentMapId === id);

  return (
    <div className="t-root min-h-svh flex flex-col">
      <header className="flex flex-wrap items-end justify-between gap-4 px-11 pt-7 pb-6 border-b border-rule">
        <div className="flex flex-col gap-2">
          <span className="t-label">{campaign.name}</span>
          <h1 className="t-h1">Atlas</h1>
        </div>
        <button type="button" className="t-btn t-btn--primary" onClick={() => setGenerating(true)}>Generate a region</button>
      </header>

      {error && <p className="px-11 pt-6 text-blood-text">{error}</p>}

      <div className="flex flex-1 flex-wrap items-start">
        <aside aria-label="Map hierarchy" className="flex-[1_1_260px] max-w-[280px] self-stretch border-r border-rule bg-[rgba(18,17,19,0.75)] px-5 py-6 flex flex-col gap-1">
          <span className="t-label px-2 pb-2">Regions</span>
          {maps === null && !error && [70, 55, 62].map((w) => <Shimmer key={w} className="h-5 mx-3 my-3" style={{ width: `${w}%` }} />)}
          {maps?.length === 0 && <span className="t-small px-2">None yet.</span>}
          {roots.map((m) => (
            <div key={m.id} className="flex flex-col">
              <Link to={`/maps/${m.id}`} className="flex items-center gap-3 min-h-[44px] px-3 text-bone hover:bg-ink-2">
                <i className="t-diamond" />
                <span className="t-h3 flex-1">{m.name}</span>
                {m.id === liveId && <i className="t-diamond" style={{ background: 'var(--blood)' }} aria-label="Live" />}
              </Link>
              {childrenOf(m.id).map((c) => (
                <Link key={c.id} to={`/maps/${c.id}`} className="ml-4 pl-4 border-l border-rule flex items-center gap-3 min-h-[40px] text-bone-2 hover:text-bone">
                  <i className="t-diamond t-diamond--hollow" />
                  {c.name}
                </Link>
              ))}
            </div>
          ))}
        </aside>

        <main className="flex-[999_1_560px] min-w-0 px-11 py-8 flex flex-col gap-8">
          {maps === null && !error && (
            <section aria-label="Current region" aria-busy="true" className="t-frame flex flex-wrap">
              <div className="flex-[1_1_420px] min-w-0 flex justify-center items-center bg-ink-0 p-6">
                <Shimmer className="w-full max-w-[460px] aspect-square" />
              </div>
              <div className="flex-[1_1_280px] p-8 flex flex-col gap-4">
                <Loading label="Unrolling the atlas…" />
                <Shimmer className="h-8 w-3/4" />
                <Shimmer className="h-5 w-1/2" />
              </div>
            </section>
          )}
          {maps?.length === 0 && (
            <div className="t-frame p-10 flex flex-col items-start gap-4 max-w-xl">
              <h2 className="t-h2">No maps for this campaign</h2>
              <p className="t-body m-0">Generate an overworld region from a seed, then shape it in the editor.</p>
              <button type="button" className="t-btn t-btn--primary" onClick={() => setGenerating(true)}>Generate a region</button>
            </div>
          )}

          {hero && (
            <section aria-label="Current region" className="t-frame flex flex-wrap">
              <div className="flex-[1_1_420px] min-w-0 flex justify-center items-center bg-ink-0 p-6">
                {docs[hero.id] ? <Minimap terrain={docs[hero.id].terrain} className="w-full max-w-[460px] aspect-square border border-rule" /> : <Shimmer className="w-full max-w-[460px] aspect-square border border-rule" />}
              </div>
              <div className="flex-[1_1_280px] p-8 flex flex-col gap-4">
                {hero.id === liveId ? (
                  <span className="t-chip self-start" style={{ borderColor: 'rgba(166,58,53,0.6)', color: 'var(--blood-text)' }}>
                    <i className="t-diamond" style={{ background: 'var(--blood)' }} />Live now
                  </span>
                ) : (
                  <span className="t-small">Most recently edited</span>
                )}
                <h2 className="t-h1 text-[28px]">{hero.name}</h2>
                <dl className="m-0 grid grid-cols-2 gap-4">
                  <div className="t-stat"><dt>Size</dt><dd className="text-[20px]">{hero.width} × {hero.height} mi</dd></div>
                  <div className="t-stat"><dt>Seed</dt><dd className="text-[20px]">{hero.seed}</dd></div>
                  {hero.id === liveId && live && (
                    <div className="t-stat col-span-2"><dt>World clock</dt><dd className="t-num text-[20px]">{formatWorldTime(live.worldMinutes)}</dd></div>
                  )}
                </dl>
                <div className="mt-auto flex flex-wrap gap-2.5">
                  <button type="button" className="t-btn t-btn--primary" onClick={() => navigate(`/table?map=${hero.id}`)}>Run the table</button>
                  <Link to={`/maps/${hero.id}`} className="t-btn">Edit map</Link>
                </div>
              </div>
            </section>
          )}

          {others.length > 0 && (
            <section aria-label="Other maps" className="grid gap-6 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
              {others.map((m) => (
                <Link key={m.id} to={`/maps/${m.id}`} className="t-panel flex flex-col text-bone">
                  <div className="flex justify-center bg-ink-0 border-b border-rule p-4">
                    {docs[m.id] ? <Minimap terrain={docs[m.id].terrain} className="w-full max-w-[220px] aspect-square" /> : <Shimmer className="w-full max-w-[220px] aspect-square" />}
                  </div>
                  <div className="px-4 py-3 flex flex-col gap-1">
                    <span className="t-h3">{m.name}</span>
                    <span className="t-small">{m.kind === 'overworld' ? 'Overworld' : 'Local map'} · {m.width} × {m.height} · edited {new Date(m.updatedAt).toLocaleDateString()}</span>
                  </div>
                </Link>
              ))}
            </section>
          )}
        </main>
      </div>

      <GenerateDialog open={generating} onOpenChange={setGenerating} campaignId={campaign.id} onCreated={(id) => navigate(`/maps/${id}`)} />
    </div>
  );
}
