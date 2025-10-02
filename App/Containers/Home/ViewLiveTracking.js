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
    console.log('ViewLiveTrackingScreen: Constructor called');
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
   
    console.log('ViewLiveTrackingScreen: Initial state set', this.state);
  }

  componentDidMount = async () => {
    console.log('ViewLiveTrackingScreen: componentDidMount called');

    try {
    const storedLocations = await getData(LocalDBItems.locationArrayForTracing);
      console.log('ViewLiveTrackingScreen: Retrieved stored locations from DB', storedLocations);
     
    if (storedLocations && storedLocations.length > 0) {
      this.locationInfoArray = storedLocations;
      this.setState({ showTrackingStatus: 'Resuming tracking...' });
      console.log("[LiveTracking] 📂 Loaded stored locations:", storedLocations.length);
    } else {
      this.setState({ showTrackingStatus: 'Starting new trip...' });
        console.log('ViewLiveTrackingScreen: Starting new trip, no stored locations found');
    }

    this.watchID = Geolocation.watchPosition(
      async (position) => {
        // Filter out inaccurate locations
        if (position.coords.accuracy < 50) {
          const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          this.cordinateObj = location;
          this.setState({ showTrackingStatus: 'Tracking location...' });
          const isTracking = await getData(LocalDBItems.isLocationTrackingNeeded);
          if (isTracking) {
            this.handleLocationTracking(location);
          }
        } else {
          console.log('Skipping inaccurate location:', position.coords.accuracy);
        }
      },
      (error) => {
          console.error("ViewLiveTrackingScreen: Geolocation Error:", error.code, error.message);
        let errorMessage = `Code: ${error.code}, Message: ${error.message}`;
        let errorType = "GEOLOCATION_ERROR";

        switch (error.code) {
          case 1:
              errorMessage = "Location permission denied. Please enable location services for this app.";
            errorType = "PERMISSION_DENIED";
            break;
          case 2:
              errorMessage = "Location information is unavailable. Check your device's GPS settings.";
            errorType = "POSITION_UNAVAILABLE";
            break;
          case 3:
              errorMessage = "Location request timed out. Trying again...";
            errorType = "LOCATION_TIMEOUT";
            break;
            default:
              break;
        }
        this.setState({ showTrackingStatus: `Error: ${errorMessage}` });
          console.error('ViewLiveTrackingScreen: Geolocation error details:', errorType, errorMessage);
        this.logErrorToApi(errorType, errorMessage);
      },
     {
        accuracy: {
          android: 'high',
          ios: 'best',
        },
        enableHighAccuracy: true,
        distanceFilter: 10, // Lower for smoother path
        interval: Platform.OS === 'android' ? 10000 : undefined, // 2 seconds
        fastestInterval: Platform.OS === 'android' ? 5000 : undefined,
        showsBackgroundLocationIndicator: true, // iOS shows blue bar when tracking
      },
    );
     
      console.log('ViewLiveTrackingScreen: Geolocation watch started with ID:', this.watchID);
    } catch (error) {
      console.error('ViewLiveTrackingScreen: Error in componentDidMount:', error);
  }
}

  componentWillUnmount() {
    console.log("[LiveTracking] 🛑 componentWillUnmount called, clearing watch");
    if (this.watchID !== null) {
      Geolocation.clearWatch(this.watchID);
      console.log('ViewLiveTrackingScreen: Cleared geolocation watch with ID:', this.watchID);
    }
  };

  handleLocationTracking = async (location) => {
    console.log("[LiveTracking] ➕ Adding new location to array:", location);
    this.locationInfoArray.push(location);
    console.log('ViewLiveTrackingScreen: Location array now has', this.locationInfoArray.length, 'items');
   
    try {
    await storeData(LocalDBItems.locationArrayForTracing, this.locationInfoArray);
      console.log('ViewLiveTrackingScreen: Successfully stored location array in local DB');
    } catch (storageError) {
      console.error('ViewLiveTrackingScreen: Error storing location data:', storageError);
    }

    if (this.mapRef) {
      console.log('ViewLiveTrackingScreen: Updating map with new location');
      this.mapRef.trackLocationOnMap(location);
    } else {
      console.log('ViewLiveTrackingScreen: Map reference not available yet');
    }
    this.syncLocationToApi();
  };

  syncLocationToApi = async () => {
    console.log('ViewLiveTrackingScreen: syncLocationToApi called');
   
    try {
    const isTracking = await getData(LocalDBItems.isLocationTrackingNeeded);
      console.log('ViewLiveTrackingScreen: Tracking enabled for sync?', isTracking);
     
    if (isTracking && !this.state.isSyncing) {
      const difference = (new Date().getTime() - this.previousTimeStamp.getTime()) / 1000;
        console.log('ViewLiveTrackingScreen: Time difference since last sync:', difference, 'seconds');
        console.log('ViewLiveTrackingScreen: Location array length:', this.locationInfoArray.length);
       
        if (difference > 2 * 60 && this.locationInfoArray.length > 0) {
          console.log('ViewLiveTrackingScreen: Conditions met for API sync');
        this.setState({ isSyncing: true, showTrackingStatus: 'Syncing data...' });
        await this.locationTrackingNewApi();
        this.setState({ isSyncing: false });
        } else {
          console.log('ViewLiveTrackingScreen: Sync conditions not met or no data to sync');
        }
      } else {
        console.log('ViewLiveTrackingScreen: Tracking disabled or sync already in progress');
      }
    } catch (error) {
      console.error('ViewLiveTrackingScreen: Error in syncLocationToApi:', error);
      this.setState({ isSyncing: false });
    }
  };

  // 🚀 Same locationTrackingNewApi, logErrorToApi, getRandomUUID as in your code
  // (no changes, just logging improved)

