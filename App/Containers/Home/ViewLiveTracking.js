import * as React from 'react';
import { Text, View, TouchableOpacity, Dimensions, DeviceEventEmitter, Modal, ActivityIndicator } from 'react-native';
import styles from './style'; // Assuming 'style' and 'Helpers' are defined elsewhere
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
// import HomeScreen from './HomeScreen'; // Not directly used in this component's logic

const windowHeight = Dimensions.get('window').height;

/**
 * Class to view the live location of the user
 * Will draw path travelled by the user in the google map
 * Initialize the location object
 */
export default class ViewLiveTrackingScreen extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      locationTrackingCoordinates: [], // This state variable is not actively used for map plotting in the original code, `this.locationInfoArray` is. Keeping for consistency if future use is intended.
      showTrackingStatus: 'Initializing location...', // User feedback for tracking status
      isSyncing: false, // To show loading indicator during API sync
    };
    this.cordinateObj = {
      latitude: 9.947236, // Default initial coordinates
      longitude: 76.347843
    };
    this.previousTimeStamp = new Date(); // Timestamp of the last successful API sync
    this.locationInfoArray = []; // Accumulates location data for the current session/sync interval
    this.watchID = null; // To store the watchPosition ID for clearing
    this.isTripEnd = false; // Default value. This should be set by a parent component or an internal method when the trip actually ends.
  }

  /**
   * Method loads the component into memory
   * Geolocation service watch position method added to track the user's location
   * Fetches `isLocationTrackingNeeded` from DB to check if tracking is required
   * If tracking is needed, `handleLocationTracking` function will be called
   * Sets up different location tracking parameters for geolocation
   * Enabled high accuracy
   * Distance filter added
   * Time interval added
   */
  componentDidMount = async () => {
    // Load any previously unsynced location data from local storage
    const storedLocations = await getData(LocalDBItems.locationArrayForTracing);
    if (storedLocations && storedLocations.length > 0) {
      this.locationInfoArray = storedLocations;
      this.setState({ showTrackingStatus: 'Resuming tracking...' });
      // Optionally, re-plot existing points on the map if mapRef is available immediately
      // This might require a slight delay or a different approach depending on MapForPolyline's readiness
    } else {
      this.setState({ showTrackingStatus: 'Starting new trip...' });
    }

    this.watchID = Geolocation.watchPosition(
      async (position) => {
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
        this.cordinateObj = location; // Update current coordinate for map centering
        this.setState({ showTrackingStatus: 'Tracking location...' });

        const isTracking = await getData(LocalDBItems.isLocationTrackingNeeded);
        if (isTracking) {
          this.handleLocationTracking(location);
        }
      },
      (error) => {
        // Robust error handling for geolocation
        console.error("Geolocation Error:", error.code, error.message);
        let errorMessage = `Code: ${error.code}, Message: ${error.message}`;
        let errorType = "GEOLOCATION_ERROR";

        switch (error.code) {
          case 1: // PERMISSION_DENIED
            errorMessage = "Location permission denied. Please enable location services for this app.";
            errorType = "PERMISSION_DENIED";
            break;
          case 2: // POSITION_UNAVAILABLE
            errorMessage = "Location information is unavailable. Check your device's GPS settings.";
            errorType = "POSITION_UNAVAILABLE";
            break;
          case 3: // TIMEOUT
            errorMessage = "Location request timed out. Trying again...";
            errorType = "LOCATION_TIMEOUT";
            break;
          default:
            break;
        }
        this.setState({ showTrackingStatus: `Error: ${errorMessage}` });
        this.logErrorToApi(errorType, errorMessage);
      },
      {
        accuracy: {
          android: 'high',
          ios: 'best',
        },
        enableHighAccuracy: true,
        distanceFilter: 25, // Update every 25 meters
        interval: 5000, // Check every 5 seconds (5000 ms) to conserve battery
        fastestInterval: 1000, // Allow updates as fast as 1 second (1000 ms) if available
      },
    );
  };

  /**
   * Clears the watchPosition listener when the component unmounts
   */
  componentWillUnmount = () => {
    if (this.watchID !== null) {
      Geolocation.clearWatch(this.watchID);
    }
  };

  /**
   * Method handles the location tracking
   * Fetches the current location array from the DB
   * Appends the new location to `this.locationInfoArray`
   * Persists the updated location array to DB for offline sync
   * Sets the location array to plot it on the map
   * `syncLocationToApi` method called to sync the location to the server
   */
  handleLocationTracking = async (location) => {
    this.locationInfoArray.push(location);
    // Always store the accumulated data to local storage for persistence across app restarts
    await storeData(LocalDBItems.locationArrayForTracing, this.locationInfoArray);

    if (this.mapRef) {
      this.mapRef.trackLocationOnMap(location);
    }
    this.syncLocationToApi();
  };

  /**
   * Method to sync the location tracking to the server
   * Checks if location tracking is needed
   * Check the time difference
   * If it's greater than 2 mins then location will be sent to the server
   */
  syncLocationToApi = async () => {
    const isTracking = await getData(LocalDBItems.isLocationTrackingNeeded);
    if (isTracking && !this.state.isSyncing) { // Prevent multiple simultaneous syncs
      const difference = (new Date().getTime() - this.previousTimeStamp.getTime()) / 1000;
      if (difference > 2 * 60 && this.locationInfoArray.length > 0) { // Sync every 2 minutes if there's data
        this.setState({ isSyncing: true, showTrackingStatus: 'Syncing data...' });
        await this.locationTrackingNewApi();
        this.setState({ isSyncing: false });
      }
    }
  };

  /**
   * Method to save the location tracking to the server
   * Fetches the location array (from `this.locationInfoArray`)
   * Generates random uuid
   * Creates new location object via map function
   * Creates the check-in dictionary of the user
   * Posts the parameters to the server
   */
  locationTrackingNewApi = async (checkInInfo) => {
    const locationArrayToSend = [...this.locationInfoArray]; // Use a copy to avoid race conditions
    if (locationArrayToSend.length > 0) {
      const groupUUID = await this.getRandomUUID();
      const id = await UUIDGenerator.getRandomUUID();
      const checkoutLocationInfo = await getData(LocalDBItems.checkOutLocationInfo);
      const employeeDetails = await getData(LocalDBItems.employeeDetails);
      const distance = getPathLength(locationArrayToSend) / 1000;
      const date = new Date();

      const newLocationArrayMapped = locationArrayToSend.map((locationItem) => {
        return {
          groupid: groupUUID,
          lat: locationItem.latitude,
          lang: locationItem.longitude,
          created_date: date,
        };
      });

      let checkInDict = {};
      // Prioritize checkInInfo passed as argument, otherwise use prop
      if (checkInInfo) {
        checkInDict = checkInInfo;
      } else if (this.props.checkinDict) {
        checkInDict = this.props.checkinDict;
      }
      // If checkInDict is still empty, it means no check-in info is available or passed.
      // You might want to handle this case (e.g., provide default empty values or show a warning).

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
        "checkin_formatted_address": checkInDict?.checkin_formatted_address || "", // Ensure these are populated from checkInDict
        "travelClaimTrack": newLocationArrayMapped,
        "created_date": date,
        "is_trip_end": this.isTripEnd,
        "createdby": employeeDetails?.full_name, // This might need to be populated from employeeDetails
        ...checkInDict // Spread checkInDict to include all its properties
      };

      const requestObj = { endpoint: BaseUrl.API_BASE_URL + Endpoint.TIMESHEET_TRAVEL_CLAIM, type: 'post', params: dict };

      try {
        const apiResponseData = await apiService(requestObj);

        if (apiResponseData.status === "200") {
          // Data successfully stored, now wipe out local data
          this.previousTimeStamp = new Date();
          this.locationInfoArray = []; // Clear current session's accumulated data
          await storeData(LocalDBItems.locationArrayForTracing, []); // Clear persisted data
          this.setState({ showTrackingStatus: 'Location synced successfully.' });
        } else {
          // API call was made, but status indicates an issue
          console.error("API call failed with status:", apiResponseData.status, "message:", apiResponseData.message);
          this.setState({ showTrackingStatus: 'Sync failed, retrying later.' });
          await this.logErrorToApi(
            "API_CALL_FAILED",
            `Status: ${apiResponseData.status}, Message: ${apiResponseData.message || 'No specific message'}`
          );
        }
      } catch (error) {
        // Network error or other issues during API call
        console.error("Error sending location data:", error);
        this.setState({ showTrackingStatus: 'Network error, retrying later.' });
        await this.logErrorToApi("NETWORK_ERROR", error.message || 'Unknown network error');
      }
    } else {
      console.log("No new location data to send.");
      this.setState({ showTrackingStatus: 'Waiting for location updates...' });
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

  /**
   * Method to render the view
   */
  render() {
    const { showTrackingStatus, isSyncing } = this.state;
    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={this.props.showTrackingModal}
        onRequestClose={() => this.props.hideLiveTracking()} // Handle hardware back button on Android
      >
        <View style={[Helpers.fillCol, styles.container]}>
          <LinearGradient
            start={{ x: 0.5, y: 1.0 }} end={{ x: 0.0, y: 0.25 }}
            colors={['#f6976e', '#fe717f', '#fa8576']} style={styles.navigationLinearGradient}>
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
            {/* Display tracking status */}
            <View style={{ padding: 10, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 14, color: '#333' }}>{showTrackingStatus}</Text>
              {isSyncing && <ActivityIndicator size="small" color="#fe717f" style={{ marginTop: 5 }} />}
            </View>
            <MapForPolyline ref={(mapRef) => this.mapRef = mapRef} coordinate={this.cordinateObj} height={windowHeight * 0.8} />
          </View>
        </View>
      </Modal>
    );
  }
}
