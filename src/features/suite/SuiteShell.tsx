import React, { Suspense, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { CampaignSelect } from '@/components/ui/campaign-select';
import { useAuth } from '@/features/auth/useAuth';
import { FullScreenSpinner } from '@/features/auth/guards';
import { useSelectedCampaign } from './campaign';

/** Height of the top bar. Tools that fill the screen fill the space under it (see .suite-body in index.css). */
const BAR = '64px';

const TABLE = { to: '/table', label: 'Table', icon: 'M12 3l9 9-9 9-9-9z M12 8l4 4-4 4-4-4z' };

const SECTIONS = [
  { to: '/maps', label: 'Maps', icon: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z M9 4v14 M15 6v14' },
  { to: '/database', label: 'Database', icon: 'M4 4h16v4.5H4z M4 9.75h16v4.5H4z M4 15.5h16v4.5H4z' },
  { to: '/campaign', label: 'Campaign and setup', icon: 'M5 3h11l3 3v15H5z M9 8h6 M9 12h6 M9 16h4' },
];

/** What the Tools flyout opens. */
const TOOLS = [
  {
    to: '/tools/encounters',
    label: 'Encounter generator',
    hint: 'Creatures from the bestiary for an XP budget',
    icon: 'M4 4l11 11 M12.5 17.5l5-5 M16 16l4 4 M20 4 9 15 M6.5 12.5l5 5 M8 16l-4 4',
  },
  {
    to: '/tools/treasure',
    label: 'Treasure generator',
    hint: 'Coins and magic items, carried or hoarded',
    icon: 'M3 10h18v10H3z M4 10V7l3-3h10l3 3v3 M10 13h4v3h-4z',
  },
];
const TOOLS_ICON = 'M12 2 21 7v10l-9 5-9-5V7z M12 7 7.5 15h9z';

const railItem = (isActive: boolean) =>
  `flex h-11 w-11 items-center justify-center transition-colors ${isActive ? 'bg-ink-2 text-gilt-hi shadow-[inset_2px_0_0_#C4A35A]' : 'text-bone-3 hover:text-bone'}`;
const railLink = ({ isActive }: { isActive: boolean }) => railItem(isActive);

function Icon({ d, size = 20 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function RailLink({ to, label, icon }: { to: string; label: string; icon: string }) {
  return (
    <NavLink to={to} aria-label={label} title={label} className={railLink}>
      <Icon d={icon} />
    </NavLink>
  );
}

/** The Tools tab: a flyout beside the rail listing the generators. */
function ToolsFlyout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-label="Tools"
        title="Tools"
        aria-expanded={open}
        aria-controls="tools-flyout"
        onClick={() => setOpen((o) => !o)}
        className={railItem(open || pathname.startsWith('/tools'))}
      >
        <Icon d={TOOLS_ICON} />
      </button>
      {open && (
        <nav id="tools-flyout" aria-label="Tools" className="t-frame absolute top-0 left-[calc(100%+11px)] w-[300px] flex flex-col gap-1 px-2 pt-4 pb-2 shadow-[0_24px_48px_-24px_rgba(0,0,0,0.95)]">
          <span className="t-label px-3 pb-1">Tools</span>
          {TOOLS.map(({ to, label, hint, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-start gap-3.5 px-3 py-2.5 ${isActive ? 'bg-ink-2 text-gilt-hi shadow-[inset_2px_0_0_#C4A35A]' : 'text-bone hover:bg-ink-2'}`
              }
            >
              <span className="mt-0.5 text-gilt"><Icon d={icon} size={18} /></span>
              <span className="flex flex-col gap-0.5">
                <span className="font-semibold leading-tight">{label}</span>
                <span className="t-small text-[13px] leading-snug">{hint}</span>
              </span>
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}

/**
 * DM suite frame: a top bar with the Tome sigil and the campaign every tool works
 * on, and under it the tool rail beside whichever tool is open.
 */
export default function SuiteShell() {
  const { profile, signOut } = useAuth();
  const [campaign, setCampaign] = useSelectedCampaign();
  const initials = (profile?.displayName ?? profile?.username ?? '?').slice(0, 2).toUpperCase();

  return (
    <div className="flex h-svh w-full flex-col overflow-hidden" style={{ '--suite-bar': BAR } as React.CSSProperties}>
      <header className="flex shrink-0 items-center gap-4 border-b border-rule bg-ink-0 pl-3 pr-4 sm:gap-6" style={{ height: BAR }}>
        <Link to="/" aria-label="Tome" className="flex items-center gap-4 text-bone">
          <span className="t-sigil m-1" style={{ width: 40, height: 40 }}>
            <svg width="26" height="26" viewBox="0 0 256 256" aria-hidden="true">
              <g fill="none" stroke="#C4A35A" strokeWidth="14" strokeLinejoin="miter">
                <polygon points="128,40 204,84 204,172 128,216 52,172 52,84" />
                <polygon points="128,84 82,168 174,168" />
              </g>
            </svg>
          </span>
          <span className="t-h2 hidden sm:inline">Tome</span>
        </Link>
        <div className="flex min-w-0 items-center gap-3">
          <span className="t-label hidden md:inline">Campaign</span>
          <CampaignSelect
            value={campaign}
            onValueChange={(c) => setCampaign(c ? { id: c.id, name: c.name, active: c.active, coverArt: c.coverArt } : null)}
            placeholder="Choose a campaign"
            className="w-48 sm:w-72"
          />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* No overflow on the rail: it would clip the Tools flyout. */}
        <nav aria-label="Suite" className="relative z-40 w-16 shrink-0 flex flex-col items-center gap-1.5 py-4 border-r border-rule bg-ink-0">
          <RailLink {...TABLE} />
          <ToolsFlyout />
          {SECTIONS.map((s) => <RailLink key={s.to} {...s} />)}
          <div className="mt-auto flex flex-col items-center gap-2">
            <NavLink to="/settings" aria-label="Settings" title="Settings" className={railLink}>
              <Icon d="M3 6h11 M18 6h3 M3 12h5 M12 12h9 M3 18h13 M20 18h1 M14 4h4v4h-4z M8 10h4v4H8z M16 16h4v4h-4z" />
            </NavLink>
            {profile?.avatarUrl ? (
              <img src={profile.avatarUrl} alt="" title={profile.displayName ?? profile.username} className="h-[34px] w-[34px] border border-gilt-deep" />
            ) : (
              <span className="t-portrait t-portrait--sm" title={profile?.username}>{initials}</span>
            )}
            <button type="button" aria-label="Sign out" title="Sign out" onClick={() => signOut()} className="flex h-9 w-9 items-center justify-center text-bone-3 hover:text-bone">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" aria-hidden="true">
                <path d="M15 4h4v16h-4 M10 8l-4 4 4 4 M6 12h10" />
              </svg>
            </button>
          </div>
        </nav>
        <main className="suite-body min-w-0 flex-1 overflow-auto">
          {/* Each tool is its own chunk; the bar and rail stay put while one loads. */}
          <Suspense fallback={<FullScreenSpinner />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
