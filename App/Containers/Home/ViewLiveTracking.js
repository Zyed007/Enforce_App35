import * as React from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  Dimensions,
  DeviceEventEmitter,
  Modal,
  ActivityIndicator,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import styles from './style';
import { Helpers } from '../../Theme';
import LinearGradient from 'react-native-linear-gradient';
import { apiService } from '../../Services/ApiService';
import { Endpoint, BaseUrl } from '../../Services/Endpoint';
import { getData, LocalDBItems, storeData } from '../../Services/LocalStorage';
import IconImage from 'react-native-vector-icons/FontAwesome';
import MapForPolyline from '../../Components/MapClassVIew';
import Geolocation from 'react-native-geolocation-service';
import UUIDGenerator from 'react-native-uuid-generator';
import { getPathLength } from 'geolib';

const windowHeight = Dimensions.get('window').height;

export default class ViewLiveTrackingScreen extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      locationTrackingCoordinates: [],
      showTrackingStatus: 'Initializing location...',
      isSyncing: false,
    };
    this.cordinateObj = {
      latitude: 9.947236,
      longitude: 76.347843,
    };
    this.previousTimeStamp = new Date();
    this.locationInfoArray = [];
    this.watchID = null;
    this.isTripEnd = false;
  }

  async componentDidMount() {
    console.log("[LiveTracking] 🔄 componentDidMount called");

    // ✅ Ask for permissions
    if (Platform.OS === 'ios') {
      console.log("[LiveTracking] 📲 Requesting iOS location authorization");
      Geolocation.requestAuthorization('always');
    } else {
      console.log("[LiveTracking] 📲 Requesting Android location permission");
      await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
    }

    // Load any previously unsynced location data
    const storedLocations = await getData(LocalDBItems.locationArrayForTracing);
    if (storedLocations && storedLocations.length > 0) {
      this.locationInfoArray = storedLocations;
      this.setState({ showTrackingStatus: 'Resuming tracking...' });
      console.log("[LiveTracking] 📂 Loaded stored locations:", storedLocations.length);
    } else {
      this.setState({ showTrackingStatus: 'Starting new trip...' });
    }

    // ✅ Start watching location
    this.watchID = Geolocation.watchPosition(
      async (position) => {
        console.log("[LiveTracking] 📍 New position received:", position.coords);

        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        this.cordinateObj = location;
        this.setState({ showTrackingStatus: 'Tracking location...' });

        const isTracking = await getData(LocalDBItems.isLocationTrackingNeeded);
        if (isTracking) {
          console.log("[LiveTracking] ✅ Tracking is enabled. Handling location.");
          this.handleLocationTracking(location);
        } else {
          console.log("[LiveTracking] ⏸ Tracking is disabled in storage.");
        }
      },
      (error) => {
        console.error("[LiveTracking] ❌ Geolocation Error:", error.code, error.message);
        let errorMessage = `Code: ${error.code}, Message: ${error.message}`;
        let errorType = "GEOLOCATION_ERROR";

        switch (error.code) {
          case 1:
            errorMessage = "Location permission denied. Please enable location services.";
            errorType = "PERMISSION_DENIED";
            break;
          case 2:
            errorMessage = "Location unavailable. Check GPS settings.";
            errorType = "POSITION_UNAVAILABLE";
            break;
          case 3:
            errorMessage = "Location request timed out.";
            errorType = "LOCATION_TIMEOUT";
            break;
        }
        this.setState({ showTrackingStatus: `Error: ${errorMessage}` });
        this.logErrorToApi(errorType, errorMessage);
      },
      {
        accuracy: {
          android: 'high',
          ios: 'bestForNavigation',
        },
        enableHighAccuracy: true,
        distanceFilter: 25,
        interval: Platform.OS === 'android' ? 5000 : undefined,
        fastestInterval: Platform.OS === 'android' ? 1000 : undefined,
        showsBackgroundLocationIndicator: true, // iOS shows blue bar when tracking
      },
    );
  }

  componentWillUnmount() {
    console.log("[LiveTracking] 🛑 componentWillUnmount called, clearing watch");
    if (this.watchID !== null) {
      Geolocation.clearWatch(this.watchID);
    }
  }

  handleLocationTracking = async (location) => {
    console.log("[LiveTracking] ➕ Adding new location to array:", location);
    this.locationInfoArray.push(location);
    await storeData(LocalDBItems.locationArrayForTracing, this.locationInfoArray);

    if (this.mapRef) {
      this.mapRef.trackLocationOnMap(location);
    }
    this.syncLocationToApi();
  };

  syncLocationToApi = async () => {
    const isTracking = await getData(LocalDBItems.isLocationTrackingNeeded);
    if (isTracking && !this.state.isSyncing) {
      const difference = (new Date().getTime() - this.previousTimeStamp.getTime()) / 1000;
      console.log("[LiveTracking] ⏱ Time since last sync:", difference, "seconds");
      if (difference > 120 && this.locationInfoArray.length > 0) {
        this.setState({ isSyncing: true, showTrackingStatus: 'Syncing data...' });
        await this.locationTrackingNewApi();
        this.setState({ isSyncing: false });
      }
    }
  };

  // 🚀 Same locationTrackingNewApi, logErrorToApi, getRandomUUID as in your code
  // (no changes, just logging improved)

