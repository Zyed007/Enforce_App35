import React from "react";
import {
  View,
  Image,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Text,
} from "react-native";
import MapView, {
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
} from "react-native-maps";
import { Colors, Helpers, Images, Metrics } from "../Theme";
import haversine from "haversine";
import {
  getData,
  LocalDBItems,
  storeData,
  wipeData,
} from "../Services/LocalStorage";
import UtilityHelper from "./UtilityHelper";
import Geolocation from "react-native-geolocation-service";
import { getPathLength } from "geolib";
import Icon from "react-native-vector-icons/FontAwesome5Pro";

const windowWidth = Dimensions.get("window").width;

const LATITUDE_DELTA = 0.009;
const LONGITUDE_DELTA = 0.009;
const LATITUDE = 29.95539;
const LONGITUDE = 78.07513;

export default class MapForPolyline extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      latitude: LATITUDE,
      longitude: LONGITUDE,
      locationTrackingCOrindates: [],
      routeCoordinates: [],
      distanceTravelled: 0,
      prevLatLng: {},
      coordinate: {
        latitude: LATITUDE,
        longitude: LONGITUDE,
        latitudeDelta: LATITUDE_DELTA,
        longitudeDelta: LONGITUDE_DELTA,
      },
    };

    this.markekerCordinte = {
      latitude: 9.947236,
      longitude: 76.347843,
    };

    this.isInitialLoad = true;
  }

  async componentDidMount() {
    let locationArray = await getData(LocalDBItems.locationArrayForTracing);
    if (locationArray && locationArray.length > 0) {
      let location = locationArray[locationArray.length - 1];
      this.trackLocationOnMap(location);
    } else {
      Geolocation.getCurrentPosition(
        async (position) => {
          let location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          this.trackLocationOnMap(location);
        },
        (error) => {
          console.warn("Error getting current location:", error);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );
    }
  }

  trackLocationOnMap = async (location) => {
    let updatedLocationArray = await getData(
      LocalDBItems.locationArrayForTracing
    );

    this.markekerCordinte = location;

    const distanceTravelledWithLocation =
      getPathLength(updatedLocationArray) / 1000;

    this.setState(
      {
        latitude: location.latitude,
        longitude: location.longitude,
        routeCoordinates:
          updatedLocationArray.length === 0 ? [location] : updatedLocationArray,
        coordinate: location,
        distanceTravelled: distanceTravelledWithLocation,
        prevLatLng: location,
      },
      () => {
        if (this.map && updatedLocationArray.length > 0) {
          setTimeout(() => {
            this.map.fitToCoordinates(updatedLocationArray, {
              edgePadding: {
                top: 20,
                bottom: 20,
                left: 20,
                right: 20,
              },
              animated: true,
            });
          }, 100);
        }
      }
    );
  };

  onMapReady = () => {
    const { routeCoordinates } = this.state;
    if (routeCoordinates && routeCoordinates.length > 0) {
      this.map.fitToCoordinates(routeCoordinates, {
        edgePadding: {
          top: 10,
          right: 10,
          bottom: 10,
          left: 10,
        },
        animated: false,
      });
    }
  };

  render() {
    return (
      <View style={{ flex: 1 }}>
        <MapView
          ref={(map) => {
            this.map = map;
          }}
          provider={PROVIDER_GOOGLE}
          onMapReady={this.onMapReady}
          showsUserLocation={true}
          style={{
            height: this.props.height || 400,
            width: windowWidth,
            marginHorizontal: 10,
          }}
          initialRegion={{
            latitude: 25.2048,
            longitude: 55.2708,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          }}
        >
          {/* Marker for provided coordinate */}
          {this.props.coordinate && (
            <Marker
              coordinate={this.props.coordinate}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <Icon name="map-marker-alt" size={40} color={Colors.darkGrey} />
            </Marker>
          )}

          {/* Marker for current or last known position */}
          <Marker
            coordinate={this.markekerCordinte}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <Image
              source={Images.mapCurrentLocation}
              style={{ width: 40, height: 40 }}
            />
          </Marker>

          {/* Polyline for tracked route */}
          {this.state.routeCoordinates.length > 0 && (
            <Polyline
              coordinates={this.state.routeCoordinates}
              strokeColor="black"
              strokeWidth={2}
            />
          )}
        </MapView>

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={[styles.bubble, styles.button]}>
            <Text style={styles.bottomBarContent}>
              Distance covered:{" "}
              {parseFloat(this.state.distanceTravelled).toFixed(2)} km
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
    width: 80,
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