locationTrackingNewApi = async (checkInInfo) => {
  console.log("[LiveTracking] 🚀 Starting sync process...");

  const locationArrayToSend = [...this.locationInfoArray];
    console.log('ViewLiveTrackingScreen: Preparing to send', locationArrayToSend.length, 'locations to API');

    if (locationArrayToSend.length > 0) {
      try {
    const groupUUID = await this.getRandomUUID();
    const id = await UUIDGenerator.getRandomUUID();
    const checkoutLocationInfo = await getData(LocalDBItems.checkOutLocationInfo);
    const employeeDetails = await getData(LocalDBItems.employeeDetails);
    const distance = getPathLength(locationArrayToSend) / 1000;
    const date = new Date();

        console.log('ViewLiveTrackingScreen: Generated UUIDs - group:', groupUUID, 'id:', id);
        console.log('ViewLiveTrackingScreen: Checkout location info:', checkoutLocationInfo);
        console.log('ViewLiveTrackingScreen: Employee details:', employeeDetails);
        console.log('ViewLiveTrackingScreen: Calculated distance:', distance, 'km');

    const newLocationArrayMapped = locationArrayToSend.map((locationItem) => {
      return {
        groupid: groupUUID,
        lat: locationItem.latitude,
        lang: locationItem.longitude,
        created_date: date,
      };
    });

        console.log('ViewLiveTrackingScreen: Mapped location array:', newLocationArrayMapped);
 
    let checkInDict = {};
    if (checkInInfo) {
      console.log("[LiveTracking] ✅ Using check-in info from argument");
      checkInDict = checkInInfo;
          console.log('ViewLiveTrackingScreen: Using provided checkInInfo');
    } else if (this.props.checkinDict) {
      console.log("[LiveTracking] ✅ Using check-in info from props");
      checkInDict = this.props.checkinDict;
          console.log('ViewLiveTrackingScreen: Using props checkinDict');
    }

        console.log('ViewLiveTrackingScreen: Final checkInDict:', checkInDict);

    const dict = {
          "id": id,
          "empid": employeeDetails?.id,
          "groupid": groupUUID,
          "distance": distance,
          "checkout_formatted_address": checkoutLocationInfo?.formatted_address || "",
          "checkout_lat": checkoutLocationInfo?.latitude || 0.0,
          "checkout_lang": checkoutLocationInfo?.longitude || 0.0,
          "checkout_street_number": checkoutLocationInfo?.street_number || "",
          "checkout_route": checkoutLocationInfo?.route || "",
          "checkout_locality": checkoutLocationInfo?.locality || "",
          "checkout_administrative_area_level_2": checkoutLocationInfo?.administrative_area_level_2 || "",
          "checkout_administrative_area_level_1": checkoutLocationInfo?.administrative_area_level_1 || "",
          "checkin_formatted_address": checkInDict?.checkin_formatted_address || "",
          "travelClaimTrack": newLocationArrayMapped,
          "created_date": date,
          "is_trip_end": this.isTripEnd,
          "createdby": employeeDetails?.full_name,
          ...checkInDict
    };

    console.log("[LiveTracking] 📦 Final payload being sent to server:", dict);

    const requestObj = {
      endpoint: BaseUrl.API_BASE_URL + Endpoint.TIMESHEET_TRAVEL_CLAIM,
      type: "post",
      params: dict,
    };

        console.log('ViewLiveTrackingScreen: API request object:', requestObj);
 
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
 
      console.log('ViewLiveTrackingScreen: Error log data:', logData);
 
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
    console.log('ViewLiveTrackingScreen: getRandomUUID called');
   
    try {
    let udid = await getData(LocalDBItems.groupUUID);
      console.log('ViewLiveTrackingScreen: Retrieved UUID from storage:', udid);
     
    if (udid === "" || udid === null) {
      udid = await UUIDGenerator.getRandomUUID();
      await storeData(LocalDBItems.groupUUID, udid);
        console.log('ViewLiveTrackingScreen: Generated and stored new UUID:', udid);
    }
    return udid;
    } catch (error) {
      console.error('ViewLiveTrackingScreen: Error in getRandomUUID:', error);
      const fallbackUUID = await UUIDGenerator.getRandomUUID();
      console.log('ViewLiveTrackingScreen: Using fallback UUID:', fallbackUUID);
      return fallbackUUID;
    }
  };
 
  getLocationForTracking = async (locationObj) => {
    console.log('ViewLiveTrackingScreen: getLocationForTracking called with:', locationObj);
   
    this.cordinateObj.latitude = locationObj.latitude;
    this.cordinateObj.longitude = locationObj.longitude;
    DeviceEventEmitter.emit('locationEvent', locationObj);
    console.log('ViewLiveTrackingScreen: Emitted location event');
  };

  render() {
    console.log('ViewLiveTrackingScreen: render called');
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
                onPress={() => {
                  console.log('ViewLiveTrackingScreen: Close button pressed');
                  this.props.hideLiveTracking();
                }}
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
