package com.nibir.kothabarta;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

public class CallActionReceiver extends BroadcastReceiver {

    private static final String TAG = "CallActionReceiver";
    public static final String ACTION_DECLINE_CALL = "com.nibir.kothabarta.ACTION_DECLINE_CALL";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        Log.d(TAG, "CallActionReceiver received action: " + action);

        if (ACTION_DECLINE_CALL.equals(action)) {
            String callId = intent.getStringExtra("callId");
            String callerId = intent.getStringExtra("callerId");
            int notificationId = intent.getIntExtra("notificationId", 0);

            // 1. Immediately cancel the incoming call notification
            try {
                NotificationManager notificationManager =
                    (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
                if (notificationManager != null && notificationId != 0) {
                    notificationManager.cancel(notificationId);
                }
            } catch (Exception e) {
                Log.e(TAG, "Error cancelling call notification: " + e.getMessage());
            }

            // 2. If MainActivity is alive, dispatch decline event to WebView
            MainActivity mainActivity = MainActivity.getInstance();
            if (mainActivity != null && mainActivity.getBridge() != null && mainActivity.getBridge().getWebView() != null) {
                mainActivity.runOnUiThread(() -> {
                    try {
                        String script = String.format(
                            "window.handleIncomingCallAction && window.handleIncomingCallAction('decline', '%s', '%s');",
                            callId != null ? callId : "",
                            callerId != null ? callerId : ""
                        );
                        mainActivity.getBridge().getWebView().evaluateJavascript(script, null);
                    } catch (Exception e) {
                        Log.e(TAG, "Error executing decline script on WebView: " + e.getMessage());
                    }
                });
            }
        }
    }
}
