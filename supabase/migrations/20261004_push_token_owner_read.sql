-- An upsert needs SELECT visibility on its existing row. Keep token reads
-- scoped to the owning user; the server push function uses service role.
CREATE POLICY "Users can view own push tokens"
  ON public.user_push_tokens FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own push tokens" ON public.user_push_tokens;
CREATE POLICY "Users can update own push tokens"
  ON public.user_push_tokens FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
