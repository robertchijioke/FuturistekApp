import { useLocalSearchParams, useRouter } from "expo-router";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { auth, db } from "../lib/firebase";

export default function DeviceSetupScreen() {
  const router = useRouter();
  const { type, discoveredId, suggestedName } = useLocalSearchParams();

  const [deviceName, setDeviceName] = useState(
    String(suggestedName || "")
  );
  const [room, setRoom] = useState("");

  return (
    <View style={styles.container}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>{type}</Text>

      <Text style={styles.label}>Device Name</Text>

      <TextInput
        style={styles.input}
        placeholder="Living Room Light"
        placeholderTextColor="#777"
        value={deviceName}
        onChangeText={setDeviceName}
      />

      <Text style={styles.label}>Room</Text>

      <TextInput
        style={styles.input}
        placeholder="Living Room"
        placeholderTextColor="#777"
        value={room}
        onChangeText={setRoom}
      />

      <Pressable
        style={styles.button}
        onPress={async () => {
          try {
            const user = auth.currentUser;

            if (!user) {
              Alert.alert("Login required", "Please log in to add a device.");
              return;
            }

            if (!deviceName.trim() || !room.trim()) {
              Alert.alert("Missing details", "Please enter device name and room.");
              return;
            }

            await addDoc(collection(db, "users", user.uid, "devices"), {
              name: deviceName.trim(),
              room: room.trim(),
              type: String(type),
              status: "Online",
              discoveredId: String(discoveredId || ""),
              brightness: 100,
              createdAt: serverTimestamp(),
            });

            Alert.alert("Device added", `${deviceName} has been added.`);
            router.back();
          } catch (error) {
            console.log("Add device error:", error);
            Alert.alert("Error", "Could not add device. Please try again.");
          }
        }}
      >
        <Text style={styles.buttonText}>Add Device</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#071827",
    padding: 24,
    paddingTop: 70,
  },

  back: {
    color: "#7CC8FF",
    fontSize: 18,
    marginBottom: 24,
  },

  title: {
    color: "#fff",
    fontSize: 34,
    fontWeight: "800",
    marginBottom: 30,
  },

  label: {
    color: "#fff",
    marginBottom: 8,
    fontSize: 16,
  },

  input: {
    backgroundColor: "#0B2236",
    color: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },

  button: {
    backgroundColor: "#1E88E5",
    padding: 18,
    borderRadius: 18,
    alignItems: "center",
    marginTop: 10,
  },

  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
});