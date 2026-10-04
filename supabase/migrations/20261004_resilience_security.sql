-- Security and resilience hardening. Apply after all existing migrations.

-- Never allow a user to promote themselves or change moderation fields.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

DROP POLICY IF EXISTS "Admins can update user roles and ban status" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Administrators can update profiles"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.update_my_profile(
  p_username text DEFAULT NULL,
  p_bio text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE updated_profile public.profiles;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  UPDATE public.profiles
  SET username = COALESCE(p_username, username),
      bio = COALESCE(p_bio, bio),
      avatar_url = COALESCE(p_avatar_url, avatar_url),
      updated_at = timezone('utc'::text, now())
  WHERE id = auth.uid()
  RETURNING * INTO updated_profile;
  IF updated_profile.id IS NULL THEN RAISE EXCEPTION 'Profile not found'; END IF;
  RETURN updated_profile;
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_my_profile(text, text, text) TO authenticated;

-- Device tokens are capabilities; only the server-side push worker may read them.
DROP POLICY IF EXISTS "Users can view push tokens to send notifications" ON public.user_push_tokens;
DROP POLICY IF EXISTS "Users can view own push tokens" ON public.user_push_tokens;

-- Feed creation and updates must be owner-bound. Interaction writes are moved to
-- narrow RPCs below so a user cannot rewrite another user's post body/author.
DROP POLICY IF EXISTS "Authenticated users can create posts" ON public.feed_posts;
DROP POLICY IF EXISTS "Users can update posts and reactions" ON public.feed_posts;
CREATE POLICY "Users can create their own posts"
  ON public.feed_posts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authors can update their own posts"
  ON public.feed_posts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_post_reactions(p_post_id text, p_reactions jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.feed_posts WHERE id = p_post_id) THEN RETURN false; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_each(COALESCE(p_reactions, '{}'::jsonb)) AS incoming(kind, entries)
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(incoming.entries, '[]'::jsonb)) AS item(entry)
    WHERE (item.entry->>'userId') IS DISTINCT FROM auth.uid()::text
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE((SELECT reactions->incoming.kind FROM public.feed_posts WHERE id = p_post_id), '[]'::jsonb)) old_item(old_entry)
        WHERE old_item.old_entry = item.entry
      )
  ) THEN RETURN false; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_each(COALESCE((SELECT reactions FROM public.feed_posts WHERE id = p_post_id), '{}'::jsonb)) AS existing(kind, entries)
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(existing.entries, '[]'::jsonb)) AS item(entry)
    WHERE (item.entry->>'userId') IS DISTINCT FROM auth.uid()::text
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(p_reactions->existing.kind, '[]'::jsonb)) incoming_item(incoming_entry)
        WHERE incoming_item.incoming_entry = item.entry
      )
  ) THEN RETURN false; END IF;
  UPDATE public.feed_posts SET reactions = COALESCE(p_reactions, '{}'::jsonb) WHERE id = p_post_id;
  RETURN true;
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_post_reactions(text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_post_comments(p_post_id text, p_comments jsonb, p_comments_count integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR p_comments_count < 0 OR NOT EXISTS (SELECT 1 FROM public.feed_posts WHERE id = p_post_id) THEN RETURN false; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE((SELECT comments FROM public.feed_posts WHERE id = p_post_id), '[]'::jsonb)) old_item(old_entry)
    WHERE (old_item.old_entry->>'userId') IS DISTINCT FROM auth.uid()::text
      AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(p_comments, '[]'::jsonb)) new_item(new_entry) WHERE new_item.new_entry = old_item.old_entry)
  ) THEN RETURN false; END IF;
  UPDATE public.feed_posts SET comments = COALESCE(p_comments, '[]'::jsonb), comments_count = p_comments_count WHERE id = p_post_id;
  RETURN true;
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_post_comments(text, jsonb, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_repost(p_original_id text, p_repost jsonb)
RETURNS public.feed_posts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE item public.feed_posts;
DECLARE original public.feed_posts;
DECLARE profile public.profiles;
BEGIN
  IF auth.uid() IS NULL OR p_repost->>'user_id' <> auth.uid()::text THEN
    RAISE EXCEPTION 'Invalid repost owner';
  END IF;
  SELECT * INTO original FROM public.feed_posts WHERE id = p_original_id;
  IF original.id IS NULL THEN
    RAISE EXCEPTION 'Original post not found';
  END IF;
  SELECT * INTO profile FROM public.profiles WHERE id = auth.uid();
  UPDATE public.feed_posts SET shares_count = COALESCE(shares_count, 0) + 1 WHERE id = p_original_id;
  INSERT INTO public.feed_posts(id, user_id, author, content, media_urls, media_type, created_at, reactions, shares_count, reposted_from, comments_count, comments)
  VALUES (
    p_repost->>'id', auth.uid(), jsonb_build_object('id', profile.id, 'username', profile.username, 'avatar_url', profile.avatar_url, 'bio', profile.bio, 'role', profile.role), COALESCE(p_repost->>'content', ''),
    COALESCE(p_repost->'media_urls', '[]'::jsonb), COALESCE(p_repost->>'media_type', 'none'),
    COALESCE((p_repost->>'created_at')::timestamptz, timezone('utc'::text, now())), '{}'::jsonb, 0,
    COALESCE(original.reposted_from, to_jsonb(original)), 0, '[]'::jsonb
  ) RETURNING * INTO item;
  RETURN item;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_repost(text, jsonb) TO authenticated;

-- In-app notifications are created by administrators or validated relationship workflows.
DROP POLICY IF EXISTS "Admins or system can insert user notifications" ON public.user_notifications;
CREATE POLICY "Administrators can insert notifications"
  ON public.user_notifications FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.create_user_notification(
  p_user_id uuid, p_title text, p_content text, p_type text
)
RETURNS public.user_notifications
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE item public.user_notifications;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_type NOT IN ('friend_request', 'friend_accept') THEN RAISE EXCEPTION 'Unsupported notification type'; END IF;
  IF NOT public.is_admin() THEN
    IF p_type = 'friend_request' AND NOT EXISTS (
      SELECT 1 FROM public.friend_requests WHERE sender_id = auth.uid() AND receiver_id = p_user_id AND status = 'pending'
    ) THEN RAISE EXCEPTION 'Notification relationship is not valid'; END IF;
    IF p_type = 'friend_accept' AND NOT EXISTS (
      SELECT 1 FROM public.friend_requests WHERE sender_id = p_user_id AND receiver_id = auth.uid() AND status = 'accepted'
    ) THEN RAISE EXCEPTION 'Notification relationship is not valid'; END IF;
  END IF;
  INSERT INTO public.user_notifications(user_id, title, content, type)
  VALUES (p_user_id, p_title, p_content, p_type)
  RETURNING * INTO item;
  RETURN item;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_user_notification(uuid, text, text, text) TO authenticated;
