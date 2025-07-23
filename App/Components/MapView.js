import React, { useState, useRef, useEffect } from "react";
import { Text, View, Alert, Platform, StyleSheet } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, Circle } from "react-native-maps";
import UtilityHelper from "../Components/UtilityHelper";
import GeoCoder from "../Components/GeoCoder";
import Icons from "react-native-vector-icons/MaterialCommunityIcons";

const LATITUDE_DELTA = 0.009;
const LONGITUDE_DELTA = 0.009;
const DEFAULT_LATITUDE = 29.95539;
const DEFAULT_LONGITUDE = 78.07513;

const MapViewEnforce = ({ coordinate, height, getWFHInfo, locationName }) => {
  const mapRef = useRef(null);
  const geoCoder = useRef(new GeoCoder());
  const markerRef = useRef(null);
  const [hasError, setHasError] = useState(false);
  const [draggable, setDraggable] = useState(true);

  const initialCoordinate = coordinate || {
    latitude: DEFAULT_LATITUDE,
    longitude: DEFAULT_LONGITUDE
  };

  const [selectedCoordinate, setSelectedCoordinate] = useState(initialCoordinate);
  const [userCurrentLocation, setUserCurrentLocation] = useState(initialCoordinate);
  const [address, setSelectedAddress] = useState("");
  const [region, setRegion] = useState({
    ...initialCoordinate,
    latitudeDelta: LATITUDE_DELTA,
    longitudeDelta: LONGITUDE_DELTA,
  });

  // Initialize geocoder and set initial location
  useEffect(() => {
    geoCoder.current.initiaLizeGeoCoder();
    if (coordinate) {
      setSelectedCoordinate(coordinate);
      setUserCurrentLocation(coordinate);
      updateRegion(coordinate);
    }
  }, [coordinate]);

  // Update address display when locationName changes
  useEffect(() => {
    const errorStatus = !locationName;
    setHasError(errorStatus);
    setSelectedAddress(locationName || "");
  }, [locationName]);

  const updateRegion = (coord) => {
    setRegion({
      ...coord,
      latitudeDelta: LATITUDE_DELTA,
      longitudeDelta: LONGITUDE_DELTA,
    });
  };

  const handleMarkerDragEnd = async (newCoordinate) => {
    const isInRadius = UtilityHelper.isLocationWithinTheRadius(
      newCoordinate,
      userCurrentLocation,
      500
    );

    if (isInRadius) {
      try {
        const placeInfo = await geoCoder.current.getPlaceFromCordinate(
          newCoordinate.latitude,
          newCoordinate.longitude
        );
        setHasError(!placeInfo.formatted_address);
        setSelectedAddress(placeInfo.formatted_address || "");
        getWFHInfo(placeInfo);
        setSelectedCoordinate(newCoordinate);
      } catch (error) {
        console.error("Geocoding error:", error);
        handleOutOfRadius();
      }
    } else {
      handleOutOfRadius();
    }
  };

  const handleOutOfRadius = () => {
    Alert.alert(
      "Location Restriction",
      "Dragging the marker outside the radius is not allowed. Please select precise location."
    );
    resetToCurrentLocation();
  };

  const resetToCurrentLocation = () => {
    setDraggable(false);
    setSelectedCoordinate(userCurrentLocation);
    updateRegion(userCurrentLocation);
    if (markerRef.current) {
      markerRef.current.animateMarkerToCoordinate(userCurrentLocation, 100);
    }
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        ...userCurrentLocation,
        latitudeDelta: LATITUDE_DELTA,
        longitudeDelta: LONGITUDE_DELTA,
      }, 100);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.mapContainer, { height }]}>
        <MapView
          ref={mapRef}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          style={styles.map}
          initialRegion={region}
          region={region}
          onRegionChangeComplete={setRegion}
          showsUserLocation={true}
          showsMyLocationButton={true}
          loadingEnabled={true}
        >
          <Circle
            center={userCurrentLocation}
            radius={100}
            fillColor="rgba(40, 109, 237, 0.14)"
            strokeColor="rgba(40, 109, 237, 0.14)"
            strokeWidth={1}
          />
        </MapView>
      </View>
      
      <View style={styles.addressContainer}>
        <Icons name="map-marker" size={25} color="grey" />
        <Text style={styles.addressText}>
          {hasError ? "Unable to fetch location" : address}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapContainer: {
    marginHorizontal: 10,
    borderRadius: 8,
    overflow: 'hidden',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  marker: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  addressContainer: {
    marginHorizontal: 10,
    marginTop: 5,
    flexDirection: "row",
    alignItems: "center",
    marginRight: 20,
  },
  addressText: {
    color: "grey",
    flex: 1,
    flexWrap: "wrap",
    marginLeft: 5,
  },
});

export default MapViewEnforce;