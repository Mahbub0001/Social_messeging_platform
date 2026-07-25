-- Kotha Barta (কথাবার্তা) — Supabase PostgreSQL Schema & RLS Policies
-- Execute this script in your Supabase SQL Editor to set up the database tables and security model.

-- ========================================================
-- 1. TABLES DEFINITIONS
-- ========================================================

-- Profiles (linked to auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  avatar_url text,
  bio text default 'Hey there! I am new here.',
  is_online boolean default false,
  last_seen timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Conversations
create table if not exists public.conversations (
  id uuid default gen_random_uuid() primary key,
  name text, -- NULL for DMs, filled for group chats
  avatar_url text,
  is_group boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Conversation Members
create table if not exists public.conversation_members (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text default 'member' not null, -- 'admin', 'member'
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (conversation_id, user_id)
);

-- Messages
create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  content text,
  media_url text,
  media_type text check (media_type in ('image', 'file', 'audio', 'call')),
  reply_to_message_id uuid references public.messages(id) on delete set null,
  is_edited boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Message Reactions
create table if not exists public.message_reactions (
  id uuid default gen_random_uuid() primary key,
  message_id uuid references public.messages(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  emoji text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (message_id, user_id, emoji)
);

-- Friend Requests
create table if not exists public.friend_requests (
  id uuid default gen_random_uuid() primary key,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  receiver_id uuid references public.profiles(id) on delete cascade not null,
  status text check (status in ('pending', 'accepted', 'declined')) default 'pending' not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (sender_id, receiver_id)
);

-- Blocks
create table if not exists public.blocks (
  id uuid default gen_random_uuid() primary key,
  blocker_id uuid references public.profiles(id) on delete cascade not null,
  blocked_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (blocker_id, blocked_id)
);

-- Stories (24-Hour Ephemeral Content)
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

-- ========================================================
-- 2. AUTOMATIC PROFILE SYNC TRIGGER
-- ========================================================

-- Helper function to generate a unique username by appending random digits if taken
create or replace function public.generate_unique_username(base_username text)
returns text as $$
declare
  candidate_username text;
begin
  candidate_username := base_username;
  while exists (select 1 from public.profiles where username = candidate_username) loop
    candidate_username := base_username || floor(random() * 10000)::text;
  end loop;
  return candidate_username;
end;
$$ language plpgsql;

-- Trigger to automatically create a profile in public.profiles when a new user signs up in auth.users
create or replace function public.handle_new_user()
returns trigger as $$
declare
  base_username text;
  final_username text;
begin
  -- Use username from metadata, or fall back to the email prefix before @
  base_username := coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1));
  if base_username is null or base_username = '' then
    base_username := 'user_' || floor(random() * 100000)::text;
  end if;
  
  -- Generate unique username if the base one is already taken
  final_username := public.generate_unique_username(base_username);

  insert into public.profiles (id, username, avatar_url, bio)
  values (
    new.id,
    final_username,
    coalesce(new.raw_user_meta_data->>'avatar_url', 'https://api.dicebear.com/7.x/avataaars/svg?seed=' || final_username),
    'Hey there! I am new here.'
  );
  return new;
end;
$$ language plpgsql security definer;

-- Recreate trigger safety
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ========================================================
-- 3. HELPER FUNCTIONS & ROW LEVEL SECURITY (RLS)
-- ========================================================

-- Helper function to check conversation membership without RLS recursion
create or replace function public.is_conversation_member(conv_id uuid, u_id uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.conversation_members
    where conversation_id = conv_id
    and user_id = u_id
  );
end;
$$ language plpgsql security definer;

-- Helper function to check if a conversation has no members yet (used to allow RLS bypass during insert)
create or replace function public.has_no_members(conv_id uuid)
returns boolean as $$
begin
  return not exists (
    select 1 from public.conversation_members
    where conversation_id = conv_id
  );
end;
$$ language plpgsql security definer;

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_reactions enable row level security;
alter table public.friend_requests enable row level security;
alter table public.blocks enable row level security;
alter table public.stories enable row level security;
alter table public.story_views enable row level security;

-- Profiles Policies
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
create policy "Public profiles are viewable by everyone" on public.profiles
  for select using (true);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile" on public.profiles
  for update using (auth.uid() = id);

-- Conversations Policies
drop policy if exists "Members can view conversations" on public.conversations;
create policy "Members can view conversations" on public.conversations
  for select using (
    public.is_conversation_member(id, auth.uid())
    or
    public.has_no_members(id)
  );

drop policy if exists "Authenticated users can create conversations" on public.conversations;
create policy "Authenticated users can create conversations" on public.conversations
  for insert with check (auth.uid() is not null);

drop policy if exists "Group admins can update conversations" on public.conversations;
create policy "Group admins can update conversations" on public.conversations
  for update using (
    exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = conversations.id
      and cm.user_id = auth.uid()
      and cm.role = 'admin'
    )
  );

