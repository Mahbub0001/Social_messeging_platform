package com.nibir.kothabarta;

import android.annotation.SuppressLint;
import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import androidx.core.app.RemoteInput;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

public class DirectReplyReceiver extends BroadcastReceiver {

    private static final String TAG = "DirectReplyReceiver";

    // Supabase credentials for fallback background dispatch when app process is closed
    private static final String SUPABASE_URL = "https://ngtyysbsfvowtbrqamti.supabase.co";
    private static final String SUPABASE_ANON_KEY =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndHl5c2JzZnZvd3RicnFhbXRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4ODAxMTEsImV4cCI6MjA5NTQ1NjExMX0.NNRgmbOH0YdzemvnfaLV14duA05pqaAu99Wz1JMVFdM";

    @Override
    @SuppressLint("MissingPermission")
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;

        Bundle remoteInput = RemoteInput.getResultsFromIntent(intent);
        if (remoteInput == null) return;

        CharSequence replySeq = remoteInput.getCharSequence(KothaBartaMessagingService.KEY_TEXT_REPLY);
        if (replySeq == null) return;

        final String replyText = replySeq.toString().trim();
        if (replyText.isEmpty()) return;

        final String conversationId = intent.getStringExtra(KothaBartaMessagingService.EXTRA_CONVERSATION_ID);
        final String senderId = intent.getStringExtra(KothaBartaMessagingService.EXTRA_SENDER_ID);
        final String senderName = intent.getStringExtra(KothaBartaMessagingService.EXTRA_SENDER_NAME);
        final int notificationId = intent.getIntExtra(KothaBartaMessagingService.EXTRA_NOTIFICATION_ID, 0);

        Log.d(TAG, "Direct reply received for conversation: " + conversationId + ", text: " + replyText);

        // 1. Immediately update the notification to show "✓ উত্তর পাঠানো হয়েছে" (Reply sent)
        // This dismisses the indefinite spinner in Android notification shade
        try {
            NotificationManager notifManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (notifManager != null) {
                int iconRes = android.R.drawable.stat_notify_chat;
                try {
                    int res = context.getResources().getIdentifier("ic_stat_notify", "drawable", context.getPackageName());
                    if (res != 0) {
                        iconRes = res;
                    }
                } catch (Exception ignored) {}

                NotificationCompat.Builder repliedNotif = new NotificationCompat.Builder(context, KothaBartaMessagingService.CHANNEL_ID)
                    .setSmallIcon(iconRes)
                    .setContentTitle(senderName != null ? senderName : "কথা বার্তা (Kotha Barta)")
                    .setContentText("✓ উত্তর পাঠানো হয়েছে: " + replyText)
                    .setColor(Color.parseColor("#10B981")) // Green tick
                    .setPriority(NotificationCompat.PRIORITY_LOW)
                    .setAutoCancel(true);

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    repliedNotif.setTimeoutAfter(3500); // Auto-dismiss after 3.5s
                }

                notifManager.notify(notificationId, repliedNotif.build());
            }
        } catch (Exception e) {
            Log.e(TAG, "Error updating reply notification: " + e.getMessage());
        }

        // 2. Dispatch to WebView if MainActivity is alive
        MainActivity mainActivity = MainActivity.getInstance();
        if (mainActivity != null && mainActivity.getBridge() != null && mainActivity.getBridge().getWebView() != null) {
            mainActivity.runOnUiThread(() -> {
                try {
                    JSONObject jsObj = new JSONObject();
                    jsObj.put("conversationId", conversationId);
                    jsObj.put("content", replyText);
                    String script = String.format("window.handleDirectReply && window.handleDirectReply(%s);", jsObj.toString());
                    mainActivity.getBridge().getWebView().evaluateJavascript(script, null);
                } catch (Exception e) {
                    Log.e(TAG, "Error calling handleDirectReply on WebView: " + e.getMessage());
                }
            });
        }

        // 3. Persist to Supabase REST endpoint in background thread (reliable even if app is terminated)
        new Thread(() -> {
            sendDirectReplyViaRest(context, conversationId, replyText);
        }).start();
    }

    private void sendDirectReplyViaRest(Context context, String conversationId, String replyText) {
        try {
            SharedPreferences prefs = context.getSharedPreferences("kb_native_prefs", Context.MODE_PRIVATE);
            String currentUserId = prefs.getString("auth_user_id", null);
            String currentUserName = prefs.getString("auth_user_name", "User");
            String accessToken = prefs.getString("auth_access_token", null);

            if (currentUserId == null || accessToken == null || conversationId == null) {
                Log.w(TAG, "Missing credentials or conversationId in SharedPreferences. Direct reply skipped REST insert.");
                return;
            }

            // Step A: Insert message into Supabase messages table
            URL restUrl = new URL(SUPABASE_URL + "/rest/v1/messages");
            HttpURLConnection conn = (HttpURLConnection) restUrl.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("apikey", SUPABASE_ANON_KEY);
            conn.setRequestProperty("Authorization", "Bearer " + accessToken);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("Prefer", "return=representation");
            conn.setDoOutput(true);
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(10000);

            JSONObject postData = new JSONObject();
            postData.put("conversation_id", conversationId);
            postData.put("sender_id", currentUserId);
            postData.put("content", replyText);

            byte[] outputBytes = postData.toString().getBytes(StandardCharsets.UTF_8);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(outputBytes);
                os.flush();
            }

            int responseCode = conn.getResponseCode();
            Log.d(TAG, "Supabase message insert status code: " + responseCode);
            conn.disconnect();

            // Step B: If message insert succeeded, trigger Edge Function to push notification to the other participant
            if (responseCode >= 200 && responseCode < 300) {
                try {
                    URL fnUrl = new URL(SUPABASE_URL + "/functions/v1/send-push-notification");
                    HttpURLConnection fnConn = (HttpURLConnection) fnUrl.openConnection();
                    fnConn.setRequestMethod("POST");
                    fnConn.setRequestProperty("apikey", SUPABASE_ANON_KEY);
                    fnConn.setRequestProperty("Authorization", "Bearer " + accessToken);
                    fnConn.setRequestProperty("Content-Type", "application/json");
                    fnConn.setDoOutput(true);
                    fnConn.setConnectTimeout(8000);
                    fnConn.setReadTimeout(8000);

                    JSONObject fnBody = new JSONObject();
                    fnBody.put("conversationId", conversationId);
                    fnBody.put("senderId", currentUserId);
                    fnBody.put("senderName", currentUserName);
                    fnBody.put("content", replyText);

                    byte[] fnBytes = fnBody.toString().getBytes(StandardCharsets.UTF_8);
                    try (OutputStream os = fnConn.getOutputStream()) {
                        os.write(fnBytes);
                        os.flush();
                    }
                    int fnCode = fnConn.getResponseCode();
                    Log.d(TAG, "Push notification edge function status: " + fnCode);
                    fnConn.disconnect();
                } catch (Exception fnEx) {
                    Log.w(TAG, "Edge function push notification error: " + fnEx.getMessage());
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to send direct reply via REST: " + e.getMessage(), e);
        }
    }
}
