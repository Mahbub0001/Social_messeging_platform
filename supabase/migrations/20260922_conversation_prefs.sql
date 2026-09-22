-- User Conversation Preferences: Mute, Archive, Delete
-- Migration: 20260922_conversation_prefs.sql

CREATE TABLE IF NOT EXISTS public.user_conversation_prefs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  is_muted boolean DEFAULT false NOT NULL,
  mute_until timestamp with time zone,
  mute_type text CHECK (mute_type IN ('all', 'messages_only')) DEFAULT 'all' NOT NULL,
  is_archived boolean DEFAULT false NOT NULL,
  archived_at timestamp with time zone,
  is_deleted boolean DEFAULT false NOT NULL,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, conversation_id)
);

CREATE INDEX IF NOT EXISTS idx_user_conv_prefs_user_id ON public.user_conversation_prefs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_conv_prefs_conv_id ON public.user_conversation_prefs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_user_conv_prefs_archived ON public.user_conversation_prefs(user_id, is_archived);

ALTER TABLE public.user_conversation_prefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own conversation preferences" ON public.user_conversation_prefs;
CREATE POLICY "Users can view own conversation preferences" ON public.user_conversation_prefs
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own conversation preferences" ON public.user_conversation_prefs;
CREATE POLICY "Users can insert own conversation preferences" ON public.user_conversation_prefs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own conversation preferences" ON public.user_conversation_prefs;
CREATE POLICY "Users can update own conversation preferences" ON public.user_conversation_prefs
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own conversation preferences" ON public.user_conversation_prefs;
CREATE POLICY "Users can delete own conversation preferences" ON public.user_conversation_prefs
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
