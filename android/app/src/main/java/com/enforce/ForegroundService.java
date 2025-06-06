package com.enforcesolutions;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.location.Location;
import android.os.Build;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.WritableMap;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.tasks.OnSuccessListener;

public class ForegroundService extends Service {
    private static final int NOTIFICATION_ID = 2020;
    private static final String CHANNEL_ID = "LocationServiceChannelId";
    private static final int PENDING_INTENT_FLAGS = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M 
        ? PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT 
        : PendingIntent.FLAG_UPDATE_CURRENT;

    private LocationRequest locationRequest;
    private FusedLocationProviderClient fusedLocationClient;
    private LocationCallback locationCallback;
    private Context context;
    public static ReactApplicationContext reactContext;

    @Override
    public void onCreate() {
        super.onCreate();
        context = this;
        createNotificationChannel();
        
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                0, 
                notificationIntent, 
                PENDING_INTENT_FLAGS
        );

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Location service running")
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentIntent(pendingIntent)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();

        startForeground(NOTIFICATION_ID, notification);
        initValues();
        Log.d("ForegroundService", "Service started");
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel serviceChannel = new NotificationChannel(
                    CHANNEL_ID,
                    "Location Service Channel",
                    NotificationManager.IMPORTANCE_LOW
            );
            serviceChannel.enableVibration(false);
            serviceChannel.setDescription("Channel for location tracking service");

            NotificationManager manager = getSystemService(NotificationManager.class);
            manager.createNotificationChannel(serviceChannel);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        stopLocationUpdates();
        stopForeground(true);
        Log.d("ForegroundService", "Service destroyed");
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void initValues() {
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(MainActivity.sampleContext);

        fusedLocationClient.getLastLocation().addOnSuccessListener(
                new OnSuccessListener<Location>() {
                    @Override
                    public void onSuccess(Location location) {
                        if (location != null) {
                            Log.d("ForegroundService", "Last location retrieved");
                        }
                    }
                }
        );

        if (locationRequest == null && locationCallback == null) {
            locationCallback = new LocationCallback() {
                @Override
                public void onLocationResult(LocationResult locationResult) {
                    if (locationResult == null) {
                        return;
                    }
                    Location lastLocation = locationResult.getLastLocation();
                    if (lastLocation != null && lastLocation.hasAccuracy() && lastLocation.getAccuracy() < 70) {
                        WritableMap params = Arguments.createMap();
                        params.putDouble("latitude", lastLocation.getLatitude());
                        params.putDouble("longitude", lastLocation.getLongitude());
                        params.putDouble("accuracy", lastLocation.getAccuracy());
                        params.putDouble("speed", lastLocation.getSpeed());
                        params.putDouble("timeStamp", lastLocation.getTime());
                        params.putBoolean("isMockedLocation", lastLocation.isFromMockProvider());
                        Log.d("LocationUpdate", "Mocked: " + lastLocation.isFromMockProvider());
                        MyDataLocationManager.getInstance().sendEvent(reactContext, "significantLocationChange", params);
                    }
                }
            };
            createLocationRequest();
        }
    }

    private void stopLocationUpdates() {
        if (fusedLocationClient != null && locationCallback != null) {
            fusedLocationClient.removeLocationUpdates(locationCallback);
            Log.d("ForegroundService", "Location updates stopped");
        }
    }

    private void createLocationRequest() {
        locationRequest = LocationRequest.create();
        locationRequest.setInterval(5000);
        locationRequest.setFastestInterval(5000);
        locationRequest.setPriority(LocationRequest.PRIORITY_HIGH_ACCURACY);

        try {
            fusedLocationClient.requestLocationUpdates(
                    locationRequest,
                    locationCallback,
                    Looper.getMainLooper()
            );
            Log.d("ForegroundService", "Location updates started");
        } catch (SecurityException e) {
            Log.e("ForegroundService", "Lost location permission: " + e);
        }
    }
}