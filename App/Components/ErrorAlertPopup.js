import React, { useState } from "react";
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from "react-native";
import { Picker } from '@react-native-picker/picker';
import color from "../Theme/Colors";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import LinearGradient from "react-native-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";

const ErrorAlertPopup = ({
  modalVisible,
  modalCloseAlertAction,
  isForceCheckoutPopup,
  modalCheckOutAction,
  modalEndOfWorkAction,
  modalLogoutAction
}) => {
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedValue, setSelectedValue] = useState('');
  const [selectedHour, setSelectedHour] = useState('12');
  const [selectedMinute, setSelectedMinute] = useState('00');
  const [selectedPeriod, setSelectedPeriod] = useState('AM');

  const hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));
  const periods = ['AM', 'PM'];

  const storeDataReport = async () => {
    try {
      await AsyncStorage.setItem("newNameKey", selectedValue);
      const formattedTime = `${selectedHour}:${selectedMinute} ${selectedPeriod}`;
      await AsyncStorage.setItem("forcetime", formattedTime);
      modalLogoutAction();
    } catch (error) {
      console.error(error);
    }
  };

  const onValueChange = (itemValue) => {
    setSelectedValue(itemValue);
    setShowTimePicker(itemValue === 'Forgot to Checkout');
  };

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={modalVisible}
      onRequestClose={modalCloseAlertAction}
    >
      <View style={styles.centeredView}>
        <View style={styles.modalContainer}>
          <View style={styles.contentContainer}>
            {isForceCheckoutPopup && (
              <TouchableOpacity
                style={styles.closeButton}
                onPress={modalCloseAlertAction}
              >
                <Icon name="close" size={24} color="grey" />
              </TouchableOpacity>
            )}
            
            <View style={styles.textContainer}>
              <Text style={styles.titleText}>FORCE CHECKOUT</Text>
              <Text style={styles.subtitleText}>Are you sure to force check out?</Text>
              <Text style={styles.subtitleText}>Reason for Force Checkout</Text>
            </View>

            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedValue}
                onValueChange={onValueChange}
                style={styles.mainPicker}
                itemStyle={styles.pickerItem}
              >
                <Picker.Item label="Select an Option" value="" />
                <Picker.Item label="Forgot to Checkout" value="Forgot to Checkout" />
                <Picker.Item label="Still am in the Location" value="Still am in the Location" />
              </Picker>
            </View>

            {showTimePicker && (
              <View style={styles.timePickerContainer}>
                <View style={styles.timePickerColumn}>
                  <Text style={styles.timePickerLabel}>Hour</Text>
                  <Picker
                    selectedValue={selectedHour}
                    onValueChange={setSelectedHour}
                    style={styles.timePicker}
                    itemStyle={styles.pickerItem}
                  >
                    {hours.map(hour => (
                      <Picker.Item key={hour} label={hour} value={hour} />
                    ))}
                  </Picker>
                </View>

                <View style={styles.timePickerColumn}>
                  <Text style={styles.timePickerLabel}>Minutes</Text>
                  <Picker
                    selectedValue={selectedMinute}
                    onValueChange={setSelectedMinute}
                    style={styles.timePicker}
                    itemStyle={styles.pickerItem}
                  >
                    {minutes.map(minute => (
                      <Picker.Item key={minute} label={minute} value={minute} />
                    ))}
                  </Picker>
                </View>

                <View style={styles.timePickerColumn}>
                  <Text style={styles.timePickerLabel}>AM/PM</Text>
                  <Picker
                    selectedValue={selectedPeriod}
                    onValueChange={setSelectedPeriod}
                    style={styles.timePicker}
                    itemStyle={styles.pickerItem}
                  >
                    {periods.map(period => (
                      <Picker.Item key={period} label={period} value={period} />
                    ))}
                  </Picker>
                </View>
              </View>
            )}
          </View>

          <View style={styles.buttonContainer}>
            {isForceCheckoutPopup ? (
              <>
                <TouchableOpacity
                  style={[styles.button, styles.checkOutButton]}
                  onPress={modalCheckOutAction}
                >
                  <Text style={styles.buttonText}>Check Out</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.endDayButton]}
                  onPress={modalEndOfWorkAction}
                >
                  <Text style={styles.buttonText}>End of Day</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={modalCloseAlertAction}
                >
                  <Text style={[styles.buttonText, styles.cancelButtonText]}>No</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.confirmButton]}
                  onPress={storeDataReport}
                >
                  <Text style={styles.buttonText}>Yes</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContainer: {
    width: '80%',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  contentContainer: {
    paddingBottom: 20,
  },
  closeButton: {
    position: 'absolute',
    right: 10,
    top: 10,
    zIndex: 1,
  },
  textContainer: {
    marginBottom: 20,
    alignItems: 'center',
  },
  titleText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: color.darkGrey,
    marginBottom: 5,
  },
  subtitleText: {
    fontSize: 16,
    color: color.darkGrey,
    marginBottom: 10,
    textAlign: 'center',
  },
  pickerContainer: {
    borderWidth: 2,
    justifyContent: 'center',
    borderColor: '#ccc',
    borderRadius: 8,
    marginBottom: 15,
    overflow: 'hidden',
  },
  mainPicker: {
    width: '100%',
    height: Platform.OS === 'ios' ? 150 : 50,
    justifyContent: 'center',
  },
  pickerItem: {
    fontSize: 20,
  },
  timePickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    },
  timePickerColumn: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 0.5,
  },
  timePickerLabel: {
    fontSize: 15,
    color: color.darkGrey,
    marginBottom: 8,
  },
  timePicker: {
    width: '100%',
    height: Platform.OS === 'ios' ? 200 : 50,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  checkOutButton: {
    backgroundColor: color.pinkBorder,
  },
  endDayButton: {
    backgroundColor: color.pinkBorder,
  },
  cancelButton: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: color.pinkBorder,
  },
  cancelButtonText: {
    color: color.pinkBorder,
  },
  confirmButton: {
    backgroundColor: color.pinkBorder,
  },
});

export default ErrorAlertPopup;