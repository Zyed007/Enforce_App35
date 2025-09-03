import * as React from "react";
import {
  Text,
  View,
  Switch,
  TouchableOpacity
} from "react-native";
import styles from "./style";
import { RadioButton } from "react-native-paper";

const SwitchView = ({
  onChooseOffice,
  isOffice,
  onChooseWrkFromHome,
  isWorkFromHome,
  onChooseManual,
  isManual,
}) => {
  return (
    <View
      style={{
        flexDirection: "row",
        padding: 20,
        justifyContent: "space-between",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "flex-start",
          alignItems: "center",
        }}
      >
        <Text style={styles.teamText}>Office</Text>
        <Switch
          value={isOffice}
          color={"#fe717f"}
          onValueChange={onChooseOffice}
        />
      </View>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "flex-start",
          alignItems: "center",
        }}
      >
        <Text style={styles.teamText}>WFH</Text>
        <Switch
          value={isWorkFromHome}
          color={"#fe717f"}
          onValueChange={onChooseWrkFromHome}
        />
      </View>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "flex-start",
          alignItems: "center",
        }}
      >
        <Text style={styles.teamText}>Manual</Text>
        <Switch
          value={isManual}
          color={"#fe717f"}
          onValueChange={onChooseManual}
        />
      </View>
    </View>
  );
};

const SwitchViewNew = ({
  onChooseOffice,
  isOffice,
  onChooseWrkFromHome,
  isWorkFromHome,
  onChoosePlace,
  isPlace,
}) => {
  return (
    <View
      style={{
        flexDirection: "column",
        padding: 20,
        justifyContent: "space-between",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "flex-start",
          alignItems: "center",
          height: 60,
        }}
      >
        <Text style={[styles.teamText, { color: "grey" }]}>Office / WFH</Text>
        <Switch
  value={isPlace}
  onValueChange={onChoosePlace}
  trackColor={{ false: "#ccc", true: "#ff9999" }}  // background/track color
  thumbColor={isPlace ? "#fe717f" : "#f4f3f4"}         // toggle/knob color
/>
        <Text style={[styles.teamText, { color: "grey" }]}>Place</Text>
      </View>
      <View
        style={{
          height: 1,
          marginTop: 20,
          backgroundColor: "#DCDCDC",
          flex: 1,
        }}
      ></View>
      {isPlace == false && (
        <OfficeAndWfhView
          onChooseOffice={onChooseOffice}
          isOffice={isOffice}
          isWorkFromHome={isWorkFromHome}
          onChooseWrkFromHome={onChooseWrkFromHome}
        />
      )}
    </View>
  );
};

const OfficeAndWfhView = ({
  onChooseOffice,
  isOffice,
  onChooseWrkFromHome,
  isWorkFromHome,
}) => {
  return (
    <View style={{ flexDirection: 'row', marginTop: 30, height: 60 }}>
      {/* Office Option */}
      <TouchableOpacity
        style={{
          flexDirection: 'row',
          backgroundColor: isOffice ? '#e1f5ee' : '#DCDCDC',
          padding: 10,
          borderRadius: 20,
          height: 40,
          alignItems: 'center',
          borderWidth: isOffice ? 1 : 0,
          borderColor: '#229b6f',
        }}
        onPress={onChooseOffice}
      >
        <Text style={[styles.teamText, { color: isOffice ? '#229b6f' : 'grey' }]}>
          Office
        </Text>
        <View style={{ marginLeft: 8 }}>
          <RadioButton.Android
            color="#229b6f"
            status={isOffice ? 'checked' : 'unchecked'}
            onPress={onChooseOffice}
          />
        </View>
      </TouchableOpacity>

      {/* WFH Option */}
      <TouchableOpacity
        style={{
          flexDirection: 'row',
          marginLeft: 20,
          backgroundColor: isWorkFromHome ? '#e1f5ee' : '#DCDCDC',
          padding: 10,
          borderRadius: 20,
          height: 40,
          alignItems: 'center',
          borderWidth: isWorkFromHome ? 1 : 0,
          borderColor: '#229b6f',
        }}
        onPress={onChooseWrkFromHome}
      >
        <Text style={[styles.teamText, { color: isWorkFromHome ? '#229b6f' : 'grey' }]}>
          WFH
        </Text>
        <View style={{ marginLeft: 8 }}>
          <RadioButton.Android
            color="#229b6f"
            status={isWorkFromHome ? 'checked' : 'unchecked'}
            onPress={onChooseWrkFromHome}
          />
        </View>
      </TouchableOpacity>
    </View>
  );
};

export default SwitchViewNew;
