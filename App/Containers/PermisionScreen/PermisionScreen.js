// File: src/Screens/PermissionScreen.js
import * as React from "react";
import {
  AppState,
  Text,
  View,
  Image,
  TouchableOpacity,
  Linking,
  Platform,
} from "react-native";
import styles from "./style";
import { Helpers, Images } from "../../Theme";
import * as NavigationService from "../../Services/NavigationService";
import LinearGradient from "react-native-linear-gradient";
import Icon from "react-native-vector-icons/FontAwesome";
import {
  request,
  PERMISSIONS,
  RESULTS,
} from "react-native-permissions";
import AndroidGeolocation from "../LocationModule/AndroidGeolocation";
import LocationFetcher from "../LocationModule/index";
import PermissionDeniedModal from "../../Components/PermissionDeniedModal";
import { getData, LocalDBItems, storeData } from "../../Services/LocalStorage";
import {
  isCameraPermisonGranted,
  isLocationPermisonGranted,
  checkAllPermison,
} from "../../Components/PermissionChecker";

export default class PermissionScreen extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      locationPermission: false,
      cameraPermission: false,
      termsAndCondition: false,
      appState: AppState.currentState,
      showPermissionDeniedModal: false,
    };
  }

  componentDidMount = () => {
    this.checkPermissions();
  };

  _handleAppStateChange = (nextAppState) => {
    if (
      this.state.appState.match(/inactive|background/) &&
      nextAppState === "active"
    ) {
      this.checkPermissions();
    }
    this.setState({ appState: nextAppState });
  };

  checkPermissions = async () => {
    const camera = await isCameraPermisonGranted();
    const location = await isLocationPermisonGranted();
    this.setState(prev => ({
      ...prev,
      cameraPermission: camera.granted,
      locationPermission: location.granted,
      showPermissionDeniedModal: false,
    }));
  };

  componentWillUnmount() {}

  navigateToFaceRegistrationScreen = async () => {
    const employeeDetails = await getData(LocalDBItems.employeeDetails);
    if (employeeDetails.is_face_recog) {
      storeData(LocalDBItems.isUserAuthenticated, true);
      NavigationService.navigateAndReset("App", {});
    } else {
      NavigationService.navigate("FaceRegistrationIntoScreen");
    }
  };

  requestLocationPermission = () => {
    if (Platform.OS === "ios") {
      request(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE)
        .then((result) => {
          this.setState((prev) => ({
            ...prev,
            locationPermission: result === RESULTS.GRANTED,
            showPermissionDeniedModal:
              result === RESULTS.BLOCKED || result === RESULTS.DENIED,
          }));
        })
        .catch((error) => {
          console.error("iOS location permission error:", error);
        });
    } else {
      request(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION)
        .then((fineResult) => {
          if (fineResult === RESULTS.GRANTED) {
            request(PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION)
              .then((bgResult) => {
                const isGranted = bgResult === RESULTS.GRANTED;
                this.setState((prev) => ({
                  ...prev,
                  locationPermission: true,
                }));
                storeData(LocalDBItems.isEmployeeLocationTrack, isGranted);
                storeData(LocalDBItems.isLocationTrackingNeeded, isGranted);
              });
          }
        });
    }
  };

  requestBgLocatinPermission = () => {
    request(PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION)
      .then((value) => {
        if (value === RESULTS.GRANTED) {
          this.setState((prev) => ({
            ...prev,
            locationPermission: true,
          }));
        }
      })
      .catch((error) => console.log("Background loc err:", error));
  };

  requestCameraPermission = () => {
    const cameraPermission = this.getCameraPermissions();
    request(cameraPermission).then((result) => {
      if (result === RESULTS.GRANTED) {
        this.setState((prev) => ({
          ...prev,
          cameraPermission: true,
        }));
      }
    });
  };

  getCameraPermissions = () => {
    return Platform.OS === "ios"
      ? PERMISSIONS.IOS.CAMERA
      : PERMISSIONS.ANDROID.CAMERA;
  };

  getLocationPermissions = () => {
    return Platform.OS === "ios"
      ? [PERMISSIONS.IOS.LOCATION_WHEN_IN_USE, PERMISSIONS.IOS.LOCATION_ALWAYS]
      : [
          PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
          PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION,
        ];
  };

  onTermsAndConditionPressed = () => {
    this.setState((prev) => ({
      ...prev,
      termsAndCondition: !prev.termsAndCondition,
    }));
  };

  isDisabledTermsAndCondition = () => {
    return !(this.state.locationPermission && this.state.cameraPermission);
  };

  isAllowButtonDisabled = () => {
    const { locationPermission, cameraPermission, termsAndCondition } =
      this.state;
    return !(locationPermission && cameraPermission && termsAndCondition);
  };

  modalCloseAction = () => {
    Linking.openSettings();
    this.setState((prev) => ({
      ...prev,
      showPermissionDeniedModal: false,
    }));
  };

  render() {
    return (
      <View style={[Helpers.fillCol, styles.container]}>
        <LinearGradient
          start={{ x: 0.5, y: 1.0 }}
          end={{ x: 0.0, y: 0.25 }}
          colors={["#f6976e", "#fe717f", "#fa8576"]}
          style={styles.navigationLinearGradient}
        >
          <Text style={styles.titleText}>Allow Permissions</Text>
        </LinearGradient>
        <View style={styles.topContainer}>
          <Text style={styles.headerText}>
            Please allow us permission to access following for fast and wide
            facial detection.
          </Text>
          <View style={styles.permissionContainer}>
            <TouchableOpacity onPress={this.requestLocationPermission}>
              <View style={styles.permisionView}>
                <View style={styles.permissionCellContainer}>
                  <Icon name="th-large" size={20} color="#fa8576" />
                  <View style={{ flex: 1, paddingLeft: 10 }}>
                    <Text style={styles.permissionText}>
                      Allow to access location
                    </Text>
                  </View>
                  <View style={styles.checkedContainer}>
                    <Image
                      style={styles.checkedIcon}
                      source={
                        this.state.locationPermission
                          ? Images.checkedIcon
                          : Images.uncheckedIcon
                      }
                      resizeMode="contain"
                    />
                  </View>
                </View>
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={this.requestCameraPermission}>
              <View style={styles.permisionView}>
                <View style={styles.permissionCellContainer}>
                  <Icon name="camera" size={20} color="#fa8576" />
                  <View style={{ flex: 1, paddingLeft: 10 }}>
                    <Text style={styles.permissionText}>
                      Allow to access camera and photos
                    </Text>
                  </View>
                  <View style={styles.checkedContainer}>
                    <Image
                      style={styles.checkedIcon}
                      source={
                        this.state.cameraPermission
                          ? Images.checkedIcon
                          : Images.uncheckedIcon
                      }
                      resizeMode="contain"
                    />
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity
          onPress={this.onTermsAndConditionPressed}
          disabled={this.isDisabledTermsAndCondition()}
        >
          <View style={styles.privacyContainer}>
            <Image
              style={styles.checkedIcon}
              source={
                this.state.termsAndCondition
                  ? Images.checkedIcon
                  : Images.uncheckedIcon
              }
              resizeMode="contain"
            />
            <Text style={styles.privacyPolicyNormalText}>
              {" I read the"}
              <Text style={styles.privacyPolicyText}> Privacy policy</Text>
              <Text style={styles.privacyPolicyNormalText}>
                {" and I accept the"}
                <Text style={styles.privacyPolicyText}> Terms and conditions</Text>
              </Text>
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          disabled={this.isAllowButtonDisabled()}
          style={{
            width: "85%",
            marginBottom: 30,
            justifyContent: "center",
            alignSelf: "center",
          }}
          onPress={this.navigateToFaceRegistrationScreen}
        >
          <LinearGradient
            start={{ x: 0.5, y: 1.0 }}
            end={{ x: 0.0, y: 0.25 }}
            colors={["#fe717f", "#fa8576", "#f6976e"]}
            style={styles.allowButton}
          >
            <Text style={styles.allowText}>Allow</Text>
          </LinearGradient>
        </TouchableOpacity>
        <PermissionDeniedModal
          modalVisible={this.state.showPermissionDeniedModal}
          modalCloseAction={this.modalCloseAction}
          isVerifcationPopUp={false}
        />
      </View>
    );
  }
}
