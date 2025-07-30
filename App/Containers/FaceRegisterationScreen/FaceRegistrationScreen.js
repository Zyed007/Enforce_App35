import React, { useState, useRef, useEffect } from "react";
import {
  View,
  TouchableOpacity,
  Alert,
  Text,
  Image,
  FlatList,
  Platform,
  Dimensions,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import { Modalize } from "react-native-modalize";
import LinearGradient from "react-native-linear-gradient";
import Icon from "react-native-vector-icons/FontAwesome";

// Local imports
import { Images } from "../../Theme";
import * as NavigationService from "../../Services/NavigationService";
import { addFaceRekognitionService } from "../../Services/AWSService";
import { getData, LocalDBItems, storeData } from "../../Services/LocalStorage";
import { apiService } from "../../Services/ApiService";
import { Endpoint, BaseUrl } from "../../Services/Endpoint";
import CustomPopUpModal from "../../Components/CustomPopup";

const { width, height } = Dimensions.get("window");

const FaceRegistrationScreen = ({ navigation }) => {
  // State management
  const [thumbnailPreview, setThumbnailPreview] = useState(["", "", "", "", ""]);
  const [base64Image, setBase64Image] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [showAlertIdNoFace, setShowAlertIdNoFace] = useState(false);
  const [flash, setFlash] = useState("off");

  // Refs
  const cameraRef = useRef(null);
  const modalizeRef = useRef(null);
  const timerRef = useRef(null);

  // Camera setup
  const device = useCameraDevice('front');
  const { hasPermission, requestPermission } = useCameraPermission();

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  // Photo capture handler
  const takePicture = async () => {
    if (!cameraRef.current || !cameraReady || count >= 5) return;

    try {
      const photo = await cameraRef.current.takePhoto({
        qualityPrioritization: "quality",
        flash: flash,
        skipMetadata: true,
      });

      // Convert to base64
      const response = await fetch(`file://${photo.path}`);
      const blob = await response.blob();
      const base64data = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => resolve(reader.result.split(",")[1]);
      });

      const newPreviewImage = [...thumbnailPreview];
      const newBase64Image = [...base64Image];
      const emptyIndex = newPreviewImage.findIndex((item) => !item);

      if (emptyIndex !== -1) {
        newPreviewImage[emptyIndex] = `file://${photo.path}`;
        newBase64Image[emptyIndex] = base64data;

        setThumbnailPreview(newPreviewImage);
        setBase64Image(newBase64Image);
        setCount((prev) => prev + 1);

        if (count + 1 === 5) {
          Alert.alert(
            "Success",
            "5 photos captured. Ready to register!",
            [{ text: "OK" }],
            { cancelable: false }
          );
        }
      }
    } catch (error) {
      console.error("Camera error:", error);
      Alert.alert("Error", "Failed to capture image");
    }
  };

  // Remove photo from preview
  const onRemovePhoto = (index) => {
    const newPreviewImage = [...thumbnailPreview];
    const newBase64Image = [...base64Image];
    newBase64Image[index] = "";
    newPreviewImage[index] = "";
    setThumbnailPreview(newPreviewImage);
    setBase64Image(newBase64Image);
    setCount((prev) => prev - 1);
  };

  // Register faces with AWS
  const registerFace = async () => {
    const employeeDetails = await getData(LocalDBItems.employeeDetails);
    setUserName(employeeDetails.full_name);
    setLoading(true);

    try {
      await saveFaceReg();
    } catch (error) {
      console.error("Registration failed:", error);
      setLoading(false);
      Alert.alert("Error", "Registration failed. Please try again.");
    }
  };

  // Save face registration data
  const saveFaceReg = async () => {
    const employeeDetails = await getData(LocalDBItems.employeeDetails);
    let faceIDArray = [];

    try {
      const responses = await Promise.all([
        getImageAndName(0),
        getImageAndName(1),
        getImageAndName(2),
        getImageAndName(3),
        getImageAndName(4),
      ]);

      faceIDArray = responses.map((res) => res.FaceRecords[0].Face.FaceId);
      await storeData(LocalDBItems.saveFaceIDData, faceIDArray);
      await saveFaceIDRegistration(faceIDArray[0]);
    } catch (err) {
      console.error("Error in saveFaceReg:", err);
      throw err;
    }
  };

  // Process individual image
  const getImageAndName = async (index) => {
    const employeeDetails = await getData(LocalDBItems.employeeDetails);
    const organizationDetails = await getData(LocalDBItems.organizationDetails);
    const org_name = organizationDetails.org_name.replace(/[ ]+/g, "");
    const full_name = employeeDetails.full_name.replace(/[ ]+/g, "");
    const collection_id = `face-collection-${org_name.toLowerCase()}`;

    return await addFaceRekognitionService(
      base64Image[index],
      `${full_name.toLowerCase()}${index}.jpeg`,
      full_name.toLowerCase(),
      collection_id
    );
  };

  // Save face ID to backend
  const saveFaceIDRegistration = async (faceId) => {
    const employeeDetails = await getData(LocalDBItems.employeeDetails);
    const params = { empid: employeeDetails.id, faceid: faceId };

    try {
      const requestObj = {
        endpoint: BaseUrl.API_BASE_URL + Endpoint.SAVE_FACEID_REGISTRATION,
        type: "patch",
        params: params,
      };

      const apiResponseData = await apiService(requestObj);

      if (apiResponseData) {
        await storeData(LocalDBItems.isUserAuthenticated, true);
        const updatedDetails = { ...employeeDetails, is_face_recog: true };
        await storeData(LocalDBItems.employeeDetails, updatedDetails);

        setLoading(false);
        if (modalizeRef.current) {
          modalizeRef.current.open();
          timerRef.current = setTimeout(() => {
            NavigationService.navigateAndReset("App", {});
          }, 2000);
        }
      } else {
        throw new Error("API response was invalid");
      }
    } catch (error) {
      console.error("Error in saveFaceIDRegistration:", error);
      throw error;
    }
  };

  // UI Components
  const renderThumbnailItem = ({ item, index }) => (
    <View style={styles.thumbnailItemContainer}>
      {item ? (
        <Image
          style={styles.previewImage}
          resizeMode="cover"
          source={{ uri: item }}
        />
      ) : (
        <Image
          style={[styles.previewImage, styles.defaultPreviewImage]}
          resizeMode="cover"
          source={Images.defaultFaceIcon}
        />
      )}
      <TouchableOpacity
        style={styles.closeButton}
        disabled={!item}
        onPress={() => onRemovePhoto(index)}
      >
        <Text style={styles.closeText}>Remove</Text>
      </TouchableOpacity>
    </View>
  );

  const renderSuccessModal = () => (
    <Modalize ref={modalizeRef} adjustToContentHeight={true}>
      <View style={styles.modalContent}>
        <View style={styles.popupImageContainer}>
          <Image
            style={styles.profileImage}
            resizeMode="cover"
            source={{ uri: thumbnailPreview[0] }}
          />
          <Image
            style={styles.checkedIcon}
            source={Images.checkTickIcon}
            resizeMode="contain"
          />
        </View>
        <View style={styles.nameContainer}>
          <Text style={styles.nameText}>{userName || "--"}</Text>
        </View>
        <View style={styles.messageContainer}>
          <Text style={styles.successMessage}>
            Your face recognition is successfully configured!
          </Text>
        </View>
        <View style={styles.redirectContainer}>
          <Text style={styles.redirectText}>Redirecting to dashboard...</Text>
        </View>
      </View>
    </Modalize>
  );

  if (hasPermission === false) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>
          We need camera access to register your face.{'\n'}
          Please enable camera permissions in settings.
        </Text>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={async () => {
            await Camera.openSettings();
          }}
        >
          <Text style={styles.buttonText}>Open Settings</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.permissionButton, styles.backButton]}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.buttonText, styles.backButtonText]}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.deviceNotFoundContainer}>
        <Text style={styles.errorText}>Camera device not found</Text>
      </View>
    );
  }

    return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#ffffff" />
        </View>
      )}

      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        photo={true}
        onInitialized={() => setCameraReady(true)}
      />

      <View style={styles.headerContainer}>
        <TouchableOpacity
          style={styles.backButtonContainer}
          onPress={() => navigation.goBack()}
        >
          <Icon name="angle-left" size={30} color="white" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setFlash(flash === "off" ? "on" : "off")}
        >
          <Icon
            name={flash === "off" ? "flash" : "flash"}
            size={24}
            color="white"
          />
        </TouchableOpacity>
      </View>

      <View style={styles.faceMaskContainer}>
        <Image
          style={styles.faceMaskImage}
          source={Images.defaultFaceMaskIcon}
          resizeMode="contain"
        />
      </View>

      {/* Main content container */}
      <View style={styles.contentContainer}>
        {/* Thumbnail list positioned above buttons */}
        <View style={styles.thumbnailListContainer}>
          <FlatList
            style={styles.thumbnailList}
            numColumns={thumbnailPreview.length}
            data={thumbnailPreview}
            renderItem={renderThumbnailItem}
            keyExtractor={(_, index) => index.toString()}
            scrollEnabled={false}
          />
        </View>

        {/* Buttons container */}
        <View style={styles.buttonsContainer}>
          {count < 5 ? (
            <TouchableOpacity
              style={styles.captureButton}
              onPress={takePicture}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={["#fe717f", "#fa8576", "#f6976e"]}
                style={styles.gradientButton}
                start={{ x: 0.5, y: 1.0 }}
                end={{ x: 0.0, y: 0.25 }}
              >
                <Text style={styles.buttonText}>Capture</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.registerButton}
              onPress={registerFace}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={["#fe717f", "#fa8576", "#f6976e"]}
                style={styles.gradientButton}
                start={{ x: 0.5, y: 1.0 }}
                end={{ x: 0.0, y: 0.25 }}
              >
                <Text style={styles.buttonText}>Register</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {renderSuccessModal()}
      <CustomPopUpModal
        modalVisible={showAlertIdNoFace}
        modalCloseAction={() => setShowAlertIdNoFace(false)}
        isVerifcationPopUp={true}
        isReverification={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  headerContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  backButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    color: 'white',
    marginLeft: 5,
    fontSize: 16,
  },
  faceMaskContainer: {
    position: 'absolute',
    top: '20%',
    alignSelf: 'center',
    zIndex: 10,
  },
  faceMaskImage: {
    height: width * 1.3,
    aspectRatio: 1,
  },
  contentContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    alignItems: 'center',
  },
  thumbnailListContainer: {
    marginBottom: 20,
    width: '100%',
  },
  thumbnailList: {
    alignSelf: 'center',
  },
  thumbnailItemContainer: {
    marginHorizontal: 5,
  },
  previewImage: {
    width: 70,
    height: 70,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  defaultPreviewImage: {
    tintColor: 'white',
  },
  closeButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
    padding: 3,
  },
  closeText: {
    color: 'white',
    fontSize: 10,
  },
  buttonsContainer: {
    width: '100%',
    alignItems: 'center',
  },
  captureButton: {
    width: '100%',
    maxWidth: 100,
  },
  registerButton: {
    width: '80%',
    maxWidth: 300,
  },
  // gradientButton: {
  //   paddingVertical: 15,
  //   paddingHorizontal: 40,
  //   borderRadius: 30,
  //   alignItems: 'center',
  //   justifyContent: 'center',
  //   width: '100%',
  //   height:'30%'
  // },
  buttonText: {
    color: 'black',
    fontSize: 30,
    fontWeight: 'bold',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'black',
    padding: 20,
  },
  permissionText: {
    color: 'white',
    marginBottom: 20,
    textAlign: 'center',
    fontSize: 16,
  },
  permissionButton: {
    backgroundColor: '#fe717f',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 30,
    marginVertical: 10,
    width: '80%',
    alignItems: 'center',
  },
  backButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#fe717f',
  },
  backButtonText: {
    color: '#fe717f',
  },
  deviceNotFoundContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'black',
  },
  errorText: {
    color: 'white',
    fontSize: 16,
  },
  modalContent: {
    padding: 20,
    backgroundColor: 'white',
  },
  popupImageContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  checkedIcon: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 30,
    height: 30,
  },
  nameContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  nameText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  messageContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  successMessage: {
    fontSize: 16,
    textAlign: 'center',
  },
  redirectContainer: {
    alignItems: 'center',
  },
  redirectText: {
    fontSize: 14,
    color: 'gray',
  },
});
export default FaceRegistrationScreen;