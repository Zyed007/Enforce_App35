import React, { Component } from 'react';
import {
  View,
  StyleSheet,
  TouchableHighlight,
  NativeModules,
  Text,
  DeviceEventEmitter,
  NativeEventEmitter,
  Platform,
} from 'react-native';
import AndroidGeolocation from './AndroidGeolocation';
import UtilityHelper from '../../Components/UtilityHelper'
import { getData, LocalDBItems, storeData, wipeData } from '../../Services/LocalStorage'
import {
  check,
  PERMISSIONS,
  RESULTS,
  requestMultiple,
} from 'react-native-permissions';
 
import Geolocation from 'react-native-geolocation-service';
 
const regularJobKey = 'regularJobKey';
const exactJobKey = 'exactJobKey';
const foregroundJobKey = 'foregroundJobKey';
 
// Safe access to native modules - only available on Android
const MyLocationDataManager = Platform.OS === 'android' ? NativeModules.MyLocationDataManager : null;
const locationChangedEmitter = MyLocationDataManager ? new NativeEventEmitter(MyLocationDataManager) : null;
 
/**
* Class to handle the location functions
* Added native location library component
* Events will be triggered to this class once its initialized
* Diffrent location related fucntions added
*/
 
class LocationFetcher extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      locationPermissionGranted: false,
      isBackgroundLocation: false,
      latitude: 0.0,
      longitude: 0.0,
      isInitialLoad: true
    };
    this.locationListner = null
    this.watchId = null;
    this.previousTimeStamp = new Date()
    if (Platform.OS === "android") {
      this.checkLocationPermissionsAndroid();
    } else {
      this.checkLocationPermissionsIos();
    }
  }
 
  /**
* To remove the location update from the memory
*/
  removeLocationUpdate() {
    if (Platform.OS == 'android') {
      AndroidGeolocation.stopLocationUpdates();
    } else {
      // For iOS, we need to stop the location updates
      if (this.watchId) {
        Geolocation.clearWatch(this.watchId);
        this.watchId = null;
      }
      if (this.locationListner) {
        this.locationListner.remove();
        this.locationListner = null;
      }
    }
  }
  
  /**
* To request location permission for ios
*/
  checkLocationPermissionsIos = async () => {
    try {
      const statuses = await requestMultiple([
        PERMISSIONS.IOS.LOCATION_ALWAYS,
        PERMISSIONS.IOS.LOCATION_WHEN_IN_USE,
      ]);
      
      const alwaysStatus = statuses[PERMISSIONS.IOS.LOCATION_ALWAYS];
      const whenInUseStatus = statuses[PERMISSIONS.IOS.LOCATION_WHEN_IN_USE];
      
      console.log("iOS Location Always Status:", alwaysStatus);
      console.log("iOS Location WhenInUse Status:", whenInUseStatus);
      
      if (alwaysStatus === "granted" || whenInUseStatus === "granted") {
        this.setState({
          locationPermissionGranted: true,
        });
        
        // Start location updates for iOS
        this.startIosLocationUpdates();
        
        if (alwaysStatus !== "granted") {
          this.setState({isBackgroundLocation: true});
        }
      }
    } catch (error) {
      console.log("Error requesting iOS location permissions:", error);
    }
  };
 
  /**
* To request location permission for android
*/
  checkLocationPermissionsAndroid = async () => {
    const granted = await requestMultiple([
      PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
      PERMISSIONS.ANDROID.ACCESS_COARSE_LOCATION
    ]).then((statuses) => {
      let status = statuses[PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION];
      let bgstatus = statuses[PERMISSIONS.ANDROID.ACCESS_COARSE_LOCATION]
      console.log("Fine Location",status);
      console.log("Background Location",bgstatus);
      console.log(status, "gRANTED");
      if (status === "granted") {
        AndroidGeolocation.startLocationUpdates();
        this.setState({
          locationPermissionGranted: true,
        });
        if(bgstatus === "blocked" || bgstatus === "denied")
        {
          this.removeListners();
          this.removeLocationUpdate();
          this.setState({isBackgroundLocation : true});
        }
      }
    });
  };
 
  /**
* Start iOS location updates
*/
  startIosLocationUpdates = () => {
    // For iOS, we use react-native-geolocation-service
    this.watchId = Geolocation.watchPosition(
      async (position) => {
        this.handleLocationUpdate(position);
      },
      (error) => {
        console.log("iOS Location Error:", error);
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 0,
        interval: 5000,
        fastestInterval: 2000,
        useSignificantChanges: false
      }
    );
  };
  
  /**
* Handle location update for both platforms
*/
  handleLocationUpdate = async (e) => {
    let locationLocalObj = {
      latitude: e.coords.latitude,
      longitude: e.coords.longitude,
      speed: Number(e.coords.speed * 3.6),
      timeStamp: e.timestamp,
    };
    
    let isAuthenitcated = await getData(LocalDBItems.isUserAuthenticated);
    
    if (isAuthenitcated) {
      if (this.state.isInitialLoad) {
        await storeData(LocalDBItems.location, locationLocalObj);
      }
      
      let difference = (new Date().getTime() - this.previousTimeStamp.getTime()) / 1000;
      let previusLocation = await getData(LocalDBItems.location);
      let distance = 0;
      
      if (previusLocation) {
        distance = UtilityHelper.calcDistance(previusLocation, locationLocalObj);
      }
      
      let isinRadiusObj = await this.isLocationInRadius();
      if (this.props.isInRadiusOrNot) {
        this.props.isInRadiusOrNot(isinRadiusObj);
      }
      
      if ((distance > 10) || this.state.isInitialLoad) {
        console.log('***  There is a change of 10 meters  ***');
        if ("getLocationForTracking" in this.props) {
          this.props.getLocationForTracking(locationLocalObj);
          this.saveLocation(locationLocalObj);
        }
      }
      
      if ((difference > 60 && distance > 250) || this.state.isInitialLoad) {
        await storeData(LocalDBItems.location, locationLocalObj);
        this.state.isInitialLoad = false;
        this.previousTimeStamp = new Date();
        this.processLocation(locationLocalObj);
      }
    }
  };
 
  /**
* Called when component loads to memory
*/
  componentDidMount() {
    this.fetchLocationDetails();
  }

  /**
   * Method to fetch location details
   */
  fetchLocationDetails = () => {
    if (Platform.OS === "android") {
      this.locationUpdateForAndroid();
    } else {
      this.locationUpdateForIos();
    }
  };
 
 
  /**
   * Method to get location details for android
   */
  locationUpdateForAndroid = async () => {
    if (!MyLocationDataManager) return;
    
    const eventEmitter = new NativeEventEmitter(MyLocationDataManager);
     
    let isAuthenitcated = await getData(LocalDBItems.isUserAuthenticated);
   
    if(isAuthenitcated) {
      // Get initial position
      Geolocation.getCurrentPosition(
        async (e) => {
          this.handleLocationUpdate(e);
        },
        (error) => {
          console.log(error);
        },
        { enableHighAccuracy: true, distanceFilter: 0, interval: 5000, fastestInterval: 2000 }
      );
    }
     
    this.locationListner = eventEmitter.addListener("significantLocationChange", async (e) => {
      // Convert Android native event to compatible format
      const locationEvent = {
        coords: {
          latitude: e.latitude,
          longitude: e.longitude,
          speed: e.speed,
          accuracy: e.accuracy,
          altitude: e.altitude,
          heading: e.heading
        },
        timestamp: e.timeStamp
      };
      this.handleLocationUpdate(locationEvent);
    });
  };
  
  /**
   * Method to get location details for iOS
   */
  locationUpdateForIos = async () => {
    let isAuthenitcated = await getData(LocalDBItems.isUserAuthenticated);
    
    if (isAuthenitcated) {
      // Get initial position
      Geolocation.getCurrentPosition(
        async (position) => {
          this.handleLocationUpdate(position);
        },
        (error) => {
          console.log("iOS Initial Location Error:", error);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );
      
      // Start watching position for continuous updates
      this.watchId = Geolocation.watchPosition( 
        async (position) => {
          this.handleLocationUpdate(position);
        },
        (error) => {
          console.log("iOS Watch Position Error:", error);
        },
        {
          enableHighAccuracy: true,
          distanceFilter: 10, // 10 meters
          interval: 5000,
          fastestInterval: 2000,
          useSignificantChanges: false
        }
      );
    }
  };
 
  /**
 * Method to remove location listners
 */
  removeListners = () => {
    if (this.locationListner) {
      this.locationListner.remove();
      this.locationListner = null;
    }
    
    if (this.watchId) {
      Geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }
 
  /**
* Method to add location listners
*/
  addListnerForFetching() {
    this.removeListners();
    if (Platform.OS === "android") {
      this.locationUpdateForAndroid();
    } else {
      this.locationUpdateForIos();
    }
  }
 
  /**
* Method to process location
* First location lastest coordinate will be stored to memory
* Then props function from parent class wiil be called
*/
  processLocation = async (location) => {
    await storeData(LocalDBItems.location, location);
    if (this.props.getLocation) {
      this.props.getLocation(location);
    }
  }
 
  /**
* Method to check the location is in radius
* Fetch the origanization details from storage
* fetch the project details from the storage
* Fetch the check in details of the user.
* Find out the centeer point and radius information from the function findCenterPontAndRadius
* Fetch the lastes location objct from teh DB
* Calculated whether the user is in radous or not
*/
  isLocationInRadius = async (location, centerPont) => {
    console.log("Checking if you are inside location radius or not.....")
    const organisationDetails = await getData(LocalDBItems.organizationDetails);
     //console.log("organisationDetails",organisationDetails)

    const projectDetails = await getData(LocalDBItems.selectedProjectDetails);
     //console.log("projectDetails",projectDetails)
 
    let checkinInfo = await getData(LocalDBItems.checkInInfo);
   // console.log("checkinInfo",checkinInfo)
 
    let positionInfo = await this.findCenterPontAndRadius();
    //console.log("positionInfo",positionInfo)
 
    let locationObjFromDb = await getData(LocalDBItems.location);
    //console.log("locationObjFromDb",locationObjFromDb)
    
 
    let locationObj = { latitude: locationObjFromDb.latitude, longitude: locationObjFromDb.longitude };
   // console.log("locationObj",locationObj)
 
    let centerPontobj = positionInfo.centerPontobj;
    //console.log("centerPontobj",centerPontobj)
 
    let radius = positionInfo.radius;
    //console.log("radius",radius)
 
    if (checkinInfo && checkinInfo.isProjectCheckin === true) {
      if (projectDetails && projectDetails.entityLocation != null) {
        return UtilityHelper.isLocationWithinTheRadius(locationObj, centerPontobj, radius);
      }
      return true;
    }
 
    if (organisationDetails && organisationDetails.entityLocation) {
      let isInRadius = UtilityHelper.isLocationWithinTheRadius(locationObj, centerPontobj, radius);
      return isInRadius;
    }
    return true;
  }
  
  /**
 * Method to find the center point and radius
 * Fetch the origanization details from storage
 * fetch the project details from the storage
 * check the isProjectCheckin flag
 * findout the radius from the entityLocation
 * return the object
 */
  findCenterPontAndRadius = async () => {
    const organisationDetails = await getData(LocalDBItems.organizationDetails);
    const projectDetails = await getData(LocalDBItems.selectedProjectDetails);
 
    let checkinInfo = await getData(LocalDBItems.checkInInfo);
 
    let centerPontobj = { latitude: 0.0, longitude: 0.0 };
    let radius = 200;
    let objct = {
      centerPontobj: centerPontobj,
      radius: radius
    };
 
    if (checkinInfo && checkinInfo.isProjectCheckin === true) {
      if (projectDetails && projectDetails.entityLocation != null) {
        if (projectDetails.entityLocationRadius) {
          radius = parseFloat(projectDetails.entityLocationRadius.radius == "" ? '200' : projectDetails.entityLocationRadius.radius);
        }
 
        objct = {
          centerPontobj: { latitude: parseFloat(projectDetails.entityLocation.lat), longitude: parseFloat(projectDetails.entityLocation.lang) },
          radius: radius
        };
 
        return objct;
      }
    }
    
    if (organisationDetails && organisationDetails.entityLocation) {
      if (organisationDetails.entityLocationRadius) {
        radius = parseFloat(organisationDetails.entityLocationRadius.radius == "" ? '200' : organisationDetails.entityLocationRadius.radius);
      }
      objct = {
        centerPontobj: { latitude: parseFloat(organisationDetails.entityLocation.lat), longitude: parseFloat(organisationDetails.entityLocation.lang) },
        radius: radius
      };
      return objct;
    }
    
    return objct;
  }
  
  /**
  * Method to save location to the db
  */
  saveLocation = async (location) => {
    let previusLocation = await getData(LocalDBItems.location);
    let previusLocationArray = await getData(LocalDBItems.locationArray);
    let locationArray = previusLocationArray ? previusLocationArray : [];
 
    if (previusLocation) {
      locationArray.push(location);
      await this.storeDataToDb(location, locationArray);
    } else {
      locationArray.push(location);
      await this.storeDataToDb(location, locationArray);
    }
  }
  
  /**
 * Method to save location to the db
 */
  storeDataToDb = async (location, locationArray) => {
    await storeData(LocalDBItems.locationArray, locationArray);
  }
 
  /**
   * Method to render view
   */
  render() {
    return null;
  }
}

export default LocationFetcher;