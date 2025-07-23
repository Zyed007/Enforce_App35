import React from "react";
import {
  View,
  Image,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Text,
  Platform,
  PermissionsAndroid
} from "react-native";
import MapView, {
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
  PROVIDER_DEFAULT,
  AnimatedRegion
} from "react-native-maps";
import { Colors, Images } from "../Theme";
import { getData, LocalDBItems } from "../Services/LocalStorage";
import Geolocation from "react-native-geolocation-service";
import { getPathLength } from "geolib";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

const windowWidth = Dimensions.get("window").width;
const windowHeight = Dimensions.get("window").height;

const LATITUDE_DELTA = 0.009;
const LONGITUDE_DELTA = 0.009;
const DEFAULT_LATITUDE = 29.95539;
const DEFAULT_LONGITUDE = 78.07513;

export default class MapForPolyline extends React.Component {
  constructor(props) {
    super(props);

    const initialCoordinate = {
      latitude: DEFAULT_LATITUDE,
      longitude: DEFAULT_LONGITUDE,
    };

    this.state = {
      latitude: initialCoordinate.latitude,
      longitude: initialCoordinate.longitude,
      routeCoordinates: [],
      distanceTravelled: 0,
      animatedCoordinate: new AnimatedRegion({
        ...initialCoordinate,
        latitudeDelta: LATITUDE_DELTA,
        longitudeDelta: LONGITUDE_DELTA,
      }),
      coordinate: {
        ...initialCoordinate,
        latitudeDelta: LATITUDE_DELTA,
        longitudeDelta: LONGITUDE_DELTA,
      },
      hasLocationPermission: false,
    };

    this.map = null;
  }

  async requestLocationPermission() {
    if (Platform.OS === 'ios') {
      const status = await Geolocation.requestAuthorization('whenInUse');
      this.setState({
        hasLocationPermission: status === 'granted',
      });
      return status === 'granted';
    }

    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: "Location Permission",
          message: "This app needs access to your location",
          buttonNeutral: "Ask Me Later",
          buttonNegative: "Cancel",
          buttonPositive: "OK"
        }
      );
      this.setState({
        hasLocationPermission: granted === PermissionsAndroid.RESULTS.GRANTED,
      });
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
  }

  async componentDidMount() {
    const hasPermission = await this.requestLocationPermission();
    if (!hasPermission) return;

    let storedLocationArray = await getData(LocalDBItems.locationArrayForTracing);

    if (storedLocationArray && storedLocationArray.length > 0) {
      const last = storedLocationArray[storedLocationArray.length - 1];
      const newCoordinate = new AnimatedRegion({
        ...last,
        latitudeDelta: LATITUDE_DELTA,
        longitudeDelta: LONGITUDE_DELTA,
      });
      
      this.setState({
        latitude: last.latitude,
        longitude: last.longitude,
        routeCoordinates: storedLocationArray,
        distanceTravelled: getPathLength(storedLocationArray) / 1000,
        animatedCoordinate: newCoordinate,
        coordinate: {
          ...last,
          latitudeDelta: LATITUDE_DELTA,
          longitudeDelta: LONGITUDE_DELTA,
        },
      });
    }

    this.watchPosition();
  }

  componentWillUnmount() {
    if (this.watchId != null) {
      Geolocation.clearWatch(this.watchId);
    }
  }

  watchPosition = () => {
    this.watchId = Geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const newCoordinate = { latitude, longitude };

        let storedLocationArray = (await getData(LocalDBItems.locationArrayForTracing)) || [];

        // Update path
        const updatedRoute = [...storedLocationArray, newCoordinate];
        const distance = getPathLength(updatedRoute) / 1000;

        // For iOS, we need to handle animations differently
        if (Platform.OS === 'ios') {
          this.state.animatedCoordinate.timing({
            latitude: newCoordinate.latitude,
            longitude: newCoordinate.longitude,
            duration: 500,
            useNativeDriver: false,
          }).start();
        } else {
          this.setState({
            animatedCoordinate: new AnimatedRegion({
              ...newCoordinate,
              latitudeDelta: LATITUDE_DELTA,
              longitudeDelta: LONGITUDE_DELTA,
            }),
          });
        }

        this.setState({
          latitude,
          longitude,
          routeCoordinates: updatedRoute,
          distanceTravelled: distance,
          coordinate: {
            ...newCoordinate,
            latitudeDelta: LATITUDE_DELTA,
            longitudeDelta: LONGITUDE_DELTA,
          },
        });

        if (this.map) {
          this.map.animateToRegion(
            {
              ...newCoordinate,
              latitudeDelta: LATITUDE_DELTA,
              longitudeDelta: LONGITUDE_DELTA,
            },
            500
          );
        }
      },
      (error) => console.warn(error),
      {
        enableHighAccuracy: true,
        distanceFilter: 10,
        interval: 5000,
        fastestInterval: 2000,
        showLocationDialog: Platform.OS === 'android',
      }
    );
  };

  render() {
    const { animatedCoordinate, routeCoordinates, distanceTravelled, hasLocationPermission } = this.state;

    if (!hasLocationPermission) {
      return (
        <View style={styles.container}>
          <Text>Location permission is required for this feature</Text>
        </View>
      );
    }

    return (
      <View style={{ flex: 1 }}>
        <MapView
          ref={(ref) => {
            this.map = ref;
          }}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
          style={{
            height: this.props.height || windowHeight * 0.8,
            width: windowWidth,
            marginHorizontal: 10,
          }}
          region={this.state.coordinate}
          showsUserLocation={false}
          showsCompass={true}
          zoomEnabled={true}
          zoomControlEnabled={true}
          showsMyLocationButton={true}
        >
          {/* Static marker from props */}
          {this.props.coordinate && (
            <Marker
              coordinate={this.props.coordinate}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={styles.circleWrapper}>
  <Icon name="checkbox-blank-circle" size={20} color={Colors.lightblue} />
</View>
            </Marker>
          )}

          {/* Animated current location marker */}
          {/* <Marker
            coordinate={this.state.animatedCoordinate}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <Image
              source={Images.mapCurrentLocation}
              style={{ width: 50, height: 50 }}
            />
          </Marker> */}

          {/* Polyline route */}
          {routeCoordinates.length > 0 && (
            <Polyline
              coordinates={routeCoordinates}
              strokeColor="black"
              strokeWidth={2}
            />
          )}
        </MapView>

        {/* Distance Covered Display */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={[styles.bubble, styles.button]}>
            <Text style={styles.bottomBarContent}>
              Distance covered: {distanceTravelled.toFixed(2)} km
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bubble: {
    flex: 1,
    backgroundColor: "white",
    paddingHorizontal: 5,
    paddingVertical: 40,
    borderRadius: 20,
  },
  button: {
    width: 140,
    paddingHorizontal: 12,
    alignItems: "center",
    marginHorizontal: 10,
  },
  buttonContainer: {
    bottom: 10,
    flexDirection: "row",
    position: "absolute",
    zIndex: 10,
  },
  bottomBarContent: {
    fontSize: 18,
    color: "#fe717f",
    fontWeight: "bold",
    paddingLeft: 5,
  },
   circleWrapper: {
    width: 30,
    height: 30,
    borderRadius: 50,
    backgroundColor: 'white', // Or any background to match design
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2, // For Android shadow
    borderWidth: 1,
    borderColor: Colors.lightblue,
  },
});