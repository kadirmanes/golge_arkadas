package com.golgearkadas.app;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;

public class MainActivity extends BridgeActivity {

    private static final int CAMERA_AUDIO_PERMISSION_REQUEST = 1001;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createNotificationChannels();
        requestCameraAndAudioPermissions();

        // WebView'dan gelen kamera/mikrofon izin isteklerini otomatik onayla
        // (getUserMedia çağrısı için WebChromeClient.onPermissionRequest gerekli)
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().setWebChromeClient(new BridgeWebChromeClient(getBridge()) {
                @Override
                public void onPermissionRequest(final PermissionRequest request) {
                    runOnUiThread(() -> request.grant(request.getResources()));
                }
            });
        }
    }

    // Kamera ve mikrofon izinlerini uygulama açılışında iste
    private void requestCameraAndAudioPermissions() {
        String[] permissions = new String[]{
            Manifest.permission.CAMERA,
            Manifest.permission.RECORD_AUDIO,
        };
        boolean allGranted = true;
        for (String perm : permissions) {
            if (ContextCompat.checkSelfPermission(this, perm) != PackageManager.PERMISSION_GRANTED) {
                allGranted = false;
                break;
            }
        }
        if (!allGranted) {
            ActivityCompat.requestPermissions(this, permissions, CAMERA_AUDIO_PERMISSION_REQUEST);
        }
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);

            NotificationChannel emergency = new NotificationChannel(
                "emergency-alarm",
                "Acil Durum Alarmı",
                NotificationManager.IMPORTANCE_HIGH
            );
            emergency.setDescription("Gölge Arkadaş acil durum bildirimleri");
            emergency.enableVibration(true);
            emergency.setVibrationPattern(new long[]{0, 500, 200, 500, 200, 500});
            emergency.setShowBadge(true);
            emergency.setBypassDnd(true);
            AudioAttributes audioAttr = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
            emergency.setSound(
                Uri.parse("android.resource://" + getPackageName() + "/raw/alarm"),
                audioAttr
            );
            nm.createNotificationChannel(emergency);

            NotificationChannel normal = new NotificationChannel(
                "default",
                "Genel Bildirimler",
                NotificationManager.IMPORTANCE_DEFAULT
            );
            normal.setDescription("Genel uygulama bildirimleri");
            nm.createNotificationChannel(normal);
        }
    }
}
