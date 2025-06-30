import AsyncStorage from '@react-native-async-storage/async-storage'

export const storeData = async (key, value) => {
  try {
    if (value === null || value === undefined) {
      console.warn(`Attempting to store null/undefined for key: ${key}`);
      return;
    }
    const jsonValue = JSON.stringify(value);
    await AsyncStorage.setItem(key, jsonValue);
  } catch (e) {
    console.error(`Error storing data for key ${key}:`, e);
    throw e; // Re-throw to handle in calling code
  }
};

export const wipeData = async () => {
  try {
    await AsyncStorage.clear();
  } catch (e) {
    console.error('Error wiping data:', e);
    throw e;
  }
};

export const getData = async (key) => {
  try {
    const jsonValue = await AsyncStorage.getItem(key);
    if (jsonValue === null) {
      console.log(`No data found for key: ${key}`);
      return null;
    }
    return JSON.parse(jsonValue);
  } catch (e) {
    console.error(`Error getting data for key ${key}:`, e);
    throw e;
  }
};

export const LocalDBItems = {
  baseUrl: 'BASE_URL',
  isUserAuthenticated: 'IS_USER_AUTHENTICATED',
  userDetails: 'USER_DETAILS',
  loginData: 'LOGIN_DATA',
  employeeDetails: 'EMPLOYEE_DETAILS',
  organizationDetails: 'ORGANIZATION_DETAILS',
  subscriptionDetails: 'SUBSCRIPTION_DETAILS',
  tokenData: 'TOKEN_DATA',
  locationArray:'LOCATION_ARRAY',
  location:'LOCATION',
  saveFaceIDData: 'SAVE_FACEID',
  checkInInfo: 'CHECKIN_INFO',
  checkInDate: 'CHECKIN_DATE',
  storeSelectedTeam: 'STORE_SELECTED_TEAM',
  isLocationFetcherRequired: "IS_LOCATION_REQUIRED",
  isEmployeeLocationTrack: 'IS_EMPLOYEE_TRACK',
  locationArrayForTracing: 'LOCATION_ARRAY_FOR_TRACKING',
  checkInLocationInfo:'CHECKIN_LOCATION_INFO',
  checkOutLocationInfo:'CHECKOUT_LOCATION_INFO',
  groupUUID:'GROUP_UUID',
  isLocationTrackingNeeded:"IS_LOCATION_TRACKING_NEEDED",
  selectedProjectDetails:"SELECTED_PROJECT_DETAILS",
  CHECK_IN_OUT_DETAILS:  "CHECK_IN_OUT_DETAILS",
  offlineTrackingData: 'OFFLINE_TRACKING_DATA',  // <--- add this!
  officeLocation: 'OFFICE_LOCATION',
  
}
