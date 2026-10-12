-- Aduji starter schema. Review and run in Supabase SQL Editor.
-- RLS is enabled on all app tables; do not add broad public write policies.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null default 'Creator',
  avatar_url text,
  bio text,
  created_at timestamptz not null default now()
);

create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  caption text not null default '',
  video_url text not null,
  thumbnail_url text,
  category text not null default 'Lifestyle',
  visibility text not null default 'public' check (visibility in ('public','followers','private')),
  likes_count integer not null default 0 check (likes_count >= 0),
  comments_count integer not null default 0 check (comments_count >= 0),
  views_count bigint not null default 0 check (views_count >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, video_id)
);

create table if not exists public.bookmarks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, video_id)
);

create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.live_streams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  status text not null default 'scheduled' check (status in ('scheduled','live','ended','cancelled')),
  provider text not null default 'external',
  stream_url text,
  playback_url text,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.video_events (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete set null,
  video_id uuid not null references public.videos(id) on delete cascade,
  event_type text not null check (event_type in ('impression','watch_2s','watch_complete','replay','like','share','skip','not_interested')),
  watch_ms integer not null default 0 check (watch_ms >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  video_id uuid references public.videos(id) on delete cascade,
  reported_user_id uuid references public.profiles(id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 500),
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists videos_feed_idx on public.videos (visibility, created_at desc);
create index if not exists videos_user_idx on public.videos (user_id, created_at desc);
create index if not exists comments_video_idx on public.comments (video_id, created_at desc);
create index if not exists video_events_user_idx on public.video_events (user_id, created_at desc);
create index if not exists live_streams_status_idx on public.live_streams (status, created_at desc);

alter table public.profiles enable row level security;
alter table public.videos enable row level security;
alter table public.likes enable row level security;
alter table public.bookmarks enable row level security;
alter table public.follows enable row level security;
alter table public.comments enable row level security;
alter table public.live_streams enable row level security;
alter table public.video_events enable row level security;
alter table public.reports enable row level security;

-- Profiles are public; users can only modify their own profile.
create policy "profiles readable" on public.profiles for select to anon, authenticated using (true);
create policy "profiles insert own" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles update own" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Public videos readable; private/followers-only visibility is owner-only in this starter policy.
create policy "public videos readable" on public.videos for select to anon, authenticated
  using (visibility = 'public' or user_id = auth.uid());
create policy "users create own videos" on public.videos for insert to authenticated with check (user_id = auth.uid());
create policy "users update own videos" on public.videos for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users delete own videos" on public.videos for delete to authenticated using (user_id = auth.uid());

create policy "likes readable" on public.likes for select to authenticated using (true);
create policy "users like as self" on public.likes for insert to authenticated with check (user_id = auth.uid());
create policy "users unlike as self" on public.likes for delete to authenticated using (user_id = auth.uid());

create policy "bookmarks private to owner" on public.bookmarks for select to authenticated using (user_id = auth.uid());
create policy "users save as self" on public.bookmarks for insert to authenticated with check (user_id = auth.uid());
create policy "users unsave as self" on public.bookmarks for delete to authenticated using (user_id = auth.uid());

create policy "follows readable to signed in" on public.follows for select to authenticated using (true);
create policy "users follow as self" on public.follows for insert to authenticated with check (follower_id = auth.uid());
create policy "users unfollow as self" on public.follows for delete to authenticated using (follower_id = auth.uid());

create policy "comments readable" on public.comments for select to anon, authenticated using (true);
create policy "users comment as self" on public.comments for insert to authenticated with check (user_id = auth.uid());
create policy "users delete own comments" on public.comments for delete to authenticated using (user_id = auth.uid());

create policy "live sessions readable" on public.live_streams for select to anon, authenticated using (status = 'live' or user_id = auth.uid());
create policy "users create live session" on public.live_streams for insert to authenticated with check (user_id = auth.uid());
create policy "users manage own live session" on public.live_streams for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users delete own live session" on public.live_streams for delete to authenticated using (user_id = auth.uid());

create policy "events owner readable" on public.video_events for select to authenticated using (user_id = auth.uid());
create policy "users write own events" on public.video_events for insert to authenticated with check (user_id = auth.uid() or user_id is null);

create policy "reporter can create report" on public.reports for insert to authenticated with check (reporter_id = auth.uid());
create policy "reporter reads own reports" on public.reports for select to authenticated using (reporter_id = auth.uid());

-- Storage bucket: public playback is simple for MVP; upload paths must begin with the user's UUID.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('videos', 'videos', true, 104857600, array['video/mp4','video/webm','video/quicktime'])
on conflict (id) do update set public = true, file_size_limit = 104857600,
  allowed_mime_types = array['video/mp4','video/webm','video/quicktime'];

create policy "public videos storage readable" on storage.objects for select to anon, authenticated using (bucket_id = 'videos');
create policy "users upload own video files" on storage.objects for insert to authenticated
  with check (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users update own video files" on storage.objects for update to authenticated
  using (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users delete own video files" on storage.objects for delete to authenticated
  using (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Google sign-in: enable Google provider in Supabase Auth > Providers and configure OAuth credentials.
-- Production note: counters should be maintained by trusted DB functions/triggers, not client updates.
-- Production note: add moderation review, abuse throttling, signed video delivery, and real stream provider tokens.
