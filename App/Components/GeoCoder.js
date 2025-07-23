import React from 'react';
import Geocoder from 'react-native-geocoding';

export default class GeoCoder {
  
    initiaLizeGeoCoder (){
        Geocoder.init("AIzaSyB3hwfUatf5xJi7MXu_1XOBhce0k5vtmFo");
    }
getPlaceFromCordinate = async (latitude, longitude) => {
  console.log('------ called', latitude, longitude);
  return Geocoder.from(latitude, longitude)
    .then(json => {
      let addressDetails = {
        formatted_address: json.results[0]?.formatted_address || "",
        street_number: "",
        country: "",
        locality: "",
        route: "",
        latitude: json.results[0]?.geometry?.location?.lat || 0.0,
        longitude: json.results[0]?.geometry?.location?.lng || 0.0
      };

      // Extract all address components
      json.results[0]?.address_components?.forEach(component => {
        component.types.forEach(type => {
          switch (type) {
            case 'street_number':
              addressDetails.street_number = component.long_name;
              break;
            case 'route':
              addressDetails.route = component.long_name;
              break;
            case 'locality':
              addressDetails.locality = component.long_name;
              break;
            case 'administrative_area_level':
              addressDetails.administrative_area_level_1 = component.long_name;
              break;
            case 'administrative_area_level':
              addressDetails.administrative_area_level_2 = component.long_name;
              break;
            case 'country':
              addressDetails.country = component.long_name;
              break;
            case 'postal_code':
              addressDetails.postal_code = component.long_name;
              break;
          }
        });
      });

    //   console.log("[GeoCoder.js] Full location details:", addressDetails);
      return addressDetails;
    })
    .catch(error => {
      console.error("Geocoding error:", error);
      return {
        formatted_address: "",
        street_number: "",
        country: "",
        administrative_area_level_1: "",
        administrative_area_level_2: "",
        locality: "",
        route: "",
        postal_code: "",
        latitude: 0.0,
        longitude: 0.0
      };
    });
}
}