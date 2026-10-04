import { createClient, type User } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function base64url(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----BEGIN[ A-Z_-]+-----/g, "").replace(/-----END[ A-Z_-]+-----/g, "").replace(/[\r\n\s]/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function getGoogleAccessToken(serviceAccount: { client_email: string; private_key: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const claims = base64url(new TextEncoder().encode(JSON.stringify({ iss: serviceAccount.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", exp: now + 3600, iat: now })));
  const key = await crypto.subtle.importKey("pkcs8", pemToArrayBuffer(serviceAccount.private_key), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${claims}`));
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${header}.${claims}.${base64url(signature)}`,
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error("FCM OAuth token request failed");
  return data.access_token;
}

async function authenticate(req: Request, url: string, anonKey: string): Promise<{ user: User; client: ReturnType<typeof createClient> } | null> {
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const client = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data, error } = await client.auth.getUser();
  return error || !data.user ? null : { user: data.user, client };
}

async function isAdmin(adminClient: ReturnType<typeof createClient>, userId: string): Promise<boolean> {
  const { data } = await adminClient.from("profiles").select("role").eq("id", userId).maybeSingle();
  return data?.role === "admin";
}

async function sendToTokens(adminClient: ReturnType<typeof createClient>, tokens: { id: string; token: string }[], message: Record<string, unknown>, serviceAccount: any): Promise<number> {
  if (!tokens.length) return 0;
  const accessToken = await getGoogleAccessToken(serviceAccount);
  const endpoint = `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`;
  const staleIds: string[] = [];
  let sent = 0;
  for (const item of tokens) {
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ message: { token: item.token, ...message } }) });
      const body = await response.json().catch(() => ({}));
      if (response.ok) sent++;
      if (response.status === 404 || body.error?.message?.includes("UNREGISTERED") || body.error?.details?.some((d: any) => d.errorCode === "UNREGISTERED")) staleIds.push(item.id);
    } catch (error) { console.warn("FCM delivery failed:", error); }
  }
  if (staleIds.length) await adminClient.from("user_push_tokens").delete().in("id", staleIds);
  return sent;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: "Push service is not configured" }, 500);

  const authenticated = await authenticate(req, supabaseUrl, anonKey);
  if (!authenticated) return json({ error: "Authentication required" }, 401);
  const adminClient = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json();
    const action = typeof body.action === "string" ? body.action : "chat_message";
    let tokens: { id: string; token: string }[] = [];
    let message: Record<string, unknown>;

    if (action === "chat_message") {
      const conversationId = String(body.conversationId || "");
      if (!conversationId) return json({ error: "conversationId is required" }, 400);
      const { data: membership } = await adminClient.from("conversation_members").select("user_id").eq("conversation_id", conversationId).eq("user_id", authenticated.user.id).maybeSingle();
      if (!membership) return json({ error: "Conversation membership required" }, 403);
      const { data: sender } = await adminClient.from("profiles").select("username, full_name").eq("id", authenticated.user.id).single();
      const { data: members } = await adminClient.from("conversation_members").select("user_id").eq("conversation_id", conversationId).neq("user_id", authenticated.user.id);
      const recipientIds = (members || []).map((row: any) => row.user_id);
      const { data: blocks } = recipientIds.length ? await adminClient.from("blocks").select("blocker_id").in("blocker_id", recipientIds).eq("blocked_id", authenticated.user.id) : { data: [] };
      const blocked = new Set((blocks || []).map((row: any) => row.blocker_id));
      const allowedRecipients = recipientIds.filter((id: string) => !blocked.has(id));
      const { data: pushTokens } = allowedRecipients.length ? await adminClient.from("user_push_tokens").select("id, token").in("user_id", allowedRecipients) : { data: [] };
      tokens = pushTokens || [];
      message = { data: { conversationId, senderId: authenticated.user.id, senderName: sender?.username || sender?.full_name || "Someone", title: sender?.username || "Kotha Barta", body: String(body.content || "Sent a new message"), type: "chat_message" }, android: { priority: "high" } };
    } else if (action === "system_broadcast") {
      if (!(await isAdmin(adminClient, authenticated.user.id))) return json({ error: "Administrator access required" }, 403);
      const { data: pushTokens } = await adminClient.from("user_push_tokens").select("id, token");
      tokens = pushTokens || [];
      message = { notification: { title: String(body.title || "Kotha Barta"), body: String(body.content || "") }, data: { type: "system_announcement" }, android: { priority: "high", notification: { channel_id: "messages", sound: "default" } } };
    } else if (action === "user_push") {
      const data = body.data && typeof body.data === "object" ? body.data : {};
      const type = String((data as any).type || "");
      const targetUserId = String(body.targetUserId || "");
      const adminAllowed = await isAdmin(adminClient, authenticated.user.id);
      let relationshipAllowed = false;
      if (type === "friend_request") {
        const { data: request } = await adminClient.from("friend_requests").select("id").eq("sender_id", authenticated.user.id).eq("receiver_id", targetUserId).eq("status", "pending").maybeSingle();
        relationshipAllowed = Boolean(request);
      } else if (type === "friend_accept") {
        const { data: request } = await adminClient.from("friend_requests").select("id").eq("sender_id", targetUserId).eq("receiver_id", authenticated.user.id).eq("status", "accepted").maybeSingle();
        relationshipAllowed = Boolean(request);
      }
      if (!targetUserId || (!adminAllowed && !relationshipAllowed)) return json({ error: "Not authorized to send this notification" }, 403);
      const { data: pushTokens } = await adminClient.from("user_push_tokens").select("id, token").eq("user_id", targetUserId);
      tokens = pushTokens || [];
      const safeData = Object.fromEntries(Object.entries(data).filter(([key]) => ["senderId", "responderId"].includes(key)));
      message = { notification: { title: String(body.title || "Kotha Barta"), body: String(body.content || "") }, data: { ...safeData, type }, android: { priority: "high", notification: { channel_id: "messages", sound: "default" } } };
    } else if (action === "incoming_call") {
      const conversationId = String(body.conversationId || "");
      const receiverId = String(body.receiverId || "");
      if (!conversationId || !receiverId) return json({ error: "Call conversation and receiver are required" }, 400);
      const { data: callerMember } = await adminClient.from("conversation_members").select("user_id").eq("conversation_id", conversationId).eq("user_id", authenticated.user.id).maybeSingle();
      const { data: receiverMember } = await adminClient.from("conversation_members").select("user_id").eq("conversation_id", conversationId).eq("user_id", receiverId).maybeSingle();
      if (!callerMember || !receiverMember) return json({ error: "Call participants are not conversation members" }, 403);
      const { data: caller } = await adminClient.from("profiles").select("username, full_name").eq("id", authenticated.user.id).single();
      const { data: pushTokens } = await adminClient.from("user_push_tokens").select("id, token").eq("user_id", receiverId);
      tokens = pushTokens || [];
      const callerName = caller?.username || caller?.full_name || "User";
      message = { data: { type: "incoming_call", callId: String(body.callId || ""), callerId: authenticated.user.id, callerName, callerAvatar: String(body.callerAvatar || ""), callType: String(body.callType || "voice"), conversationId }, android: { priority: "high", ttl: "60s" } };
    } else if (action === "call_cancelled") {
      const conversationId = String(body.conversationId || "");
      const receiverId = String(body.receiverId || "");
      if (!receiverId || !conversationId) return json({ error: "Call conversation and receiver are required" }, 400);
      const { data: callerMember } = await adminClient.from("conversation_members").select("user_id").eq("conversation_id", conversationId).eq("user_id", authenticated.user.id).maybeSingle();
      const { data: receiverMember } = await adminClient.from("conversation_members").select("user_id").eq("conversation_id", conversationId).eq("user_id", receiverId).maybeSingle();
      if (!callerMember || !receiverMember) return json({ error: "Call participants are not conversation members" }, 403);
      const { data: pushTokens } = await adminClient.from("user_push_tokens").select("id, token").eq("user_id", receiverId);
      tokens = pushTokens || [];
      message = { data: { type: "call_cancelled", callId: String(body.callId || "") }, android: { priority: "high" } };
    } else {
      return json({ error: "Unsupported push action" }, 400);
    }

    let serviceAccount: any;
    try { serviceAccount = JSON.parse(Deno.env.get("FIREBASE_SERVICE_ACCOUNT") || ""); } catch (_) { return json({ error: "Firebase service account is not configured" }, 500); }
    if (!serviceAccount?.project_id || !serviceAccount?.client_email || !serviceAccount?.private_key) return json({ error: "Firebase service account is invalid" }, 500);
    const sent = await sendToTokens(adminClient, tokens, message, serviceAccount);
    return json({ success: true, sent });
  } catch (error) {
    console.error("Error in send-push-notification:", error);
    return json({ error: "Push dispatch failed" }, 500);
  }
});
