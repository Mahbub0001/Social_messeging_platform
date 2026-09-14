-- ========================================================
-- Kotha Barta (কথাবার্তা) — Admin Panel Schema & RLS
-- Migration: 20260914_admin_panel.sql
-- ========================================================

-- 1. Extend profiles table with administrative and ban columns
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS role text DEFAULT 'user' CHECK (role IN ('admin', 'moderator', 'user')),
  ADD COLUMN IF NOT EXISTS is_banned boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS banned_reason text,
  ADD COLUMN IF NOT EXISTS banned_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_is_banned ON public.profiles(is_banned);

-- 2. System Announcements Table
CREATE TABLE IF NOT EXISTS public.system_announcements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  title text NOT NULL,
  content text NOT NULL,
  type text CHECK (type IN ('info', 'warning', 'critical', 'update')) DEFAULT 'info' NOT NULL,
  send_push boolean DEFAULT false NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON public.system_announcements(created_at DESC);

-- 3. Content Reports Table
CREATE TABLE IF NOT EXISTS public.content_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  target_type text CHECK (target_type IN ('story', 'message', 'user')) NOT NULL,
  target_id uuid NOT NULL,
  reason text NOT NULL,
  status text CHECK (status IN ('pending', 'resolved', 'dismissed')) DEFAULT 'pending' NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_content_reports_status ON public.content_reports(status);

-- 4. Admin Verification Helper Function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Enable Row Level Security
ALTER TABLE public.system_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

-- Announcements RLS
DROP POLICY IF EXISTS "Anyone authenticated can view active announcements" ON public.system_announcements;
CREATE POLICY "Anyone authenticated can view active announcements" 
  ON public.system_announcements FOR SELECT 
  TO authenticated 
  USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "Admins can insert announcements" ON public.system_announcements;
CREATE POLICY "Admins can insert announcements" 
  ON public.system_announcements FOR INSERT 
  TO authenticated 
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update announcements" ON public.system_announcements;
CREATE POLICY "Admins can update announcements" 
  ON public.system_announcements FOR UPDATE 
  TO authenticated 
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete announcements" ON public.system_announcements;
CREATE POLICY "Admins can delete announcements" 
  ON public.system_announcements FOR DELETE 
  TO authenticated 
  USING (public.is_admin());

-- Reports RLS
DROP POLICY IF EXISTS "Users can create content reports" ON public.content_reports;
CREATE POLICY "Users can create content reports"
  ON public.content_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Admins can view and manage reports" ON public.content_reports;
CREATE POLICY "Admins can view and manage reports"
  ON public.content_reports FOR ALL
  TO authenticated
  USING (public.is_admin());

-- Stories RLS: Admins can delete any story
DROP POLICY IF EXISTS "Admins can delete any story" ON public.stories;
CREATE POLICY "Admins can delete any story" 
  ON public.stories FOR DELETE 
  TO authenticated 
  USING (public.is_admin() OR auth.uid() = user_id);

-- Messages RLS: Prevent banned users from sending messages
DROP POLICY IF EXISTS "Active users can insert messages" ON public.messages;
CREATE POLICY "Active users can insert messages" 
  ON public.messages FOR INSERT 
  TO authenticated 
  WITH CHECK (
    auth.uid() = sender_id AND 
    NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_banned = true)
  );

-- Profiles RLS: Admins can update roles and ban flags
DROP POLICY IF EXISTS "Admins can update user roles and ban status" ON public.profiles;
CREATE POLICY "Admins can update user roles and ban status" 
  ON public.profiles FOR UPDATE 
  TO authenticated 
  USING (public.is_admin() OR auth.uid() = id);

-- Ensure mahbub user is promoted to admin if exists
UPDATE public.profiles
SET role = 'admin'
WHERE lower(username) = 'mahbub';
