package com.nibir.kothabarta;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Log;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import com.google.firebase.messaging.FirebaseMessaging;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {

    private static final int PERMISSION_REQUEST_CODE = 9999;

    private static MainActivity instance;
    private static String activeConversationId = null;
    private static String pendingConversationId = null;
    private static String pendingCallJson = null;
    private static boolean isForeground = false;

    public static MainActivity getInstance() {
        return instance;
    }

    public static String getActiveConversationId() {
        return activeConversationId;
    }

    public static boolean isAppInForeground() {
        return isForeground;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        instance = this;
        super.onCreate(savedInstanceState);

        // Turn screen on and show over lock screen for incoming calls and wake events
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD |
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            );
        }

        // Check and parse notification launch intent
        handleIncomingIntent(getIntent());

        // Pre-request permissions at launch so calls connect seamlessly
        requestRequiredPermissions();

        // Fetch and sync FCM push device token natively
        fetchAndSyncFcmToken();

        // Allow WebRTC audio/video to autoplay without user gesture
        if (getBridge() != null && getBridge().getWebView() != null) {
            android.webkit.WebSettings webSettings = getBridge().getWebView().getSettings();
            webSettings.setMediaPlaybackRequiresUserGesture(false);

            // Register Javascript interface for native notifications bridge
            getBridge().getWebView().addJavascriptInterface(new KBNativeBridge(), "KBNativeBridge");
        }
    }

    @Override
    public void onStart() {
        super.onStart();
        isForeground = true;
        fetchAndSyncFcmToken();
    }

    @Override
    public void onResume() {
        super.onResume();
        isForeground = true;
        fetchAndSyncFcmToken();
    }

    @Override
    public void onStop() {
        super.onStop();
        isForeground = false;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (instance == this) {
            instance = null;
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD |
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            );
        }

        handleIncomingIntent(intent);
    }

    private void handleIncomingIntent(Intent intent) {
        if (intent == null) return;
        Bundle extras = intent.getExtras();
        if (extras != null) {
            String type = extras.getString("type");
            String callAction = extras.getString("callAction");
            String callId = extras.getString("callId");

            if ("incoming_call".equals(type) || callId != null || "com.nibir.kothabarta.ACTION_INCOMING_CALL".equals(intent.getAction()) || "com.nibir.kothabarta.ACTION_ANSWER_CALL".equals(intent.getAction())) {
                String callerId = extras.getString("callerId");
                String callerName = extras.getString("callerName");
                String callerAvatar = extras.getString("callerAvatar");
                String callType = extras.getString("callType");
                if (callType == null || callType.isEmpty()) callType = "voice";

                if (callAction == null || callAction.isEmpty()) {
                    if ("com.nibir.kothabarta.ACTION_ANSWER_CALL".equals(intent.getAction())) {
                        callAction = "answer";
                    } else {
                        callAction = "show";
                    }
                }

                try {
                    JSONObject callObj = new JSONObject();
                    callObj.put("action", callAction);
                    callObj.put("callId", callId != null ? callId : "");
                    callObj.put("callerId", callerId != null ? callerId : "");
                    callObj.put("callerName", callerName != null ? callerName : "User");
                    callObj.put("callerAvatar", callerAvatar != null ? callerAvatar : "");
                    callObj.put("callType", callType);
                    pendingCallJson = callObj.toString();
                } catch (Exception ignored) {}

                dispatchCallToWebView(callAction, callId, callerId, callerName, callType, callerAvatar);
                return;
            }

            String convId = extras.getString("conversationId");
            if (convId == null) {
                convId = extras.getString("conversation_id");
            }
            if (convId != null && !convId.isEmpty()) {
                pendingConversationId = convId;
                dispatchConversationToWebView(convId);
            }
        }
    }

    public void dispatchCallToWebView(String action, String callId, String callerId, String callerName, String callType, String callerAvatar) {
        runOnUiThread(() -> {
            try {
                if (getBridge() != null && getBridge().getWebView() != null) {
                    String safeCallerName = callerName != null ? callerName.replace("'", "\\'") : "User";
                    String script = String.format(
                        "window.handleIncomingCallAction && window.handleIncomingCallAction('%s', '%s', '%s', '%s', '%s', '%s');",
                        action != null ? action : "show",
                        callId != null ? callId : "",
                        callerId != null ? callerId : "",
                        safeCallerName,
                        callType != null ? callType : "voice",
                        callerAvatar != null ? callerAvatar : ""
                    );
                    getBridge().getWebView().evaluateJavascript(script, null);
                }
            } catch (Exception ignored) {}
        });
    }

    public void dispatchConversationToWebView(String conversationId) {
        runOnUiThread(() -> {
            try {
                if (getBridge() != null && getBridge().getWebView() != null) {
                    String script = String.format("window.handleNotificationDeepLink && window.handleNotificationDeepLink('%s');", conversationId);
                    getBridge().getWebView().evaluateJavascript(script, null);
                }
            } catch (Exception ignored) {}
        });
    }

    public void fetchAndSyncFcmToken() {
        try {
            FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
                if (task.isSuccessful() && task.getResult() != null) {
                    String token = task.getResult();
                    Log.d("MainActivity", "Firebase FCM Token retrieved: " + token);
                    getSharedPreferences("kb_native_prefs", Context.MODE_PRIVATE)
                        .edit()
                        .putString("fcm_token", token)
                        .apply();

                    runOnUiThread(() -> {
                        try {
                            if (getBridge() != null && getBridge().getWebView() != null) {
                                String script = String.format("window.handleNativeFcmToken && window.handleNativeFcmToken('%s');", token);
                                getBridge().getWebView().evaluateJavascript(script, null);
                            }
                        } catch (Exception ignored) {}
                    });
                } else {
                    Log.w("MainActivity", "Failed to retrieve Firebase FCM token: ", task.getException());
                }
            });
        } catch (Throwable t) {
            Log.e("MainActivity", "Error in fetchAndSyncFcmToken: " + t.getMessage());
        }
    }

    private void requestRequiredPermissions() {
        List<String> permissions = new ArrayList<>();
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.CAMERA);
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.RECORD_AUDIO);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                permissions.add(Manifest.permission.POST_NOTIFICATIONS);
            }
        }
        if (!permissions.isEmpty()) {
            ActivityCompat.requestPermissions(this, permissions.toArray(new String[0]), PERMISSION_REQUEST_CODE);
        }
    }

    public class KBNativeBridge {
        @JavascriptInterface
        public String getPendingConversationId() {
            String convId = pendingConversationId;
            pendingConversationId = null;
            return convId != null ? convId : "";
        }

        @JavascriptInterface
        public String getPendingCallData() {
            String data = pendingCallJson;
            pendingCallJson = null;
            return data != null ? data : "";
        }

        @JavascriptInterface
        public void syncSelectedRingtone(String ringtoneId) {
            SharedPreferences prefs = getSharedPreferences("kb_native_prefs", Context.MODE_PRIVATE);
            prefs.edit().putString("kb_ringtone", ringtoneId).apply();
        }

        @JavascriptInterface
        public void cancelCallNotification(String callId) {
            if (callId != null && !callId.isEmpty()) {
                try {
                    NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                    if (nm != null) {
                        nm.cancel(Math.abs(callId.hashCode()));
                    }
                } catch (Exception ignored) {}
            }
        }

        @JavascriptInterface
        public void setActiveConversation(String convId) {
            activeConversationId = (convId != null && !convId.isEmpty()) ? convId : null;
        }

        @JavascriptInterface
        public void syncUserAuth(String userId, String userName, String accessToken) {
            SharedPreferences prefs = getSharedPreferences("kb_native_prefs", Context.MODE_PRIVATE);
            prefs.edit()
                .putString("auth_user_id", userId)
                .putString("auth_user_name", userName)
                .putString("auth_access_token", accessToken)
                .apply();
        }

        @JavascriptInterface
        public void clearUserAuth() {
            SharedPreferences prefs = getSharedPreferences("kb_native_prefs", Context.MODE_PRIVATE);
            prefs.edit().clear().apply();
        }

        @JavascriptInterface
        public String getFcmToken() {
            SharedPreferences prefs = getSharedPreferences("kb_native_prefs", Context.MODE_PRIVATE);
            return prefs.getString("fcm_token", "");
        }

        @JavascriptInterface
        public void refreshFcmToken() {
            fetchAndSyncFcmToken();
        }

        @JavascriptInterface
        public boolean isNotificationPermissionGranted() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                return ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
            }
            return true;
        }

        @JavascriptInterface
        public void requestNotificationPermission() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                ActivityCompat.requestPermissions(MainActivity.this, new String[]{Manifest.permission.POST_NOTIFICATIONS}, PERMISSION_REQUEST_CODE);
            }
        }

        @JavascriptInterface
        public boolean canUseFullScreenIntent() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                return nm != null && nm.canUseFullScreenIntent();
            }
            return true;
        }

        @JavascriptInterface
        public void openFullScreenIntentSettings() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                try {
                    Intent intent = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT);
                    intent.setData(Uri.parse("package:" + getPackageName()));
                    startActivity(intent);
                } catch (Exception ignored) {}
            }
        }

        @JavascriptInterface
        public boolean isIgnoringBatteryOptimizations() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                return pm != null && pm.isIgnoringBatteryOptimizations(getPackageName());
            }
            return true;
        }

        @SuppressLint("BatteryLife")
        @JavascriptInterface
        public void requestIgnoreBatteryOptimizations() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                try {
                    Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(Uri.parse("package:" + getPackageName()));
                    startActivity(intent);
                } catch (Exception e) {
                    try {
                        Intent intent = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                        startActivity(intent);
                    } catch (Exception ignored) {}
                }
            }
        }
    }
}
