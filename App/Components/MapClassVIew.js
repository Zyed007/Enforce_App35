import React from "react";
import {
  View,
  Image,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Text,
  Platform,
} from "react-native";
import MapView, {
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
  AnimatedRegion,
} from "react-native-maps";
import { Colors, Images } from "../Theme";
import { getData, LocalDBItems } from "../Services/LocalStorage";
import Geolocation from "react-native-geolocation-service";
import { getPathLength } from "geolib";
import Icon from "react-native-vector-icons/FontAwesome5Pro";

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
    };

    this.map = null;
  }

  async componentDidMount() {
    let storedLocationArray = await getData(LocalDBItems.locationArrayForTracing);

    if (storedLocationArray && storedLocationArray.length > 0) {
      const last = storedLocationArray[storedLocationArray.length - 1];
      this.setState({
        latitude: last.latitude,
        longitude: last.longitude,
        routeCoordinates: storedLocationArray,
        distanceTravelled: getPathLength(storedLocationArray) / 1000,
        animatedCoordinate: new AnimatedRegion({
          ...last,
          latitudeDelta: LATITUDE_DELTA,
          longitudeDelta: LONGITUDE_DELTA,
        }),
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

        // Animate marker coordinate update
        this.state.animatedCoordinate.timing({
          latitude: newCoordinate.latitude,
          longitude: newCoordinate.longitude,
          duration: 500,
          useNativeDriver: false,
        }).start();

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
        showLocationDialog: true,
      }
    );
  };

  render() {
    const { animatedCoordinate, routeCoordinates, distanceTravelled } = this.state;

    // Use MapView.Animated for smooth animations
    const AnimatedMapView = MapView.Animated;

    return (
      <View style={{ flex: 1 }}>
        <AnimatedMapView
          ref={(ref) => {
            this.map = ref;
          }}
          provider={PROVIDER_GOOGLE}
          style={{
            height: this.props.height || windowHeight * 0.8,
            width: windowWidth,
            marginHorizontal: 10,
          }}
          region={this.state.coordinate}  // <-- changed here from initialRegion to region
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
              <Icon name="map-marker-alt" size={40} color={Colors.darkGrey} />
            </Marker>
          )}

          {/* Animated current location marker */}
          <Marker.Animated
            coordinate={animatedCoordinate}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <Image
              source={Images.mapCurrentLocation}
              style={{ width: 40, height: 40 }}
            />
          </Marker.Animated>

          {/* Polyline route */}
          {routeCoordinates.length > 0 && (
            <Polyline
              coordinates={routeCoordinates}
              strokeColor="black"
              strokeWidth={2}
            />
          )}
        </AnimatedMapView>

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
  bubble: {
    flex: 1,
    backgroundColor: "white",
    paddingHorizontal: 18,
    paddingVertical: 12,
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
});
