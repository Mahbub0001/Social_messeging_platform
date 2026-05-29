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

-- Conversation Members Policies
drop policy if exists "Members can view conversation memberships" on public.conversation_members;
create policy "Members can view conversation memberships" on public.conversation_members
  for select using (
    public.is_conversation_member(conversation_id, auth.uid())
  );

drop policy if exists "Authenticated users can add members" on public.conversation_members;
create policy "Authenticated users can add members" on public.conversation_members
  for insert with check (auth.uid() is not null);

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

-- ========================================================
-- 4. REALTIME REPLICATION CONFIGURATION (Idempotent)
-- ========================================================

-- Enable Realtime replication for all core tables safely
do $$
begin
  -- Enable messages
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

  -- Enable conversation_members
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

  -- Enable profiles
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

  -- Enable conversations
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

  -- Enable friend_requests
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

  -- Enable message_reactions
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
end;
$$;

-- Set replica identity to FULL for logical replication to return all columns on deletes (e.g. message_id on reaction deletion)
alter table public.message_reactions replica identity full;

-- ========================================================
-- 5. STORAGE BUCKET CONFIGURATION (chat-media)
-- ========================================================

-- Insert bucket into storage.buckets if it does not exist
insert into storage.buckets (id, name, public)
values ('chat-media', 'chat-media', true)
on conflict (id) do nothing;

-- Drop existing storage policies if they exist to prevent conflicts
drop policy if exists "Allow public select from chat-media" on storage.objects;
drop policy if exists "Allow authenticated insert to chat-media" on storage.objects;

-- Create policy to allow public access to files in the chat-media bucket
create policy "Allow public select from chat-media" on storage.objects
  for select using (bucket_id = 'chat-media');

-- Create policy to allow authenticated users to upload files to the chat-media bucket
create policy "Allow authenticated insert to chat-media" on storage.objects
  for insert with check (bucket_id = 'chat-media' and auth.role() = 'authenticated');


DROP POLICY IF EXISTS "authenticated can receive broadcasts" ON "realtime"."messages";
CREATE POLICY "authenticated can receive broadcasts"
ON "realtime"."messages"
FOR SELECT TO authenticated
USING (true);