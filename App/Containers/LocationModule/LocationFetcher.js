import React from 'react';
import {
  Platform,
  NativeModules,
  NativeEventEmitter,
  PermissionsAndroid,
  Alert,
} from 'react-native';
import AndroidGeolocation from './AndroidGeolocation';
import { getData, storeData, LocalDBItems } from '../../Services/LocalStorage';
import UtilityHelper from '../../Components/UtilityHelper';
import Geolocation from 'react-native-geolocation-service';
import { requestMultiple, PERMISSIONS } from 'react-native-permissions';

const { MyLocationDataManager } = NativeModules;

// Safely create the emitter only if module exists
const locationChangedEmitter = MyLocationDataManager
  ? new NativeEventEmitter(MyLocationDataManager)
  : null;

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
    if (Platform.OS === 'android') {
      this.locationUpdateForAndroid();
    } else {
      this.checkLocationForIos();
    }
  };

  removeLocationUpdate() {
    if (Platform.OS === 'android') {
      AndroidGeolocation?.stopLocationUpdates?.();
    }
  }

  checkLocationForIos = async () => {
    try {
      const statuses = await requestMultiple([
        PERMISSIONS.IOS.LOCATION_ALWAYS,
        PERMISSIONS.IOS.LOCATION_WHEN_IN_USE,
      ]);

      const status = statuses[PERMISSIONS.IOS.LOCATION_ALWAYS];
      if (status === 'granted' && locationChangedEmitter) {
        const subscription = locationChangedEmitter.addListener(
          'significantLocationChange',
          (event) => {
            const locationLocalObj = {
              latitude: event.coords.latitude,
              longitude: event.coords.longitude,
            };
            this.handleLocationEvent(locationLocalObj);
          }
        );
        this.locationListner = subscription;
      } else {
        console.warn('Location permission or Native Module not available on iOS');
      }
    } catch (error) {
      console.error('iOS permission error:', error);
    }
  };

  checkLocationPermissionsAndroid = async () => {
    try {
      const statuses = await requestMultiple([
        PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
        PERMISSIONS.ANDROID.ACCESS_COARSE_LOCATION,
      ]);

      const fineStatus = statuses[PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION];
      const coarseStatus = statuses[PERMISSIONS.ANDROID.ACCESS_COARSE_LOCATION];

      if (fineStatus === 'granted') {
        AndroidGeolocation?.startLocationUpdates?.();
        this.setState({ locationPermissionGranted: true });

        if (coarseStatus === 'blocked' || coarseStatus === 'denied') {
          this.removeListners();
          this.removeLocationUpdate();
          this.setState({ isBackgroundLocation: true });
        }
      } else {
        console.warn('Fine location permission not granted');
      }
    } catch (error) {
      console.error('Android permission error:', error);
    }
  };

  locationUpdateForAndroid = async () => {
    const AndroidGeoEmitter = NativeModules.AndroidGeolocation
      ? new NativeEventEmitter(NativeModules.AndroidGeolocation)
      : null;

    if (!AndroidGeoEmitter) {
      console.warn('AndroidGeolocation Native Module is not available');
      return;
    }

    const isAuthenticated = await getData(LocalDBItems.isUserAuthenticated);
    if (!isAuthenticated) return;

    Geolocation.getCurrentPosition(
      async (position) => {
        const locationObj = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          speed: Number(position.coords.speed * 3.6),
          timeStamp: position.timestamp,
        };
        this.handleLocationEvent(locationObj);
      },
      (error) => {
        console.error('Geolocation error:', error);
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 0,
        interval: 5000,
        fastestInterval: 2000,
      }
    );

    // Event listener
    this.locationListner = AndroidGeoEmitter.addListener(
      'significantLocationChange',
      async (event) => {
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
    const isAuthenticated = await getData(LocalDBItems.isUserAuthenticated);
    if (!isAuthenticated) return;

    if (this.state.isInitialLoad) {
      await storeData(LocalDBItems.location, locationObj);
    }

    const previousLocation = await getData(LocalDBItems.location);
    const timeDiff = (new Date().getTime() - this.previousTimeStamp.getTime()) / 1000;
    let distance = 0;

    if (previousLocation) {
      distance = UtilityHelper.calcDistance(previousLocation, locationObj);
    }

    const isInRadius = await this.isLocationInRadius();
    this.props.isInRadiusOrNot?.(isInRadius);

    if (distance > 10 || this.state.isInitialLoad) {
      this.props.getLocationForTracking?.(locationObj);
      this.saveLocation(locationObj);
    }

    if ((timeDiff > 60 && distance > 250) || this.state.isInitialLoad) {
      await storeData(LocalDBItems.location, locationObj);
      this.setState({ isInitialLoad: false });
      this.previousTimeStamp = new Date();
      this.processLocation(locationObj);
    }
  };

  processLocation = async (location) => {
    await storeData(LocalDBItems.location, location);
    this.props.getLocation?.(location);
  };

  saveLocation = async (location) => {
    const locationArray = (await getData(LocalDBItems.locationArray)) || [];
    locationArray.push(location);
    await storeData(LocalDBItems.locationArray, locationArray);
  };

  isLocationInRadius = async () => {
    // You can reuse your logic from your full code here
    return true;
  };

  removeListners = () => {
    this.locationListner?.remove();
  };

  render() {
    return null;
  }
}

export default LocationFetcher;
