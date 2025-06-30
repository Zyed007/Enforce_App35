import React from 'react';
import {
  Platform,
  NativeModules,
  NativeEventEmitter,
  PermissionsAndroid,
} from 'react-native';
import AndroidGeolocation from './AndroidGeolocation';
import { getData, storeData, LocalDBItems } from '../../Services/LocalStorage';
import UtilityHelper from '../../Components/UtilityHelper';
import Geolocation from 'react-native-geolocation-service';
import { requestMultiple, PERMISSIONS } from 'react-native-permissions';

//const { MyLocationDataManager } = NativeModules;

// const locationChangedEmitter = MyLocationDataManager
//   ? new NativeEventEmitter(MyLocationDataManager)
//   : null;
class LocationFetcher extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      locationPermissionGranted: false,
      isBackgroundLocation: false,
      latitude: 0.0,
      longitude: 0.0,
      isInitialLoad: true,
    };
    this.watchId = null;
    this.locationListner = null;
    this.previousTimeStamp = new Date();

    if (Platform.OS === 'android') {
      this.checkLocationPermissionsAndroid();
    } else {
      this.checkLocationForIos();
    }
  }

  componentDidMount() {
    this.fetchLocationDetails();
  }

  fetchLocationDetails = () => {
    console.log('[LocationFetcher] fetchLocationDetails triggered');
    if (Platform.OS === 'android') {
      this.locationUpdateForAndroid();
    } else {
      this.checkLocationForIos();
    }
  };

  removeLocationUpdate() {
    if (Platform.OS === 'android') {
      console.log('[LocationFetcher] removeLocationUpdate called');
      AndroidGeolocation?.stopLocationUpdates?.();
    }
  }



  checkLocationForIos = async () => {
  console.log('[iOS] Requesting location permissionss...');

  const statuses = await requestMultiple([
    PERMISSIONS.IOS.LOCATION_WHEN_IN_USE,
    PERMISSIONS.IOS.LOCATION_ALWAYS,
  ]);

  console.log('[iOS] Permission statuses:', statuses);

  const whenInUse = statuses[PERMISSIONS.IOS.LOCATION_WHEN_IN_USE];
  const always = statuses[PERMISSIONS.IOS.LOCATION_ALWAYS];

  if (whenInUse === RESULTS.GRANTED || always === RESULTS.GRANTED) {
    console.log('[iOS] Location permission granted');

    this.setState({ locationPermissionGranted: true }, () => {
  this.watchId = Geolocation.watchPosition(
    async (e) => {
      console.log('[iOS] Location update received:', e);
      const locationLocalObj = {
        latitude: e.coords.latitude,
        longitude: e.coords.longitude,
        speed: Number(e.coords.speed * 3.6),
        timeStamp: e.timestamp,
      };

      console.log('[iOS] Processed location object:', locationLocalObj);

      let difference = (new Date().getTime() - this.previousTimeStamp.getTime()) / 1000;
      this.state.isInitialLoad = this.props.isInitialLoad;

      if (difference > 20 || this.state.isInitialLoad) {
        console.log('[iOS] Enough time passed or initial load, updating...');
        this.state.isInitialLoad = false;
        this.previousTimeStamp = new Date();

        this.processLocation(locationLocalObj);

        if (this.props.getLocationForTracking) {
          console.log('[iOS] Calling getLocationForTracking prop');
          this.props.getLocationForTracking(locationLocalObj);
        }
      } else {
        console.log('[iOS] Skipping update - not enough time passed');
      }
    },
    (error) => {
      console.warn('[iOS] Location error:', error);
    },
    {
      enableHighAccuracy: true,
      distanceFilter: 10,
      interval: 10000,
      fastestInterval: 5000,
      showsBackgroundLocationIndicator: true,
    }
  );
 });

    // Geolocation.watchPosition(
    //   async (e) => {
    //     console.log('[iOS] Location update received:', e);

    //     const locationLocalObj = {
    //       latitude: e.coords.latitude,
    //       longitude: e.coords.longitude,
    //       speed: Number(e.coords.speed * 3.6),
    //       timeStamp: e.timestamp,
    //     };

    //     console.log('[iOS] Processed location object:', locationLocalObj);

    //     let difference = (new Date().getTime() - this.previousTimeStamp.getTime()) / 1000;
    //     this.state.isInitialLoad = this.props.isInitialLoad;

    //     if (difference > 20 || this.state.isInitialLoad) {
    //       console.log('[iOS] Enough time passed or initial load, updating...');
    //       this.state.isInitialLoad = false;
    //       this.previousTimeStamp = new Date();

    //       this.processLocation(locationLocalObj);

    //       if (this.props.getLocationForTracking) {
    //         console.log('[iOS] Calling getLocationForTracking prop');
    //         this.props.getLocationForTracking(locationLocalObj);
    //       }
    //     } else {
    //       console.log('[iOS] Skipping update - not enough time passed');
    //     }
    //   },
    //   (error) => {
    //     console.warn('[iOS] Location error:', error);
    //   },
    //   {
    //     enableHighAccuracy: true,
    //     distanceFilter: 10,
    //     interval: 10000,
    //     fastestInterval: 5000,
    //     showsBackgroundLocationIndicator: true,
    //   }
    // );

    console.log('[iOS] Location watch started');
  } else {
    console.warn('[iOS] Location permission not granted:', { whenInUse, always });
  }
  };


  checkLocationPermissionsAndroid = async () => {
    try {
      console.log('[Android] Requesting location permissions...');
      const statuses = await requestMultiple([
        PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
        PERMISSIONS.ANDROID.ACCESS_COARSE_LOCATION,
      ]);

      console.log('[Android] Permission statuses:', statuses);

      const fineStatus = statuses[PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION];
      const coarseStatus = statuses[PERMISSIONS.ANDROID.ACCESS_COARSE_LOCATION];

      if (fineStatus === 'granted') {
        console.log('[Android] Fine location permission granted');
        AndroidGeolocation?.startLocationUpdates?.();
        this.setState({ locationPermissionGranted: true });

        if (coarseStatus === 'blocked' || coarseStatus === 'denied') {
          console.warn('[Android] Coarse permission blocked or denied');
          this.removeListners();
          this.removeLocationUpdate();
          this.setState({ isBackgroundLocation: true });
        }
      } else {
        console.warn('[Android] Fine location permission not granted');
      }
    } catch (error) {
      console.error('[Android] Permission error:', error);
    }
  };

  locationUpdateForAndroid = async () => {
    const AndroidGeoEmitter = NativeModules.AndroidGeolocation
      ? new NativeEventEmitter(NativeModules.AndroidGeolocation)
      : null;

    if (!AndroidGeoEmitter) {
      console.warn('[Android] AndroidGeolocation Native Module not available');
      return;
    }

    const isAuthenticated = await getData(LocalDBItems.isUserAuthenticated);
    if (!isAuthenticated) {
      console.warn('[Android] User not authenticated');
      return;
    }

    console.log('[Android] Getting current position via Geolocation');
    Geolocation.getCurrentPosition(
      async (position) => {
        console.log('[Android] Got current position:', position);
        const locationObj = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          speed: Number(position.coords.speed * 3.6),
          timeStamp: position.timestamp,
        };
        this.handleLocationEvent(locationObj);
      },
      (error) => {
        console.error('[Android] Geolocation error:', error);
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 0,
        interval: 5000,
        fastestInterval: 2000,
      }
    );

    this.locationListner = AndroidGeoEmitter.addListener(
      'significantLocationChange',
      async (event) => {
        console.log('[Android] Received significantLocationChange event:', event);
        const locationObj = {
          latitude: event.latitude,
          longitude: event.longitude,
          speed: Number(event.speed * 3.6),
          timeStamp: event.timeStamp,
        };
        this.handleLocationEvent(locationObj);
      }
    );
  };

  handleLocationEvent = async (locationObj) => {
    console.log('[LocationFetcher] handleLocationEvent called with:', locationObj);

     if (
    !locationObj ||
    locationObj.latitude === 0 ||
    locationObj.longitude === 0
  ) {
    console.warn('[LocationFetcher] Ignored invalid Android location:', locationObj);
    return;
  }




    const isAuthenticated = await getData(LocalDBItems.isUserAuthenticated);
    if (!isAuthenticated) {
      console.warn('[LocationFetcher] Skipping update, user not authenticated');
      return;
    }

    const prevLocation = await getData(LocalDBItems.location);
    const timeDiff = (new Date().getTime() - this.previousTimeStamp.getTime()) / 1000;

    let distance = 0;
    if (prevLocation) {
      distance = UtilityHelper.calcDistance(prevLocation, locationObj);
      console.log(`[LocationFetcher] Distance from last location: ${distance} meters`);
    }

    const isInRadius = await this.isLocationInRadius();
    this.props.isInRadiusOrNot?.(isInRadius);

    if (distance > 10 || this.state.isInitialLoad) {
      console.log('[LocationFetcher] Location updated due to significant movement or initial load');
      this.props.getLocationForTracking?.(locationObj);
      this.saveLocation(locationObj);
    }

    if ((timeDiff > 60 && distance > 250) || this.state.isInitialLoad) {
      console.log('[LocationFetcher] Location saved due to time/distance threshold or initial load');
      await storeData(LocalDBItems.location, locationObj);
      this.setState({ isInitialLoad: false });
      this.previousTimeStamp = new Date();
      this.processLocation(locationObj);
    }
  };

  processLocation = async (location) => {
  console.log('[LocationFetcher] Processing location:', location);

  // ✅ Skip if lat/lng is 0
  if (
    !location ||
    typeof location.latitude !== 'number' ||
    typeof location.longitude !== 'number' ||
    location.latitude === 0 ||
    location.longitude === 0
  ) {
    console.warn('[LocationFetcher] Skipping invalid location:', location);
    return;
  }

  await storeData(LocalDBItems.location, location);
  this.props.getLocation?.(location);
};

  saveLocation = async (location) => {
    const locationArray = (await getData(LocalDBItems.locationArray)) || [];
    locationArray.push(location);
    await storeData(LocalDBItems.locationArray, locationArray);
    console.log('[LocationFetcher] Location appended to array');
  };

