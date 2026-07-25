-- ========================================================
-- STORIES FEATURE (24-Hour Visibility)
-- ========================================================

-- Stories Table
create table if not exists public.stories (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  media_url text not null,
  media_type text check (media_type in ('image', 'video')) not null,
  caption text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  expires_at timestamp with time zone not null,
  unique(id)
);

-- Story Views (Track who viewed which story)
create table if not exists public.story_views (
  id uuid default gen_random_uuid() primary key,
  story_id uuid references public.stories(id) on delete cascade not null,
  viewer_id uuid references public.profiles(id) on delete cascade not null,
  viewed_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (story_id, viewer_id)
);

-- Enable RLS
alter table public.stories enable row level security;
alter table public.story_views enable row level security;

-- Stories Policies
drop policy if exists "Users can view non-expired stories from all users" on public.stories;
create policy "Users can view non-expired stories from all users" on public.stories
  for select using (
    expires_at > timezone('utc'::text, now())
  );

drop policy if exists "Users can create their own stories" on public.stories;
create policy "Users can create their own stories" on public.stories
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own stories" on public.stories;
create policy "Users can delete their own stories" on public.stories
  for delete using (auth.uid() = user_id);

-- Story Views Policies
drop policy if exists "Users can view story_views for non-expired stories they own" on public.story_views;
create policy "Users can view story_views for non-expired stories they own" on public.story_views
  for select using (
    exists (
      select 1 from public.stories s
      where s.id = story_id
      and s.user_id = auth.uid()
    )
  );

drop policy if exists "Users can record their own story view" on public.story_views;
create policy "Users can record their own story view" on public.story_views
  for insert with check (
    auth.uid() = viewer_id
    and exists (
      select 1 from public.stories s
      where s.id = story_id
      and s.expires_at > timezone('utc'::text, now())
    )
  );

-- Enable Realtime replication for stories
do $$
begin
  if not exists (
    select 1 from pg_publication_rel pr
    join pg_class c on pr.prrelid = c.oid
    join pg_namespace n on c.relnamespace = n.oid
    where pr.prpubid = (select oid from pg_publication where pubname = 'supabase_realtime')
      and n.nspname = 'public'
      and c.relname = 'stories'
  ) then
    alter publication supabase_realtime add table public.stories;
  end if;

  if not exists (
    select 1 from pg_publication_rel pr
    join pg_class c on pr.prrelid = c.oid
    join pg_namespace n on c.relnamespace = n.oid
    where pr.prpubid = (select oid from pg_publication where pubname = 'supabase_realtime')
      and n.nspname = 'public'
      and c.relname = 'story_views'
  ) then
    alter publication supabase_realtime add table public.story_views;
  end if;
end;
$$;

-- Create indexes for performance
create index if not exists idx_stories_user_id on public.stories(user_id);
create index if not exists idx_stories_expires_at on public.stories(expires_at);
create index if not exists idx_story_views_story_id on public.story_views(story_id);
create index if not exists idx_story_views_viewer_id on public.story_views(viewer_id);
