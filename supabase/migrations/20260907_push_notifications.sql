-- ========================================================
-- Kotha Barta (কথাবার্তা) — Push Notifications Schema
-- Creates user_push_tokens table and security policies
-- ========================================================

create table if not exists public.user_push_tokens (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  token text not null,
  platform text default 'android' not null,
  device_info jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, token)
);

-- Fast lookup indexes
create index if not exists idx_user_push_tokens_user_id on public.user_push_tokens(user_id);
create index if not exists idx_user_push_tokens_token on public.user_push_tokens(token);

-- Enable RLS
alter table public.user_push_tokens enable row level security;

-- RLS Policies
drop policy if exists "Users can view own push tokens" on public.user_push_tokens;
drop policy if exists "Users can view push tokens to send notifications" on public.user_push_tokens;
create policy "Users can view push tokens to send notifications" on public.user_push_tokens
  for select using (auth.role() = 'authenticated');

drop policy if exists "Users can insert own push tokens" on public.user_push_tokens;
create policy "Users can insert own push tokens" on public.user_push_tokens
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own push tokens" on public.user_push_tokens;
create policy "Users can update own push tokens" on public.user_push_tokens
  for update using (auth.uid() = user_id);

drop policy if exists "Users can delete own push tokens" on public.user_push_tokens;
create policy "Users can delete own push tokens" on public.user_push_tokens
  for delete using (auth.uid() = user_id);