-- Conversation Members Policies
drop policy if exists "Members can view conversation memberships" on public.conversation_members;
create policy "Members can view conversation memberships" on public.conversation_members
  for select using (
    public.is_conversation_member(conversation_id, auth.uid())
  );

drop policy if exists "Group admins can add members" on public.conversation_members;
create policy "Group admins can add members" on public.conversation_members
  for insert with check (
    exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = conversation_members.conversation_id
      and cm.user_id = auth.uid()
      and cm.role = 'admin'
    )
    or
    not exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = conversation_members.conversation_id
    )
  );

drop policy if exists "Members can leave or admins can remove members" on public.conversation_members;
create policy "Members can leave or admins can remove members" on public.conversation_members
  for delete using (
    auth.uid() = user_id
    or
    exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = conversation_members.conversation_id
      and cm.user_id = auth.uid()
      and cm.role = 'admin'
    )
  );

drop policy if exists "Group admins can update conversation_members" on public.conversation_members;
create policy "Group admins can update conversation_members" on public.conversation_members
  for update using (
    exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = conversation_members.conversation_id
      and cm.user_id = auth.uid()
      and cm.role = 'admin'
    )
  );

-- Messages Policies
drop policy if exists "Members can view messages" on public.messages;
create policy "Members can view messages" on public.messages
  for select using (
    public.is_conversation_member(conversation_id, auth.uid())
  );

drop policy if exists "Members can send messages" on public.messages;
create policy "Members can send messages" on public.messages
  for insert with check (
    public.is_conversation_member(conversation_id, auth.uid())
    and auth.uid() = sender_id
  );

drop policy if exists "Senders can edit their own messages" on public.messages;
create policy "Senders can edit their own messages" on public.messages
  for update using (auth.uid() = sender_id);

drop policy if exists "Restrict messages from blocked users" on public.messages
  AS RESTRICTIVE for select using (
    not exists (
      select 1 from public.blocks
      where blocker_id = auth.uid() and blocked_id = sender_id
    )
  );

drop policy if exists "Users cannot send messages to blockers" on public.messages;
create policy "Users cannot send messages to blockers" on public.messages
  AS RESTRICTIVE for insert with check (
    not exists (
      select 1 from public.blocks b
      where b.blocker_id = (
          select cm.user_id from public.conversation_members cm
          where cm.conversation_id = messages.conversation_id and cm.user_id != auth.uid()
          limit 1
      )
      and b.blocked_id = auth.uid()
    )
  );

-- Message Reactions Policies
drop policy if exists "Members can view message reactions" on public.message_reactions;
create policy "Members can view message reactions" on public.message_reactions
  for select using (
    exists (
      select 1 from public.messages msg
      where msg.id = message_id
      and public.is_conversation_member(msg.conversation_id, auth.uid())
    )
  );

drop policy if exists "Members can react to messages" on public.message_reactions;
create policy "Members can react to messages" on public.message_reactions
  for insert with check (
    exists (
      select 1 from public.messages msg
      where msg.id = message_id
      and public.is_conversation_member(msg.conversation_id, auth.uid())
    )
    and auth.uid() = user_id
  );

drop policy if exists "Users can remove their own reactions" on public.message_reactions;
create policy "Users can remove their own reactions" on public.message_reactions
  for delete using (auth.uid() = user_id);

-- Friend Requests Policies
drop policy if exists "Users can view their own friend requests" on public.friend_requests;
create policy "Users can view their own friend requests" on public.friend_requests
  for select using (auth.uid() = sender_id or auth.uid() = receiver_id);

drop policy if exists "Users can send friend requests" on public.friend_requests;
create policy "Users can send friend requests" on public.friend_requests
  for insert with check (auth.uid() = sender_id);

drop policy if exists "Users can update their received friend requests" on public.friend_requests;
create policy "Users can update their received friend requests" on public.friend_requests
  for update using (auth.uid() = receiver_id);

drop policy if exists "Users can delete their friend requests" on public.friend_requests;
create policy "Users can delete their friend requests" on public.friend_requests
  for delete using (auth.uid() = sender_id or auth.uid() = receiver_id);

-- Blocks Policies
drop policy if exists "Users can view their own blocks" on public.blocks;
create policy "Users can view their own blocks" on public.blocks
  for select using (auth.uid() = blocker_id or auth.uid() = blocked_id);

