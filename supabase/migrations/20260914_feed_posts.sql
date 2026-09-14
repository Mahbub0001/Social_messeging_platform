-- ========================================================
-- Kotha Barta (কথাবার্তা) — Community Feed Schema
-- Creates public.feed_posts table, indexes, and RLS policies
-- ========================================================

create table if not exists public.feed_posts (
  id text primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  author jsonb not null default '{}'::jsonb,
  content text not null default '',
  media_urls jsonb not null default '[]'::jsonb,
  media_type text not null default 'none', -- 'none' | 'image' | 'video'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  reactions jsonb not null default '{}'::jsonb,
  shares_count integer not null default 0,
  reposted_from jsonb default null,
  comments_count integer not null default 0,
  comments jsonb not null default '[]'::jsonb
);

-- Fast lookup indexes
create index if not exists idx_feed_posts_user_id on public.feed_posts(user_id);
create index if not exists idx_feed_posts_created_at on public.feed_posts(created_at desc);

-- Enable RLS
alter table public.feed_posts enable row level security;

-- RLS Policies
-- 1. Everyone can view feed posts
drop policy if exists "Anyone can read feed posts" on public.feed_posts;
create policy "Anyone can read feed posts" on public.feed_posts
  for select using (true);

-- 2. Authenticated users can insert their own posts
drop policy if exists "Authenticated users can create posts" on public.feed_posts;
create policy "Authenticated users can create posts" on public.feed_posts
  for insert with check (auth.role() = 'authenticated');

-- 3. Authors can update their own posts (or users updating reactions/comments)
drop policy if exists "Users can update posts and reactions" on public.feed_posts;
create policy "Users can update posts and reactions" on public.feed_posts
  for update using (auth.role() = 'authenticated');

-- 4. Authors and admins can delete posts
drop policy if exists "Authors and admins can delete posts" on public.feed_posts;
create policy "Authors and admins can delete posts" on public.feed_posts
  for delete using (
    auth.uid() = user_id or 
    exists (
      select 1 from public.profiles 
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- Enable Supabase Realtime for live feed updates across devices
alter publication supabase_realtime add table public.feed_posts;
