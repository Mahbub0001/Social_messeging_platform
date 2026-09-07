package com.nibir.kothabarta;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {

    private static final int PERMISSION_REQUEST_CODE = 1001;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestMediaPermissions();
    }

    @Override
    public void onStart() {
        super.onStart();
        configureWebView();
    }

    @Override
    public void onResume() {
        super.onResume();
        configureWebView();
    }

    private void requestMediaPermissions() {
        List<String> permissions = new ArrayList<>();
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.RECORD_AUDIO);
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.CAMERA);
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.MODIFY_AUDIO_SETTINGS) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.MODIFY_AUDIO_SETTINGS);
        }
        if (!permissions.isEmpty()) {
            ActivityCompat.requestPermissions(this, permissions.toArray(new String[0]), PERMISSION_REQUEST_CODE);
        }
    }

    private void configureWebView() {
        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
            WebSettings settings = webView.getSettings();
            // Allow WebRTC autoplay audio and video without requiring user tap/gesture
            settings.setMediaPlaybackRequiresUserGesture(false);

            // Override WebChromeClient to grant WebRTC audio/video capture
            webView.setWebChromeClient(new BridgeWebChromeClient(getBridge()) {
                @Override
                public void onPermissionRequest(final PermissionRequest request) {
                    MainActivity.this.runOnUiThread(() -> {
                        List<String> needed = new ArrayList<>();
                        for (String res : request.getResources()) {
                            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(res)) {
                                if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                                    needed.add(Manifest.permission.RECORD_AUDIO);
                                }
                            }
                            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(res)) {
                                if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                                    needed.add(Manifest.permission.CAMERA);
                                }
                            }
                        }

                        if (!needed.isEmpty()) {
                            ActivityCompat.requestPermissions(MainActivity.this, needed.toArray(new String[0]), PERMISSION_REQUEST_CODE);
                        }
                        // Grant origin permission for WebRTC media streams
                        request.grant(request.getResources());
                    });
                }
            });
        }
    }
}
