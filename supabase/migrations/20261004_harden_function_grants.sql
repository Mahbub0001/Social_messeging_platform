-- Do not expose application RPCs to anonymous callers.
REVOKE EXECUTE ON FUNCTION public.create_repost(text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_user_notification(uuid, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_my_profile(text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_post_comments(text, jsonb, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_post_reactions(text, jsonb) FROM anon;
