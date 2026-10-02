-- Add reaction column to story_views if not exists
ALTER TABLE public.story_views ADD COLUMN IF NOT EXISTS reaction text;

-- Allow users to view their own story views
DROP POLICY IF EXISTS "Users can view their own story views" ON public.story_views;
CREATE POLICY "Users can view their own story views" ON public.story_views
  FOR SELECT USING (auth.uid() = viewer_id);

-- Allow users to update their own story views (e.g. to add or update reaction)
DROP POLICY IF EXISTS "Users can update their own story views" ON public.story_views;
CREATE POLICY "Users can update their own story views" ON public.story_views
  FOR UPDATE USING (auth.uid() = viewer_id) WITH CHECK (auth.uid() = viewer_id);
