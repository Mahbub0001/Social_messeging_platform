import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Helper to base64url encode
function base64url(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Convert PEM PKCS#8 private key string to ArrayBuffer
function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN[ A-Z_-]+-----/g, "")
    .replace(/-----END[ A-Z_-]+-----/g, "")
    .replace(/[\r\n\s]/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Generate Google OAuth2 access token for FCM v1 using Service Account credentials
async function getGoogleAccessToken(serviceAccount: {
  client_email: string;
  private_key: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = base64url(new TextEncoder().encode(JSON.stringify(header)));
  const encodedClaims = base64url(new TextEncoder().encode(JSON.stringify(claims)));
  const dataToSign = new TextEncoder().encode(`${encodedHeader}.${encodedClaims}`);

  const keyBuffer = pemToArrayBuffer(serviceAccount.private_key);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    dataToSign
  );

  const jwt = `${encodedHeader}.${encodedClaims}.${base64url(signature)}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const resData = await response.json();
  if (!response.ok || !resData.access_token) {
    throw new Error(`Failed to get Google Access Token: ${JSON.stringify(resData)}`);
  }

  return resData.access_token;
}

Deno.serve(async (req: Request) => {
  // CORS headers
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const body = await req.json();
    const { conversationId, senderId, senderName, content, mediaType } = body;

    if (!conversationId || !senderId) {
      return new Response(
        JSON.stringify({ error: "conversationId and senderId are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Get recipients in the conversation (excluding the sender)
    const { data: members, error: memError } = await supabase
      .from("conversation_members")
      .select("user_id")
      .eq("conversation_id", conversationId)
      .neq("user_id", senderId);

    if (memError || !members || members.length === 0) {
      return new Response(
        JSON.stringify({ message: "No recipients found for push notification" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const recipientUserIds = members.map((m) => m.user_id);

    // 2. Filter out anyone who has blocked the sender
    const { data: blocks } = await supabase
      .from("blocks")
      .select("blocker_id")
      .in("blocker_id", recipientUserIds)
      .eq("blocked_id", senderId);

    const blockerIds = new Set((blocks || []).map((b) => b.blocker_id));
    const activeRecipientIds = recipientUserIds.filter((id) => !blockerIds.has(id));

    if (activeRecipientIds.length === 0) {
      return new Response(
        JSON.stringify({ message: "All recipients have blocked the sender" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // 3. Fetch active push tokens for these recipients
    const { data: pushTokens, error: tokenError } = await supabase
      .from("user_push_tokens")
      .select("id, user_id, token")
      .in("user_id", activeRecipientIds);

    if (tokenError || !pushTokens || pushTokens.length === 0) {
      return new Response(
        JSON.stringify({ message: "No registered device push tokens for recipients" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // 4. Load Firebase Service Account
    let serviceAccount: any = null;
    const envServiceAccount = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
    if (envServiceAccount) {
      try {
        serviceAccount = JSON.parse(envServiceAccount);
      } catch {
        serviceAccount = null;
      }
    }

    if (!serviceAccount) {
      return new Response(
        JSON.stringify({
          error: "FIREBASE_SERVICE_ACCOUNT environment variable is not configured on Supabase.",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // 5. Get Google OAuth2 Token
    const accessToken = await getGoogleAccessToken(serviceAccount);
    const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`;

    // 6. Build notification message
    const notificationTitle = senderName || "Kotha Barta";
    const notificationBody =
      content && content.trim() !== ""
        ? content
        : mediaType
        ? `Sent a ${mediaType}`
        : "Sent a new message";

    const staleTokenIds: string[] = [];
    const results = [];

    // 7. Send FCM push to each device token
    for (const item of pushTokens) {
      const payload = {
        message: {
          token: item.token,
          notification: {
            title: notificationTitle,
            body: notificationBody,
          },
          data: {
            conversationId: String(conversationId),
            senderId: String(senderId),
            type: "chat_message",
          },
          android: {
            priority: "high",
            notification: {
              channel_id: "messages",
              sound: "default",
              click_action: "FCM_PLUGIN_ACTIVITY",
            },
          },
        },
      };

      const fcmRes = await fetch(fcmEndpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const resBody = await fcmRes.json();
      results.push({ token: item.token, status: fcmRes.status, response: resBody });

      // If token is invalid or unregistered, queue for cleanup
      if (
        fcmRes.status === 404 ||
        (resBody.error &&
          (resBody.error.message?.includes("UNREGISTERED") ||
            resBody.error.details?.some((d: any) => d.errorCode === "UNREGISTERED")))
      ) {
        staleTokenIds.push(item.id);
      }
    }

    // 8. Clean up stale tokens asynchronously
    if (staleTokenIds.length > 0) {
      await supabase.from("user_push_tokens").delete().in("id", staleTokenIds);
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: results.length,
        results,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error: any) {
    console.error("Error in send-push-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});
