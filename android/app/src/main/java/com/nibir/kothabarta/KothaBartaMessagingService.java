package com.nibir.kothabarta;

import android.annotation.SuppressLint;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.app.KeyguardManager;
import android.app.Notification;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.Person;
import androidx.core.app.RemoteInput;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.lang.reflect.Method;
import java.util.Map;
import java.util.Random;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public class KothaBartaMessagingService extends FirebaseMessagingService {

    private static final String TAG = "KBMessagingService";

    public static final String CHANNEL_ID = "messages";
    public static final String CHANNEL_NAME = "Messages";
    public static final String CALL_CHANNEL_ID = "kothabarta_incoming_calls_v2";
    public static final String CALL_CHANNEL_NAME = "Incoming Calls";
    public static final String KEY_TEXT_REPLY = "key_direct_reply";
    public static final String ACTION_DIRECT_REPLY = "com.nibir.kothabarta.ACTION_DIRECT_REPLY";

    // A notification is kept for each unread conversation.  The system group lets
    // Android show several conversations separately while also providing one app
    // summary in the notification shade.
    private static final String MESSAGE_GROUP_KEY = "com.nibir.kothabarta.MESSAGE_GROUP";
    private static final String UNREAD_MESSAGES_PREFS = "kb_unread_notification_messages";
    private static final String UNREAD_MESSAGES_KEY = "conversations";
    private static final int GROUP_SUMMARY_NOTIFICATION_ID = 900001;
    private static final int MAX_MESSAGES_PER_CONVERSATION = 25;

    public static final String EXTRA_CONVERSATION_ID = "conversationId";
    public static final String EXTRA_SENDER_ID = "senderId";
    public static final String EXTRA_SENDER_NAME = "senderName";
    public static final String EXTRA_NOTIFICATION_ID = "notificationId";

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        Log.d(TAG, "New FCM Token received: " + token);

        try {
            getSharedPreferences("kb_native_prefs", Context.MODE_PRIVATE)
                .edit()
                .putString("fcm_token", token)
                .apply();
        } catch (Exception ignored) {}

        try {
            Class<?> pluginClass = Class.forName("com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin");
            Method method = pluginClass.getMethod("onNewToken", String.class);
            method.invoke(null, token);
        } catch (Exception e) {
            Log.w(TAG, "Could not forward token to Capacitor PushNotificationsPlugin: " + e.getMessage());
        }

        try {
            MainActivity mainActivity = MainActivity.getInstance();
            if (mainActivity != null && mainActivity.getBridge() != null && mainActivity.getBridge().getWebView() != null) {
                mainActivity.runOnUiThread(() -> {
                    try {
                        String script = String.format("window.handleNativeFcmToken && window.handleNativeFcmToken('%s');", token);
                        mainActivity.getBridge().getWebView().evaluateJavascript(script, null);
                    } catch (Exception ignored) {}
                });
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        Log.d(TAG, "FCM Message received from: " + remoteMessage.getFrom());

        // Always forward to Capacitor PushNotifications plugin so JS foreground listeners trigger
        try {
            Class<?> pluginClass = Class.forName("com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin");
            Method method = pluginClass.getMethod("sendRemoteMessage", RemoteMessage.class);
            method.invoke(null, remoteMessage);
        } catch (Exception e) {
            Log.w(TAG, "Could not forward remote message to Capacitor PushNotificationsPlugin: " + e.getMessage());
        }

        Map<String, String> data = remoteMessage.getData();

        // Extract message fields from data payload or notification payload fallback
        String conversationId = data.get("conversationId");
        if (conversationId == null) {
            conversationId = data.get("conversation_id");
        }
        String senderId = data.get("senderId");
        String senderName = data.get("senderName");
        String type = data.get("type");

        // Handle call cancellation from remote caller
        if ("call_cancelled".equals(type)) {
            String callId = data.get("callId");
            Log.d(TAG, "Incoming call cancelled by remote caller: " + callId);
            if (callId != null) {
                int callNotifId = Math.abs(callId.hashCode());
                NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                if (notificationManager != null) {
                    notificationManager.cancel(callNotifId);
                }
            }
            return;
        }

        // Handle incoming call with high-priority full-screen intent & ringing
        if ("incoming_call".equals(type)) {
            if (conversationId != null && isConversationMutedLocally(conversationId, type)) {
                Log.d(TAG, "Incoming call for muted conversation " + conversationId + ". Suppressing call alert.");
                return;
            }
            Log.d(TAG, "Incoming call push notification received. Triggering full-screen call alert.");
            showIncomingCallNotification(data);
            return;
        }

        String title = data.get("title");
        String body = data.get("body");

        if (remoteMessage.getNotification() != null) {
            if (title == null || title.isEmpty()) {
                title = remoteMessage.getNotification().getTitle();
            }
            if (body == null || body.isEmpty()) {
                body = remoteMessage.getNotification().getBody();
            }
        }

        if (title == null || title.isEmpty()) {
            title = senderName != null && !senderName.isEmpty() ? senderName : "কথা বার্তা (Kotha Barta)";
        }
        if (body == null || body.isEmpty()) {
            body = "নতুন বার্তা এসেছে";
        }

        // If user is currently looking at this conversation, skip showing heads-up notification
        if (MainActivity.isAppInForeground() && conversationId != null && conversationId.equals(MainActivity.getActiveConversationId())) {
            Log.d(TAG, "User currently viewing conversation " + conversationId + ". Suppressing notification.");
            return;
        }

        // If conversation is muted locally on this device, suppress notification
        if (conversationId != null && isConversationMutedLocally(conversationId, "message")) {
            Log.d(TAG, "Conversation " + conversationId + " is muted locally on this device. Suppressing notification.");
            return;
        }

        showNotification(conversationId, senderId, senderName, title, body, type);
    }

    private boolean isConversationMutedLocally(String conversationId, String type) {
        if (conversationId == null || conversationId.isEmpty()) return false;
        try {
            android.content.SharedPreferences prefs = getSharedPreferences("kb_muted_convs", Context.MODE_PRIVATE);
            String val = prefs.getString(conversationId, null);
            if (val == null || val.isEmpty()) return false;

            String[] parts = val.split(":");
            boolean isMuted = Boolean.parseBoolean(parts[0]);
            if (!isMuted) return false;

            if (parts.length > 1) {
                long until = Long.parseLong(parts[1]);
                if (until > 0 && System.currentTimeMillis() >= until) {
                    prefs.edit().remove(conversationId).apply();
                    return false;
                }
            }

            String muteType = parts.length > 2 ? parts[2] : "all";
            if ("incoming_call".equals(type)) {
                return "all".equals(muteType);
            }
            return true;
        } catch (Exception e) {
            Log.w(TAG, "Error checking muted conv locally: " + e.getMessage());
            return false;
        }
    }

    @SuppressLint("MissingPermission")
    private void showNotification(
        String conversationId,
        String senderId,
        String senderName,
        String title,
        String body,
        String type
    ) {
        try {
            NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (notificationManager == null) return;

            // 1. Ensure high-importance notification channel is created
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel channel = notificationManager.getNotificationChannel(CHANNEL_ID);
                if (channel == null) {
                    channel = new NotificationChannel(
                        CHANNEL_ID,
                        CHANNEL_NAME,
                        NotificationManager.IMPORTANCE_HIGH
                    );
                    channel.setDescription("Chat messages and inline direct replies");
                    channel.enableLights(true);
                    channel.setLightColor(Color.parseColor("#6366F1"));
                    channel.enableVibration(true);
                    channel.setShowBadge(true);
                    channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);

                    Uri defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
                    AudioAttributes audioAttributes = new AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_COMMUNICATION_INSTANT)
                        .build();
                    channel.setSound(defaultSoundUri, audioAttributes);

                    notificationManager.createNotificationChannel(channel);
                }
            }

            // 2. Use one stable child notification per conversation. Unlike the
            // previous implementation, the child contains a persisted message
            // history, so receiving "How are you?" never erases an unread "Hi".
            int notifId = getNotificationId(conversationId);
            JSONArray unreadMessages = appendUnreadMessage(conversationId, senderName, body);

            // 3. Create Tap Intent (Deep link directly to chat in MainActivity)
            Intent tapIntent = new Intent(this, MainActivity.class);
            tapIntent.setAction(Intent.ACTION_VIEW);
            tapIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            if (conversationId != null) {
                tapIntent.putExtra(EXTRA_CONVERSATION_ID, conversationId);
                tapIntent.putExtra("conversation_id", conversationId);
            }
            if (senderId != null) {
                tapIntent.putExtra(EXTRA_SENDER_ID, senderId);
            }
            if (senderName != null) {
                tapIntent.putExtra(EXTRA_SENDER_NAME, senderName);
            }
            tapIntent.putExtra("from_notification", true);
            tapIntent.putExtra("click_action", "FCM_PLUGIN_ACTIVITY");

            int flagImmutable = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0;
            PendingIntent tapPendingIntent = PendingIntent.getActivity(
                this,
                notifId,
                tapIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | flagImmutable
            );

            // Safe monochrome small icon resolution (never pass adaptive-icon XML)
            int iconRes = android.R.drawable.stat_notify_chat;
            try {
                int res = getResources().getIdentifier("ic_stat_notify", "drawable", getPackageName());
                if (res != 0) {
                    iconRes = res;
                }
            } catch (Exception ignored) {}

            Person self = new Person.Builder().setName("You").build();
            NotificationCompat.MessagingStyle messagingStyle = new NotificationCompat.MessagingStyle(self)
                .setConversationTitle(title)
                .setGroupConversation(false);
            for (int i = 0; i < unreadMessages.length(); i++) {
                JSONObject message = unreadMessages.optJSONObject(i);
                if (message == null) continue;
                String messageText = message.optString("body", "নতুন বার্তা এসেছে");
                String messageSender = message.optString("senderName", title);
                long timestamp = message.optLong("timestamp", System.currentTimeMillis());
                Person sender = new Person.Builder().setName(messageSender).build();
                messagingStyle.addMessage(messageText, timestamp, sender);
            }

            String latestBody = unreadMessages.length() > 1
                ? unreadMessages.length() + " new messages"
                : body;
            NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(iconRes)
                .setContentTitle(title)
                .setContentText(latestBody)
                .setSubText(unreadMessages.length() > 1 ? unreadMessages.length() + " unread messages" : null)
                .setStyle(messagingStyle)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setAutoCancel(true)
                .setColor(Color.parseColor("#6366F1"))
                .setContentIntent(tapPendingIntent)
                .setGroup(MESSAGE_GROUP_KEY)
                .setDefaults(NotificationCompat.DEFAULT_ALL);

            // 4. Attach WhatsApp/Messenger-style Inline Direct Reply (RemoteInput) for chat messages
            if (conversationId != null && !conversationId.isEmpty()) {
                RemoteInput remoteInput = new RemoteInput.Builder(KEY_TEXT_REPLY)
                    .setLabel("উত্তর লিখুন / Reply...")
                    .build();

                Intent replyIntent = new Intent(this, DirectReplyReceiver.class);
                replyIntent.setAction(ACTION_DIRECT_REPLY);
                replyIntent.putExtra(EXTRA_CONVERSATION_ID, conversationId);
                replyIntent.putExtra(EXTRA_SENDER_ID, senderId);
                replyIntent.putExtra(EXTRA_SENDER_NAME, senderName);
                replyIntent.putExtra(EXTRA_NOTIFICATION_ID, notifId);

                // RemoteInput PendingIntent MUST be FLAG_MUTABLE on Android 12+ (SDK 31+)
                int flagMutable = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_MUTABLE : 0;
                PendingIntent replyPendingIntent = PendingIntent.getBroadcast(
                    this,
                    notifId + 1,
                    replyIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | flagMutable
                );

                NotificationCompat.Action replyAction = new NotificationCompat.Action.Builder(
                    android.R.drawable.ic_menu_send,
                    "উত্তর দিন (Reply)",
                    replyPendingIntent
                )
                .addRemoteInput(remoteInput)
                .setAllowGeneratedReplies(true)
                .build();

                builder.addAction(replyAction);
            }

            notificationManager.notify(notifId, builder.build());
            updateGroupSummary(this, notificationManager);
            Log.d(TAG, "Notification successfully posted for conversation: " + conversationId + ", notifId: " + notifId);
        } catch (Throwable t) {
            Log.e(TAG, "Error posting notification: " + t.getMessage(), t);
        }
    }

    private static int getNotificationId(String conversationId) {
        return conversationId != null && !conversationId.isEmpty()
            ? (conversationId.hashCode() & 0x7fffffff)
            : new Random().nextInt(100000);
    }

    private JSONArray appendUnreadMessage(String conversationId, String senderName, String body) {
        if (conversationId == null || conversationId.isEmpty()) {
            JSONArray messages = new JSONArray();
            messages.put(createMessageJson(senderName, body));
            return messages;
        }

        try {
            android.content.SharedPreferences prefs = getSharedPreferences(UNREAD_MESSAGES_PREFS, Context.MODE_PRIVATE);
            JSONObject conversations = new JSONObject(prefs.getString(UNREAD_MESSAGES_KEY, "{}"));
            JSONObject conversation = conversations.optJSONObject(conversationId);
            if (conversation == null) conversation = new JSONObject();
            JSONArray messages = conversation.optJSONArray("messages");
            if (messages == null) messages = new JSONArray();

            messages.put(createMessageJson(senderName, body));
            while (messages.length() > MAX_MESSAGES_PER_CONVERSATION) {
                JSONArray trimmed = new JSONArray();
                for (int i = 1; i < messages.length(); i++) trimmed.put(messages.get(i));
                messages = trimmed;
            }

            conversation.put("title", senderName != null && !senderName.isEmpty() ? senderName : "কথা বার্তা (Kotha Barta)");
            conversation.put("messages", messages);
            conversations.put(conversationId, conversation);
            prefs.edit().putString(UNREAD_MESSAGES_KEY, conversations.toString()).apply();
            return messages;
        } catch (JSONException e) {
            Log.w(TAG, "Could not store unread notification history", e);
            JSONArray messages = new JSONArray();
            messages.put(createMessageJson(senderName, body));
            return messages;
        }
    }

    private JSONObject createMessageJson(String senderName, String body) {
        JSONObject message = new JSONObject();
        try {
            message.put("senderName", senderName != null ? senderName : "Someone");
            message.put("body", body != null ? body : "নতুন বার্তা এসেছে");
            message.put("timestamp", System.currentTimeMillis());
        } catch (JSONException ignored) {}
        return message;
    }

    /** Removes only the conversation the user has opened; other unread chats stay visible. */
    public static void clearConversationNotifications(Context context, String conversationId) {
        if (context == null || conversationId == null || conversationId.isEmpty()) return;
        try {
            NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (notificationManager != null) notificationManager.cancel(getNotificationId(conversationId));
            clearConversationNotificationHistory(context, conversationId);
        } catch (Exception e) {
            Log.w(TAG, "Could not clear conversation notification", e);
        }
    }

    /** Clears stored unread lines without cancelling a temporary UI notification (used after inline reply). */
    public static void clearConversationNotificationHistory(Context context, String conversationId) {
        if (context == null || conversationId == null || conversationId.isEmpty()) return;
        try {
            android.content.SharedPreferences prefs = context.getSharedPreferences(UNREAD_MESSAGES_PREFS, Context.MODE_PRIVATE);
            JSONObject conversations = new JSONObject(prefs.getString(UNREAD_MESSAGES_KEY, "{}"));
            conversations.remove(conversationId);
            prefs.edit().putString(UNREAD_MESSAGES_KEY, conversations.toString()).apply();

            NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (notificationManager != null) updateGroupSummary(context, notificationManager);
        } catch (Exception e) {
            Log.w(TAG, "Could not clear conversation notification history", e);
        }
    }

    private static void updateGroupSummary(Context context, NotificationManager notificationManager) {
        try {
            android.content.SharedPreferences prefs = context.getSharedPreferences(UNREAD_MESSAGES_PREFS, Context.MODE_PRIVATE);
            JSONObject conversations = new JSONObject(prefs.getString(UNREAD_MESSAGES_KEY, "{}"));
            if (conversations.length() == 0) {
                notificationManager.cancel(GROUP_SUMMARY_NOTIFICATION_ID);
                return;
            }

            int totalMessages = 0;
            NotificationCompat.InboxStyle inboxStyle = new NotificationCompat.InboxStyle();
            java.util.Iterator<String> keys = conversations.keys();
            while (keys.hasNext()) {
                String conversationId = keys.next();
                JSONObject conversation = conversations.optJSONObject(conversationId);
                if (conversation == null) continue;
                JSONArray messages = conversation.optJSONArray("messages");
                int count = messages != null ? messages.length() : 0;
                totalMessages += count;
                inboxStyle.addLine(conversation.optString("title", "কথা বার্তা") + " · " + count + " message" + (count == 1 ? "" : "s"));
            }

            NotificationCompat.Builder summary = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.stat_notify_chat)
                .setContentTitle("কথা বার্তা (Kotha Barta)")
                .setContentText(totalMessages + " unread message" + (totalMessages == 1 ? "" : "s"))
                .setStyle(inboxStyle.setSummaryText(totalMessages + " unread message" + (totalMessages == 1 ? "" : "s")))
                .setGroup(MESSAGE_GROUP_KEY)
                .setGroupSummary(true)
                .setAutoCancel(true)
                .setOnlyAlertOnce(true);
            notificationManager.notify(GROUP_SUMMARY_NOTIFICATION_ID, summary.build());
        } catch (Exception e) {
            Log.w(TAG, "Could not update notification group summary", e);
        }
    }

    @SuppressLint("MissingPermission")
    private void showIncomingCallNotification(Map<String, String> data) {
        try {
            NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (notificationManager == null) return;

            String callId = data.get("callId");
            String callerId = data.get("callerId");
            String callerName = data.get("callerName");
            String callerAvatar = data.get("callerAvatar");
            String callType = data.get("callType");
            if (callType == null || callType.isEmpty()) callType = "voice";

            // 1. Acquire WakeLock to wake the phone screen up from sleep mode
            PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (powerManager != null) {
                try {
                    PowerManager.WakeLock wakeLock = powerManager.newWakeLock(
                        PowerManager.SCREEN_BRIGHT_WAKE_LOCK |
                        PowerManager.ACQUIRE_CAUSES_WAKEUP |
                        PowerManager.ON_AFTER_RELEASE,
                        "kothabarta:call_screen_wake"
                    );
                    wakeLock.acquire(20000); // Hold for 20s max to allow answering
                } catch (Exception e) {
                    Log.w(TAG, "Could not acquire WakeLock for incoming call: " + e.getMessage());
                }
            }

            // 2. Ensure high-importance VoIP call channel exists
            Uri ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                // Delete legacy/stale channel so sound is never stuck on default ping
                try {
                    notificationManager.deleteNotificationChannel("calls");
                } catch (Exception ignored) {}

                NotificationChannel callChannel = notificationManager.getNotificationChannel(CALL_CHANNEL_ID);
                if (callChannel == null) {
                    callChannel = new NotificationChannel(
                        CALL_CHANNEL_ID,
                        CALL_CHANNEL_NAME,
                        NotificationManager.IMPORTANCE_HIGH
                    );
                    callChannel.setDescription("Incoming voice and video calls");
                    callChannel.enableLights(true);
                    callChannel.setLightColor(Color.parseColor("#10B981"));
                    callChannel.enableVibration(true);
                    callChannel.setVibrationPattern(new long[]{0, 1000, 600, 1000, 600, 1000});
                    callChannel.setShowBadge(true);
                    callChannel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);

                    AudioAttributes audioAttributes = new AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .build();
                    callChannel.setSound(ringtoneUri, audioAttributes);

                    notificationManager.createNotificationChannel(callChannel);
                }
            }

            int callNotifId = callId != null && !callId.isEmpty()
                ? Math.abs(callId.hashCode())
                : 88888;

            int flagImmutable = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0;

            // 3. Full-screen tap intent (launches/wakes MainActivity over lockscreen)
            Intent fullScreenIntent = new Intent(this, MainActivity.class);
            fullScreenIntent.setAction("com.nibir.kothabarta.ACTION_INCOMING_CALL");
            fullScreenIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            fullScreenIntent.putExtra("type", "incoming_call");
            fullScreenIntent.putExtra("callAction", "show");
            fullScreenIntent.putExtra("callId", callId);
            fullScreenIntent.putExtra("callerId", callerId);
            fullScreenIntent.putExtra("callerName", callerName);
            fullScreenIntent.putExtra("callerAvatar", callerAvatar);
            fullScreenIntent.putExtra("callType", callType);

            PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(
                this,
                callNotifId,
                fullScreenIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | flagImmutable
            );

            // Fallback attempt to wake activity directly if device is sleeping or locked
            try {
                if (powerManager != null && !powerManager.isInteractive()) {
                    startActivity(fullScreenIntent);
                }
            } catch (Exception ignored) {}

            // 4. Answer Action Button Intent
            Intent answerIntent = new Intent(this, MainActivity.class);
            answerIntent.setAction("com.nibir.kothabarta.ACTION_ANSWER_CALL");
            answerIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            answerIntent.putExtra("type", "incoming_call");
            answerIntent.putExtra("callAction", "answer");
            answerIntent.putExtra("callId", callId);
            answerIntent.putExtra("callerId", callerId);
            answerIntent.putExtra("callerName", callerName);
            answerIntent.putExtra("callerAvatar", callerAvatar);
            answerIntent.putExtra("callType", callType);

            PendingIntent answerPendingIntent = PendingIntent.getActivity(
                this,
                callNotifId + 1,
                answerIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | flagImmutable
            );

            // 5. Decline Action Button Intent (Broadcast to CallActionReceiver)
            Intent declineIntent = new Intent(this, CallActionReceiver.class);
            declineIntent.setAction(CallActionReceiver.ACTION_DECLINE_CALL);
            declineIntent.putExtra("callId", callId);
            declineIntent.putExtra("callerId", callerId);
            declineIntent.putExtra("notificationId", callNotifId);

            PendingIntent declinePendingIntent = PendingIntent.getBroadcast(
                this,
                callNotifId + 2,
                declineIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | flagImmutable
            );

            // 6. Safe small icon
            int iconRes = android.R.drawable.stat_notify_chat;
            try {
                int res = getResources().getIdentifier("ic_stat_notify", "drawable", getPackageName());
                if (res != 0) {
                    iconRes = res;
                }
            } catch (Exception ignored) {}

            String displayTitle = (callerName != null && !callerName.isEmpty())
                ? callerName
                : "কথা বার্তা (Kotha Barta)";
            String displayBody = "video".equalsIgnoreCase(callType)
                ? "ইনকামিং ভিডিও কল..."
                : "ইনকামিং অডিও কল...";

            NotificationCompat.Builder callBuilder = new NotificationCompat.Builder(this, CALL_CHANNEL_ID)
                .setSmallIcon(iconRes)
                .setContentTitle(displayTitle)
                .setContentText(displayBody)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setAutoCancel(false)
                .setOngoing(true)
                .setSound(ringtoneUri)
                .setVibrate(new long[]{0, 1000, 600, 1000, 600, 1000})
                .setColor(Color.parseColor("#10B981"))
                .setFullScreenIntent(fullScreenPendingIntent, true)
                .setContentIntent(fullScreenPendingIntent)
                .addAction(android.R.drawable.ic_menu_close_clear_cancel, "কেটে দিন (Decline)", declinePendingIntent)
                .addAction(android.R.drawable.ic_menu_call, "উত্তর দিন (Answer)", answerPendingIntent);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                callBuilder.setTimeoutAfter(45000); // Ring for max 45 seconds
            }

            Notification notification = callBuilder.build();
            // Loop ringtone & vibration continuously until user answers or declines
            notification.flags |= Notification.FLAG_INSISTENT | Notification.FLAG_ONGOING_EVENT;

            notificationManager.notify(callNotifId, notification);
            Log.d(TAG, "Incoming call notification successfully posted for callId: " + callId + ", notifId: " + callNotifId);
        } catch (Throwable t) {
            Log.e(TAG, "Error posting incoming call notification: " + t.getMessage(), t);
        }
    }
}
