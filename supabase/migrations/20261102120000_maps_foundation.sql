-- DM suite foundation: Discord identities, campaign membership, maps, live
-- table state. Notion stays the source of truth for campaign content; these
-- tables hold app-authored data only. Campaign ids are Notion page ids.

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  discord_id text,
  discord_username text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_discord_id_idx on public.profiles (discord_id);

-- Mirrors the Discord identity Supabase Auth stores in raw_user_meta_data.
create function public.sync_profile_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, discord_id, discord_username, display_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'provider_id',
    regexp_replace(new.raw_user_meta_data ->> 'name', '#0$', ''),
    coalesce(
      new.raw_user_meta_data -> 'custom_claims' ->> 'global_name',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
    set discord_id = excluded.discord_id,
        discord_username = excluded.discord_username,
        display_name = excluded.display_name,
        avatar_url = excluded.avatar_url,
        updated_at = now();
  return new;
end;
$$;

create trigger sync_profile_on_auth_change
  after insert or update of raw_user_meta_data on auth.users
  for each row execute function public.sync_profile_from_auth();

-- Discord accounts allowed to run campaigns. Managed from the Supabase dashboard.
create table public.dm_allowlist (
  discord_id text primary key,
  note text,
  created_at timestamptz not null default now()
);

alter table public.dm_allowlist enable row level security;

create function public.is_dm()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.dm_allowlist a on a.discord_id = p.discord_id
    where p.id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Campaign membership
-- ---------------------------------------------------------------------------

create table public.campaign_members (
  campaign_id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('dm', 'player')),
  character_notion_id text,
  joined_at timestamptz not null default now(),
  primary key (campaign_id, user_id)
);

create index campaign_members_user_idx on public.campaign_members (user_id);

-- Security definer so policies on campaign_members can use them without recursing.
create function public.is_campaign_dm(cid text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.campaign_members
    where campaign_id = cid and user_id = auth.uid() and role = 'dm'
  );
$$;

create function public.is_campaign_member(cid text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.campaign_members
    where campaign_id = cid and user_id = auth.uid()
  );
$$;

alter table public.campaign_members enable row level security;

create policy "members see their campaign rosters" on public.campaign_members
  for select using (public.is_campaign_member(campaign_id));

create policy "dm manages roster" on public.campaign_members
  for update using (public.is_campaign_dm(campaign_id))
  with check (public.is_campaign_dm(campaign_id));

create policy "dm removes members, members leave" on public.campaign_members
  for delete using (public.is_campaign_dm(campaign_id) or user_id = auth.uid());

