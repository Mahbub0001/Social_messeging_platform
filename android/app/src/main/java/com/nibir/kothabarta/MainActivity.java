package com.nibir.kothabarta;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {

    private static final int PERMISSION_REQUEST_CODE = 9999;

    private static MainActivity instance;
    private static String activeConversationId = null;
    private static String pendingConversationId = null;
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

        // Check and parse notification launch intent
        handleIncomingIntent(getIntent());

        // Pre-request permissions at launch so calls connect seamlessly
        requestRequiredPermissions();

        // Allow WebRTC audio/video to autoplay without user gesture
        if (getBridge() != null && getBridge().getWebView() != null) {
            android.webkit.WebSettings webSettings = getBridge().getWebView().getSettings();
            webSettings.setMediaPlaybackRequiresUserGesture(false);

            // Register Javascript interface for native notifications bridge
            getBridge().getWebView().addJavascriptInterface(new KBNativeBridge(), "KBNativeBridge");
        }
    }

    @Override
    protected void onStart() {
        super.onStart();
        isForeground = true;
    }

    @Override
    protected void onStop() {
        super.onStop();
        isForeground = false;
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (instance == this) {
            instance = null;
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIncomingIntent(intent);
    }

    private void handleIncomingIntent(Intent intent) {
        if (intent == null) return;
        Bundle extras = intent.getExtras();
        if (extras != null) {
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

    private void requestRequiredPermissions() {
        List<String> permissions = new ArrayList<>();
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.CAMERA);
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.RECORD_AUDIO);
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
    }
}