isLocationInRadius = async () => {
  try {
    console.log('[LocationFetcher] Checking if location is within radius...');
    
    // 1. Get office location from storage
    const organisationDetails = await getData(LocalDBItems.organizationDetails);
    
    if (!organisationDetails?.entityLocation) {
      console.warn('[LocationFetcher] No office location found in organization details');
      return false;
    }

    // 2. Get current location - handle platform differences
    let currentLocation;
    if (Platform.OS === 'android') {
      currentLocation = await getData(LocalDBItems.location);
    } else {
      // For iOS, get fresh location since background updates might be delayed
      currentLocation = await new Promise((resolve) => {
        Geolocation.getCurrentPosition(
          (position) => resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          }),
          (error) => {
            console.warn('[iOS] Error getting current position:', error);
            resolve(null);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      });
    }

    if (!currentLocation) {
      console.warn('[LocationFetcher] No current location available');
      return false;
    }

    // 3. Extract and validate coordinates
    const officeLat = parseFloat(organisationDetails.entityLocation.lat);
    const officeLng = parseFloat(organisationDetails.entityLocation.lang);
    const currentLat = parseFloat(currentLocation.latitude);
    const currentLng = parseFloat(currentLocation.longitude);

    if (isNaN(officeLat) || isNaN(officeLng) || isNaN(currentLat) || isNaN(currentLng)) {
      console.warn('[LocationFetcher] Invalid coordinates:', {
        officeLat, officeLng, currentLat, currentLng
      });
      return false;
    }

    // 4. Calculate distance in meters
    const distance = UtilityHelper.calcDistance(
      { latitude: officeLat, longitude: officeLng },
      { latitude: currentLat, longitude: currentLng }
    );

    // 5. Define allowed radius (100 meters default)
    const allowedRadius = organisationDetails.allowedRadius || 500; // meters

    console.log(`[LocationFetcher] Distance check - Office: ${officeLat},${officeLng} | Current: ${currentLat},${currentLng} | Distance: ${distance}m (Allowed: ${allowedRadius}m)`);
    
    // 6. Return true if within radius (with 10% buffer for GPS inaccuracy)
    return distance <= (allowedRadius * 1.1);
    
  } catch (error) {
    console.error('[LocationFetcher] Error in isLocationInRadius:', error);
    return false;
  }
};

  removeListners = () => {
    console.log('[LocationFetcher] Removing listeners...');
    this.locationListner?.remove();
  };

  componentWillUnmount() {
  if (this.watchId != null) {
    Geolocation.clearWatch(this.watchId);
  }
  this.removeLocationUpdate();
  this.removeListners();
}

getCurrentRadiusStatus = async () => {
  return await this.isLocationInRadius();
};
  render() {
    return null;
  }
}

export default LocationFetcher;
