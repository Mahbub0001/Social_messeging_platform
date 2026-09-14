package com.nibir.kothabarta;

import android.annotation.SuppressLint;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.RemoteInput;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.lang.reflect.Method;
import java.util.Map;
import java.util.Random;

public class KothaBartaMessagingService extends FirebaseMessagingService {

    private static final String TAG = "KBMessagingService";

    public static final String CHANNEL_ID = "messages";
    public static final String CHANNEL_NAME = "Messages";
    public static final String KEY_TEXT_REPLY = "key_direct_reply";
    public static final String ACTION_DIRECT_REPLY = "com.nibir.kothabarta.ACTION_DIRECT_REPLY";

    public static final String EXTRA_CONVERSATION_ID = "conversationId";
    public static final String EXTRA_SENDER_ID = "senderId";
    public static final String EXTRA_SENDER_NAME = "senderName";
    public static final String EXTRA_NOTIFICATION_ID = "notificationId";

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        Log.d(TAG, "New FCM Token received: " + token);
        try {
            Class<?> pluginClass = Class.forName("com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin");
            Method method = pluginClass.getMethod("onNewToken", String.class);
            method.invoke(null, token);
        } catch (Exception e) {
            Log.w(TAG, "Could not forward token to Capacitor PushNotificationsPlugin: " + e.getMessage());
        }
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

        showNotification(conversationId, senderId, senderName, title, body, type);
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

            // 2. Generate stable notification ID per conversation so new messages group cleanly
            int notifId = conversationId != null && !conversationId.isEmpty()
                ? Math.abs(conversationId.hashCode())
                : new Random().nextInt(100000);

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

            NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(iconRes)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setAutoCancel(true)
                .setColor(Color.parseColor("#6366F1"))
                .setContentIntent(tapPendingIntent)
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
            Log.d(TAG, "Notification successfully posted for conversation: " + conversationId + ", notifId: " + notifId);
        } catch (Throwable t) {
            Log.e(TAG, "Error posting notification: " + t.getMessage(), t);
        }
    }
}
