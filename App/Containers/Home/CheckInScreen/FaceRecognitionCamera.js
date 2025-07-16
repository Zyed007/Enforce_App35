// FaceRecognitionCamera.js
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Image } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
//import { useFaceDetector } from 'react-native-vision-camera-face-detector';
import RNFS from 'react-native-fs';
import Loader from "../../../Components/Loader";

const FaceRecognitionCamera = ({ onPhotoTaken, onDismiss }) => {
  const cameraRef = useRef(null);
  const [isActive, setIsActive] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(5);

  const device = useCameraDevice('front');

  // Face detection configuration
  const faceDetectionOptions = {
    performanceMode: 'fast',
    landmarkMode: 'none',
    contourMode: 'none',
    minFaceSize: 0.1, // Lower threshold to detect partial faces
  };
  //const { faces, detectFaces } = useFaceDetector(faceDetectionOptions);

  // Request camera permissions
  useEffect(() => {
    const requestPermissions = async () => {
      const status = await Camera.requestCameraPermission();
      setHasPermission(status === 'granted');
    };
    requestPermissions();
  }, []);

  // Auto capture after 5 seconds
  useEffect(() => {
    if (!hasPermission || !device) return;

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          capturePhoto();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [hasPermission, device]);

  const capturePhoto = async () => {
    try {
      if (!cameraRef.current) return;
      
      setIsLoading(true);
      setIsActive(false); // Freeze the camera

      const photo = await cameraRef.current.takePhoto({
        qualityPrioritization: 'speed',
        flash: 'off',
        skipMetadata: true,
      });

      // Read file as base64
      const base64 = await RNFS.readFile(photo.path, 'base64');
      setCapturedPhoto(`data:image/jpeg;base64,${base64}`);
      
      // Process the photo
      await onPhotoTaken(base64);
      
    } catch (error) {
      console.error('Capture error:', error);
      Alert.alert('Error', 'Failed to capture photo');
    } finally {
      setIsLoading(false);
    }
  };

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Camera permission required</Text>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Front camera not available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {capturedPhoto ? (
        <Image 
          source={{ uri: capturedPhoto }} 
          style={StyleSheet.absoluteFill} 
          resizeMode="cover"
        />
      ) : (
        <Camera
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={isActive}
          photo={true}
        />
      )}
      
      <View style={styles.overlay}>
        <View style={styles.faceGuide} />
        
        {!capturedPhoto && (
          <View style={styles.countdownContainer}>
            <Text style={styles.countdownText}>Capturing in {countdown} seconds</Text>
          </View>
        )}
      </View>
      
      <Loader loading={isLoading} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  text: {
    color: 'white',
    fontSize: 18,
  },
  overlay: {
    position: 'absolute',
    bottom: 50,
    width: '100%',
    alignItems: 'center',
  },
  faceGuide: {
    width: 250,
    height: 300,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 10,
    marginBottom: 30,
  },
  countdownContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 15,
    borderRadius: 20,
  },
  countdownText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default FaceRecognitionCamera;