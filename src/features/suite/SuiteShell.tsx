import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Dice6, LogOut, Map, Settings } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useAuth } from '@/features/auth/AuthProvider';

const TOOLS = [
  { to: '/generate', label: 'Generators', icon: Dice6 },
  { to: '/maps', label: 'Maps', icon: Map },
  { to: '/settings', label: 'Campaign & setup', icon: Settings },
];

function RailButton({ label, children }: { label: string; children: React.ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

/** DM suite frame: a slim tool rail beside whichever tool is open. */
export default function SuiteShell() {
  const { profile, signOut } = useAuth();
  const initials = (profile?.display_name ?? profile?.discord_username ?? '?').slice(0, 2).toUpperCase();

  return (
    <div className="flex min-h-svh w-full">
      <nav className="sticky top-0 h-svh w-14 shrink-0 flex flex-col items-center gap-2 py-3 border-r border-border bg-card/90 backdrop-blur z-40">
        {TOOLS.map(({ to, label, icon: Icon }) => (
          <RailButton key={to} label={label}>
            <NavLink
              to={to}
              aria-label={label}
              className={({ isActive }) =>
                cn(
                  'flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground hover:bg-muted',
                  isActive && 'bg-primary text-primary-foreground shadow-glow hover:bg-primary hover:text-primary-foreground'
                )
              }
            >
              <Icon className="h-5 w-5" />
            </NavLink>
          </RailButton>
        ))}
        <div className="mt-auto flex flex-col items-center gap-2">
          <RailButton label={profile?.display_name ?? 'Signed in'}>
            <Avatar className="h-8 w-8">
              {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt="" />}
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
          </RailButton>
          <RailButton label="Sign out">
            <button
              type="button"
              aria-label="Sign out"
              onClick={() => signOut()}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </RailButton>
        </div>
      </nav>
      <div className="flex-1 min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