drop policy if exists "Users can create blocks" on public.blocks;
create policy "Users can create blocks" on public.blocks
  for insert with check (auth.uid() = blocker_id);

drop policy if exists "Users can delete their own blocks" on public.blocks;
create policy "Users can delete their own blocks" on public.blocks
  for delete using (auth.uid() = blocker_id);

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
drop policy if exists "Users can view story_views for stories they own" on public.story_views;
create policy "Users can view story_views for stories they own" on public.story_views
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

-- ========================================================
-- 4. REALTIME REPLICATION CONFIGURATION (Idempotent)
-- ========================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_rel pr
    join pg_class c on pr.prrelid = c.oid
    join pg_namespace n on c.relnamespace = n.oid
    where pr.prpubid = (select oid from pg_publication where pubname = 'supabase_realtime')
      and n.nspname = 'public'
      and c.relname = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;

  if not exists (
    select 1 from pg_publication_rel pr
    join pg_class c on pr.prrelid = c.oid
    join pg_namespace n on c.relnamespace = n.oid
    where pr.prpubid = (select oid from pg_publication where pubname = 'supabase_realtime')
      and n.nspname = 'public'
      and c.relname = 'conversation_members'
  ) then
    alter publication supabase_realtime add table public.conversation_members;
  end if;

  if not exists (
    select 1 from pg_publication_rel pr
    join pg_class c on pr.prrelid = c.oid
    join pg_namespace n on c.relnamespace = n.oid
    where pr.prpubid = (select oid from pg_publication where pubname = 'supabase_realtime')
      and n.nspname = 'public'
      and c.relname = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;

  if not exists (
    select 1 from pg_publication_rel pr
    join pg_class c on pr.prrelid = c.oid
    join pg_namespace n on c.relnamespace = n.oid
    where pr.prpubid = (select oid from pg_publication where pubname = 'supabase_realtime')
      and n.nspname = 'public'
      and c.relname = 'conversations'
  ) then
    alter publication supabase_realtime add table public.conversations;
  end if;

  if not exists (
    select 1 from pg_publication_rel pr
    join pg_class c on pr.prrelid = c.oid
    join pg_namespace n on c.relnamespace = n.oid
    where pr.prpubid = (select oid from pg_publication where pubname = 'supabase_realtime')
      and n.nspname = 'public'
      and c.relname = 'friend_requests'
  ) then
    alter publication supabase_realtime add table public.friend_requests;
  end if;

  if not exists (
    select 1 from pg_publication_rel pr
    join pg_class c on pr.prrelid = c.oid
    join pg_namespace n on c.relnamespace = n.oid
    where pr.prpubid = (select oid from pg_publication where pubname = 'supabase_realtime')
      and n.nspname = 'public'
      and c.relname = 'message_reactions'
  ) then
    alter publication supabase_realtime add table public.message_reactions;
  end if;

  if not exists (
    select 1 from pg_publication_rel pr
    join pg_class c on pr.prrelid = c.oid
    join pg_namespace n on c.relnamespace = n.oid
    where pr.prpubid = (select oid from pg_publication where pubname = 'supabase_realtime')
      and n.nspname = 'public'
      and c.relname = 'blocks'
  ) then
    alter publication supabase_realtime add table public.blocks;
  end if;

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

-- Set replica identity to FULL for logical replication
alter table public.message_reactions replica identity full;

-- ========================================================
-- 5. STORAGE BUCKET CONFIGURATION (chat-media)
-- ========================================================

insert into storage.buckets (id, name, public)
values ('chat-media', 'chat-media', true)
on conflict (id) do nothing;

drop policy if exists "Allow public select from chat-media" on storage.objects;
drop policy if exists "Allow authenticated insert to chat-media" on storage.objects;

create policy "Allow public select from chat-media" on storage.objects
  for select using (bucket_id = 'chat-media');

create policy "Allow authenticated insert to chat-media" on storage.objects
  for insert with check (bucket_id = 'chat-media' and auth.role() = 'authenticated');

drop policy if exists "authenticated can receive broadcasts" on "realtime"."messages";
create policy "authenticated can receive broadcasts"
on "realtime"."messages"
for select to authenticated
using (true);

-- ========================================================
-- 6. PERFORMANCE INDEXES
-- ========================================================

create index if not exists idx_stories_user_id on public.stories(user_id);
create index if not exists idx_stories_expires_at on public.stories(expires_at);
create index if not exists idx_story_views_story_id on public.story_views(story_id);
create index if not exists idx_story_views_viewer_id on public.story_views(viewer_id);
