-- Movie Match schema
-- Run this once against your Supabase project (SQL editor, or `supabase db push`).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- sessions
-- ---------------------------------------------------------------------------
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'collecting_prefs'
    check (status in ('collecting_prefs', 'generating_pool', 'swiping', 'matched', 'final_pick', 'done')),
  round int not null default 1,
  device_a_id uuid not null,
  device_b_id uuid,
  pair_key text,
  final_picks jsonb
);

create index if not exists sessions_pair_key_idx on sessions (pair_key);

-- ---------------------------------------------------------------------------
-- preferences
-- ---------------------------------------------------------------------------
create table if not exists preferences (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  partner text not null check (partner in ('a', 'b')),
  moods text[] not null default '{}',
  mood_text text default '',
  languages text[] not null default '{}',
  content_type text not null check (content_type in ('movies', 'include_series')),
  min_rating int not null check (min_rating in (6, 7, 8, 9)),
  eras text[] not null default '{}',
  submitted_at timestamptz not null default now(),
  unique (session_id, partner)
);

-- ---------------------------------------------------------------------------
-- pool_titles
-- ---------------------------------------------------------------------------
create table if not exists pool_titles (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  round int not null,
  tmdb_id int not null,
  media_type text not null check (media_type in ('movie', 'tv')),
  title text not null,
  year int,
  runtime int,
  synopsis text,
  poster_url text,
  imdb_rating numeric(3, 1),
  genres text[] not null default '{}',
  streaming_platforms jsonb not null default '[]',
  created_at timestamptz not null default now(),
  unique (session_id, round, tmdb_id, media_type)
);

create index if not exists pool_titles_session_round_idx on pool_titles (session_id, round);

-- ---------------------------------------------------------------------------
-- swipes
-- ---------------------------------------------------------------------------
create table if not exists swipes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  round int not null,
  partner text not null check (partner in ('a', 'b')),
  tmdb_id int not null,
  media_type text not null check (media_type in ('movie', 'tv')),
  direction text not null check (direction in ('right', 'left')),
  created_at timestamptz not null default now(),
  unique (session_id, round, partner, tmdb_id, media_type)
);

create index if not exists swipes_session_round_idx on swipes (session_id, round);

-- ---------------------------------------------------------------------------
-- matches
-- ---------------------------------------------------------------------------
create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  round int not null,
  tmdb_id int not null,
  media_type text not null check (media_type in ('movie', 'tv')),
  matched_at timestamptz not null default now(),
  unique (session_id, round, tmdb_id, media_type)
);

-- ---------------------------------------------------------------------------
-- ratings
-- ---------------------------------------------------------------------------
create table if not exists ratings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  tmdb_id int not null,
  media_type text not null check (media_type in ('movie', 'tv')),
  stars int not null check (stars between 1 and 5),
  note text default '',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Match detection trigger
--
-- When a 'right' swipe is inserted, check whether the OTHER partner has
-- already swiped 'right' on the same title in the same session/round. If so,
-- record a match. Both clients subscribe to postgres_changes on `matches`
-- filtered by session_id, so the match reveal fires the instant this insert
-- happens — independent of whether either partner has finished their deck.
-- ---------------------------------------------------------------------------
create or replace function check_for_match()
returns trigger as $$
begin
  if new.direction <> 'right' then
    return new;
  end if;

  if exists (
    select 1 from swipes s
    where s.session_id = new.session_id
      and s.round = new.round
      and s.tmdb_id = new.tmdb_id
      and s.media_type = new.media_type
      and s.direction = 'right'
      and s.partner <> new.partner
  ) then
    insert into matches (session_id, round, tmdb_id, media_type)
    values (new.session_id, new.round, new.tmdb_id, new.media_type)
    on conflict (session_id, round, tmdb_id, media_type) do nothing;

    update sessions set status = 'matched' where id = new.session_id;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists swipes_check_for_match on swipes;
create trigger swipes_check_for_match
  after insert on swipes
  for each row
  execute function check_for_match();

-- ---------------------------------------------------------------------------
-- Realtime
-- Enable replication so clients can subscribe to postgres_changes.
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table sessions;
alter publication supabase_realtime add table matches;

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- No auth/accounts in this app — sessions are capability-secured by their
-- unguessable uuid id (the join link/QR). RLS is enabled with permissive
-- policies scoped to authenticated-or-anon access via the anon key; the
-- service role (used only in server route handlers) bypasses RLS entirely.
-- ---------------------------------------------------------------------------
alter table sessions enable row level security;
alter table preferences enable row level security;
alter table pool_titles enable row level security;
alter table swipes enable row level security;
alter table matches enable row level security;
alter table ratings enable row level security;

create policy "anon can read sessions" on sessions for select using (true);
create policy "anon can read preferences" on preferences for select using (true);
create policy "anon can read pool_titles" on pool_titles for select using (true);
create policy "anon can read swipes" on swipes for select using (true);
create policy "anon can read matches" on matches for select using (true);
create policy "anon can read ratings" on ratings for select using (true);

-- Writes go through server route handlers using the service role key, which
-- bypasses RLS, so no anon insert/update/delete policies are defined here.