-- An allowlisted DM takes ownership of a Notion campaign. Idempotent for the owner.
create function public.claim_campaign(cid text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_dm() then
    raise exception 'Only an allowlisted DM can run a campaign';
  end if;
  if exists (
    select 1 from public.campaign_members
    where campaign_id = cid and role = 'dm' and user_id <> auth.uid()
  ) then
    raise exception 'Another DM already runs this campaign';
  end if;
  insert into public.campaign_members (campaign_id, user_id, role)
  values (cid, auth.uid(), 'dm')
  on conflict (campaign_id, user_id) do update set role = 'dm';
end;
$$;

create table public.campaign_invites (
  code text primary key,
  campaign_id text not null,
  created_by uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz,
  max_uses integer,
  uses integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.campaign_invites enable row level security;

create policy "dm manages invites" on public.campaign_invites
  for all using (public.is_campaign_dm(campaign_id))
  with check (public.is_campaign_dm(campaign_id) and created_by = auth.uid());

create function public.join_campaign(invite_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  invite public.campaign_invites;
begin
  if auth.uid() is null then
    raise exception 'Sign in with Discord first';
  end if;
  select * into invite from public.campaign_invites where code = upper(trim(invite_code)) for update;
  if not found then
    raise exception 'That invite code does not exist';
  end if;
  if invite.expires_at is not null and invite.expires_at < now() then
    raise exception 'That invite has expired';
  end if;
  if invite.max_uses is not null and invite.uses >= invite.max_uses then
    raise exception 'That invite has been used up';
  end if;
  insert into public.campaign_members (campaign_id, user_id, role)
  values (invite.campaign_id, auth.uid(), 'player')
  on conflict (campaign_id, user_id) do nothing;
  update public.campaign_invites set uses = uses + 1 where code = invite.code;
  return invite.campaign_id;
end;
$$;

-- A player picks which Notion character they play.
create function public.claim_character(cid text, character_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.campaign_members
  set character_notion_id = character_id
  where campaign_id = cid and user_id = auth.uid();
  if not found then
    raise exception 'You are not in this campaign';
  end if;
end;
$$;

alter table public.profiles enable row level security;

create policy "see yourself and your tablemates" on public.profiles
  for select using (
    id = auth.uid()
    or exists (
      select 1
      from public.campaign_members mine
      join public.campaign_members theirs on theirs.campaign_id = mine.campaign_id
      where mine.user_id = auth.uid() and theirs.user_id = profiles.id
    )
  );

-- ---------------------------------------------------------------------------
-- Maps
-- ---------------------------------------------------------------------------

create function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.maps (
  id uuid primary key default gen_random_uuid(),
  campaign_id text not null,
  parent_map_id uuid references public.maps (id) on delete set null,
  parent_pin_id uuid,
  kind text not null check (kind in ('overworld', 'local')),
  name text not null,
  width integer not null check (width between 1 and 256),
  height integer not null check (height between 1 and 256),
  scale real not null default 1,
  seed bigint not null default 0,
  gen_params jsonb,
  terrain jsonb not null,
  settings jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  thumbnail_path text,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index maps_campaign_idx on public.maps (campaign_id);
create index maps_parent_idx on public.maps (parent_map_id);
create trigger maps_touch before update on public.maps
  for each row execute function public.touch_updated_at();

alter table public.maps enable row level security;

create policy "members read maps" on public.maps
  for select using (public.is_campaign_member(campaign_id));
create policy "dm writes maps" on public.maps
  for all using (public.is_campaign_dm(campaign_id))
  with check (public.is_campaign_dm(campaign_id));

create function public.map_campaign(mid uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select campaign_id from public.maps where id = mid;
$$;

create table public.map_objects (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null references public.maps (id) on delete cascade,
  type text not null check (type in ('pin', 'path', 'prop', 'label', 'light', 'wall', 'door', 'token')),
  x real not null default 0,
  y real not null default 0,
  z real not null default 0,
  rot real not null default 0,
  hidden boolean not null default false,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index map_objects_map_idx on public.map_objects (map_id);
create trigger map_objects_touch before update on public.map_objects
  for each row execute function public.touch_updated_at();

alter table public.map_objects enable row level security;

-- Players never receive hidden objects: this is what keeps secrets server-side,
-- including over Realtime, which applies these policies per subscriber.
create policy "players read visible objects" on public.map_objects
  for select using (not hidden and public.is_campaign_member(public.map_campaign(map_id)));
create policy "dm reads all objects" on public.map_objects
  for select using (public.is_campaign_dm(public.map_campaign(map_id)));
create policy "dm writes objects" on public.map_objects
  for all using (public.is_campaign_dm(public.map_campaign(map_id)))
  with check (public.is_campaign_dm(public.map_campaign(map_id)));

-- Explored tiles (shared party view). "Visible right now" is derived client-side.
create table public.map_fog (
  map_id uuid primary key references public.maps (id) on delete cascade,
  explored text not null,
  updated_at timestamptz not null default now()
);

create trigger map_fog_touch before update on public.map_fog
  for each row execute function public.touch_updated_at();

alter table public.map_fog enable row level security;

create policy "members read fog" on public.map_fog
  for select using (public.is_campaign_member(public.map_campaign(map_id)));
create policy "dm writes fog" on public.map_fog
  for all using (public.is_campaign_dm(public.map_campaign(map_id)))
  with check (public.is_campaign_dm(public.map_campaign(map_id)));

-- ---------------------------------------------------------------------------
-- Live table
-- ---------------------------------------------------------------------------

create table public.live_sessions (
  campaign_id text primary key,
  status text not null default 'live' check (status in ('live', 'ended')),
  active_map_id uuid references public.maps (id) on delete set null,
  party_map_id uuid references public.maps (id) on delete set null,
  party_x real not null default 0,
  party_y real not null default 0,
  world_minutes integer not null default 480,
  weather text not null default 'clear' check (weather in ('clear', 'overcast', 'rain', 'storm', 'snow', 'fog')),
  notion_session_id text,
  updated_at timestamptz not null default now()
);

create trigger live_sessions_touch before update on public.live_sessions
  for each row execute function public.touch_updated_at();

alter table public.live_sessions enable row level security;

create policy "members read live session" on public.live_sessions
  for select using (public.is_campaign_member(campaign_id));
create policy "dm runs live session" on public.live_sessions
  for all using (public.is_campaign_dm(campaign_id))
  with check (public.is_campaign_dm(campaign_id));

create table public.travel_log (
  id uuid primary key default gen_random_uuid(),
  campaign_id text not null,
  map_id uuid not null references public.maps (id) on delete cascade,
  from_x integer not null,
  from_y integer not null,
  to_x integer not null,
  to_y integer not null,
  path jsonb not null,
  minutes real not null,
  miles real not null,
  pace text not null check (pace in ('slow', 'normal', 'fast')),
  started_at integer not null,
  encounter jsonb,
  created_at timestamptz not null default now()
);

create index travel_log_campaign_idx on public.travel_log (campaign_id, created_at desc);

alter table public.travel_log enable row level security;

create policy "dm owns travel log" on public.travel_log
  for all using (public.is_campaign_dm(campaign_id))
  with check (public.is_campaign_dm(campaign_id));

-- Generated art (ComfyUI) and uploads.
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  campaign_id text,
  kind text not null check (kind in ('texture', 'token', 'backdrop', 'handout', 'underlay')),
  storage_path text not null,
  prompt text,
  seed bigint,
  workflow text,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.assets enable row level security;

create policy "members read campaign assets" on public.assets
  for select using (campaign_id is not null and public.is_campaign_member(campaign_id));
create policy "dm writes assets" on public.assets
  for all using (public.is_dm() and (campaign_id is null or public.is_campaign_dm(campaign_id)))
  with check (public.is_dm() and (campaign_id is null or public.is_campaign_dm(campaign_id)));

-- ---------------------------------------------------------------------------
-- Realtime and storage
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.live_sessions, public.map_objects, public.map_fog;

-- Both private: thumbnails show hidden pins, and assets include unrevealed handouts.
-- Object paths start with the campaign id: "<campaign_id>/<file>".
insert into storage.buckets (id, name, public)
values ('map-thumbs', 'map-thumbs', false), ('map-assets', 'map-assets', false)
on conflict (id) do nothing;

create policy "dm manages thumbnails" on storage.objects
  for all using (bucket_id = 'map-thumbs' and public.is_campaign_dm((storage.foldername(name))[1]))
  with check (bucket_id = 'map-thumbs' and public.is_campaign_dm((storage.foldername(name))[1]));

create policy "members read assets" on storage.objects
  for select using (bucket_id = 'map-assets' and public.is_campaign_member((storage.foldername(name))[1]));
create policy "dm writes assets" on storage.objects
  for all using (bucket_id = 'map-assets' and public.is_campaign_dm((storage.foldername(name))[1]))
  with check (bucket_id = 'map-assets' and public.is_campaign_dm((storage.foldername(name))[1]));

grant execute on function
  public.is_dm(),
  public.is_campaign_dm(text),
  public.is_campaign_member(text),
  public.claim_campaign(text),
  public.join_campaign(text),
  public.claim_character(text, text),
  public.map_campaign(uuid)
to authenticated;
