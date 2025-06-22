import { check, request, checkMultiple, PERMISSIONS, RESULTS } from "react-native-permissions";
import { Platform } from "react-native";

const permissionsConfig = {
  ios: {
    camera: PERMISSIONS.IOS.CAMERA,
    location: [
      PERMISSIONS.IOS.LOCATION_WHEN_IN_USE,
      PERMISSIONS.IOS.LOCATION_ALWAYS
    ]
  },
  android: {
    camera: PERMISSIONS.ANDROID.CAMERA,
    location: [
      PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
      PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION
    ]
  }
};

export async function checkPermissionStatus(permission) {
  try {
    const status = await check(permission);
    return {
      permission,
      status,
      isGranted: status === RESULTS.GRANTED
    };
  } catch (error) {
    console.error(`Error checking ${permission}:`, error);
    return {
      permission,
      status: RESULTS.UNAVAILABLE,
      isGranted: false
    };
  }
}

export async function requestPermission(permission) {
  try {
    const status = await request(permission);
    return {
      permission,
      status,
      isGranted: status === RESULTS.GRANTED
    };
  } catch (error) {
    console.error(`Error requesting ${permission}:`, error);
    return {
      permission,
      status: RESULTS.BLOCKED,
      isGranted: false
    };
  }
}

// Check camera permission
export async function isCameraPermisonGranted() {
  const permission = Platform.select(permissionsConfig).camera;
  return checkPermissionStatus(permission);
}

// Check location permission
export async function isLocationPermisonGranted() {
  const platformPermissions = Platform.select(permissionsConfig).location;
  const statuses = await checkMultiple(platformPermissions);

  const isGranted = Object.values(statuses).some(
    status => status === RESULTS.GRANTED
  );

  return {
    permissions: platformPermissions,
    statuses,
    isGranted
  };
}

// Recheck location status (used in `checkAllPermison`)
export async function checkLocationPermission() {
  return isLocationPermisonGranted();
}

// Request camera permission
export async function requestCameraPermission() {
  const permission = Platform.select(permissionsConfig).camera;
  return requestPermission(permission);
}

// Request location permission
export async function requestLocationPermission() {
  if (Platform.OS === 'ios') {
    const whenInUse = await requestPermission(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);

    // Optional: You can try requesting ALWAYS later after WHEN_IN_USE
    if (whenInUse.isGranted) {
      return whenInUse;
    }

    // fallback attempt if needed (optional)
    return requestPermission(PERMISSIONS.IOS.LOCATION_ALWAYS);
  } else {
    // Android: request fine first, then background
    const fine = await requestPermission(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
    if (fine.isGranted) {
      const bg = await requestPermission(PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION);
      return {
        permissions: [PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION, PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION],
        isGranted: bg.isGranted
      };
    }
    return fine;
  }
}

// Check both permissions
export async function checkAllPermison() {
  const [camera, location] = await Promise.all([
    isCameraPermisonGranted(),
    isLocationPermisonGranted()
  ]);

  return {
    camera,
    location,
    allGranted: camera.isGranted && location.isGranted
  };
}