locationTrackingNewApi = async (checkInInfo) => {
  console.log("[LiveTracking] 🚀 Starting sync process...");

  const locationArrayToSend = [...this.locationInfoArray];
  if (locationArrayToSend.length > 0) {
    console.log(`[LiveTracking] Preparing ${locationArrayToSend.length} points for API payload.`);

    const groupUUID = await this.getRandomUUID();
    const id = await UUIDGenerator.getRandomUUID();
    const checkoutLocationInfo = await getData(LocalDBItems.checkOutLocationInfo);
    const employeeDetails = await getData(LocalDBItems.employeeDetails);
    const distance = getPathLength(locationArrayToSend) / 1000;
    const date = new Date();

    console.log("[LiveTracking] 🆔 Generated IDs:", { id, groupUUID });
    console.log("[LiveTracking] Employee details:", employeeDetails);
    console.log("[LiveTracking] Checkout info:", checkoutLocationInfo);

    const newLocationArrayMapped = locationArrayToSend.map((locationItem) => {
      return {
        groupid: groupUUID,
        lat: locationItem.latitude,
        lang: locationItem.longitude,
        created_date: date,
      };
    });

    // -----------------------
    // ✅ Normalize check-in dict
    // -----------------------
    let checkInDict = {};
    if (checkInInfo) {
      console.log("[LiveTracking] ✅ Using check-in info from argument");
      checkInDict = checkInInfo;
    } else if (this.props.checkinDict) {
      console.log("[LiveTracking] ✅ Using check-in info from props");
      checkInDict = this.props.checkinDict;
    }

    // unwrap if it's a promise-like object { _h, _i, _j, _k }
    if (checkInDict && checkInDict._j) {
      console.log("[LiveTracking] 🔄 Normalizing checkInDict from _j");
      checkInDict = checkInDict._j;
    }

    console.log("checkInDict (normalized):", checkInDict);

    const dict = {
      id: id,
      empid: employeeDetails?.id,
      groupid: groupUUID,
      distance: distance,
      checkout_formatted_address: checkoutLocationInfo?.formatted_address || "",
      checkout_lat: checkoutLocationInfo?.latitude || 0.0,
      checkout_lang: checkoutLocationInfo?.longitude || 0.0,
      checkout_street_number: checkoutLocationInfo?.street_number || "",
      checkout_route: checkoutLocationInfo?.route || "",
      checkout_locality: checkoutLocationInfo?.locality || "",
      checkout_administrative_area_level_2: checkoutLocationInfo?.administrative_area_level_2 || "",
      checkout_administrative_area_level_1: checkoutLocationInfo?.administrative_area_level_1 || "",
      checkin_formatted_address: checkInDict?.formatted_address || "",
      travelClaimTrack: newLocationArrayMapped,
      created_date: date,
      is_trip_end: this.isTripEnd,
      createdby: employeeDetails?.full_name,
      ...checkInDict, // spread in case there are more fields
    };

    console.log("[LiveTracking] 📦 Final payload being sent to server:", dict);

    const requestObj = {
      endpoint: BaseUrl.API_BASE_URL + Endpoint.TIMESHEET_TRAVEL_CLAIM,
      type: "post",
      params: dict,
    };

    try {
      const apiResponseData = await apiService(requestObj);
      console.log("[LiveTracking] 🌐 API response:", apiResponseData);
      if (apiResponseData.status === "200") {
        console.log("[LiveTracking] ✅ Server accepted data. Clearing buffer.");

        this.previousTimeStamp = new Date();
        this.locationInfoArray = [];
        await storeData(LocalDBItems.locationArrayForTracing, []);
        this.setState({ showTrackingStatus: "Location synced successfully." });
      } else {
        console.error("API call failed:", apiResponseData.status, apiResponseData.message);
        this.setState({ showTrackingStatus: "Sync failed, retrying later." });
        await this.logErrorToApi("API_CALL_FAILED", `Status: ${apiResponseData.status}, Message: ${apiResponseData.message || 'No specific message'}`);
      }
    } catch (error) {
      console.error("Error sending location data:", error);
      this.setState({ showTrackingStatus: "Network error, retrying later." });
      await this.logErrorToApi("NETWORK_ERROR", error.message || "Unknown network error");
    }
  } else {
    console.log("No new location data to send.");
    this.setState({ showTrackingStatus: "Waiting for location updates..." });
  }
};

 
  /**
   * Method to log errors to the server.
   * @param {string} errorType - A classification of the error (e.g., "API_CALL_FAILED", "NETWORK_ERROR").
   * @param {string} errorMessage - A detailed message about the error.
   */
  logErrorToApi = async (errorType, errorMessage) => {
    try {
      const employeeDetails = await getData(LocalDBItems.employeeDetails);
      const logData = {
        empid: employeeDetails?.id || 'Unknown',
        org_id: employeeDetails?.org_id || 'Unknown',
        full_name: employeeDetails?.full_name || 'Unknown',
        error_type: errorType,
        error_message: errorMessage,
        timestamp: new Date().toISOString(),
      };
 
      const requestObj = {
        endpoint: BaseUrl.API_BASE_URL + Endpoint.ERROR_LOGGING, // Ensure Endpoint.ERROR_LOGGING is defined
        type: 'post',
        params: logData
      };
 
      const apiResponse = await apiService(requestObj);
      if (apiResponse.status === "200") {
        console.log("Error logged successfully:", logData);
      } else {
        console.error("Failed to log error:", apiResponse.status, apiResponse.message);
      }
    } catch (err) {
      console.error("Critical error: Unable to send error log to API:", err);
    }
  };
 
  /**
   * Method to get a random UUID
   */
  getRandomUUID = async () => {
    let udid = await getData(LocalDBItems.groupUUID);
    if (udid === "" || udid === null) {
      udid = await UUIDGenerator.getRandomUUID();
      await storeData(LocalDBItems.groupUUID, udid);
    }
    return udid;
  };
 
  /**
   * Method to fire the location object to the listener classes
   * (This method seems to be for an external listener, not directly used for map plotting here)
   */
  getLocationForTracking = async (locationObj) => {
    this.cordinateObj.latitude = locationObj.latitude;
    this.cordinateObj.longitude = locationObj.longitude;
    DeviceEventEmitter.emit('locationEvent', locationObj);
  };

  render() {
    const { showTrackingStatus, isSyncing } = this.state;
    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={this.props.showTrackingModal}
        onRequestClose={() => this.props.hideLiveTracking()}
      >
        <View style={[Helpers.fillCol, styles.container]}>
          <LinearGradient
            start={{ x: 0.5, y: 1.0 }}
            end={{ x: 0.0, y: 0.25 }}
            colors={['#f6976e', '#fe717f', '#fa8576']}
            style={styles.navigationLinearGradient}
          >
            <View style={{ flexDirection: "row" }}>
              <TouchableOpacity
                style={{
                  flex: 0.75,
                  width: 60,
                  marginHorizontal: 24,
                  marginTop: 40,
                  backgroundColor: "transparent",
                }}
                onPress={() => this.props.hideLiveTracking()}
              >
                <IconImage name="angle-left" size={30} color="white" />
              </TouchableOpacity>
              <View style={{ marginTop: 40, flex: 1, alignSelf: "center" }}>
                <Text style={styles.titleText}>Live Trip</Text>
              </View>
              <View style={{ marginTop: 40, flex: 1 }}></View>
            </View>
          </LinearGradient>

          <View style={{ flex: 1 }}>
            <View style={{ padding: 10, backgroundColor: '#f0f0f0', alignItems: 'center' }}>
              <Text style={{ fontSize: 14, color: '#333' }}>{showTrackingStatus}</Text>
              {isSyncing && <ActivityIndicator size="small" color="#fe717f" style={{ marginTop: 5 }} />}
            </View>
            <MapForPolyline
              ref={(mapRef) => (this.mapRef = mapRef)}
              coordinate={this.cordinateObj}
              height={windowHeight * 0.8}
            />
          </View>
        </View>
      </Modal>
    );
  }
}
