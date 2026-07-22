import { useLocalSearchParams, useRouter } from "expo-router";
import { deleteDoc, doc, updateDoc } from "firebase/firestore";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { auth, db } from "../lib/firebase";

export default function DeviceControlScreen() {
  const router = useRouter();
  const { id, name, type, room, status, brightness: brightnessParam } =
  useLocalSearchParams();
  const [brightness, setBrightness] = useState(
  Number(brightnessParam ?? 100)
);

  const isOn = status === "true";

  const isLight =
  type === "Smart Light" ||
  String(name).toLowerCase().includes("light");

  const isPlug = 
  String(type).toLowerCase().includes("plug");
  const isCamera = 
  String(type).toLowerCase().includes("camera");
  const isSensor = 
  String(type).toLowerCase().includes("sensor");
  const isRemote = 
  String(type).toLowerCase().includes("remote");

  async function toggleDevice() {
    const user = auth.currentUser;
    if (!user || !id) return;

    const newStatus = !isOn;

    await updateDoc(
      doc(db, "users", user.uid, "devices", String(id)),
      {
        status: newStatus,
        brightness: newStatus ? brightness : 0,
      }
    );

    router.back();
  }

  async function decreaseBrightness() {
    if (!isOn) return;
    const newValue = Math.max(0, brightness - 10);
  
    setBrightness(newValue);
  
    const user = auth.currentUser;
    if (!user || !id) return;
  
    await updateDoc(
      doc(db, "users", user.uid, "devices", String(id)),
      {
        brightness: newValue,
      }
    );
  }
  
  async function increaseBrightness() {
    if (!isOn) return;
    const newValue = Math.min(100, brightness + 10);
  
    setBrightness(newValue);
  
    const user = auth.currentUser;
    if (!user || !id) return;
  
    await updateDoc(
      doc(db, "users", user.uid, "devices", String(id)),
      {
        brightness: newValue,
      }
    );
  }

  async function deleteDevice() {
  const user = auth.currentUser;
  if (!user || !id) return;

  await deleteDoc(
    doc(db, "users", user.uid, "devices", String(id))
  );

  router.back();
}

  return (
    <ScrollView
        style={{ flex: 1, backgroundColor: "#071827" }}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>{name}</Text>
      <Text style={styles.subtitle}>
        {type} • {room}
      </Text>

      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>Current Status</Text>
        <Text style={styles.statusText}>{isOn ? "ON" : "OFF"}</Text>
      </View>

     {isRemote && (
      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>
          Remote Controls
        </Text>

        <View style={styles.remoteRow}>
          <Pressable
            style={styles.remoteButton}
            onPress={() => Alert.alert("Power")}
          >
            <Text style={styles.buttonText}>Power</Text>
          </Pressable>

          <Pressable
            style={styles.remoteButton}
            onPress={() => Alert.alert("Mute")}
          >
            <Text style={styles.buttonText}>Mute</Text>
          </Pressable>
        </View>

        <View style={styles.remoteRow}>
          <Pressable
            style={styles.remoteButton}
            onPress={() => Alert.alert("Volume Up")}
          >
            <Text style={styles.buttonText}>Vol +</Text>
          </Pressable>

          <Pressable
            style={styles.remoteButton}
            onPress={() => Alert.alert("Volume Down")}
          >
            <Text style={styles.buttonText}>Vol -</Text>
          </Pressable>
        </View>

        <View style={styles.remoteRow}>
          <Pressable
            style={styles.remoteButton}
            onPress={() => Alert.alert("Channel Up")}
          >
            <Text style={styles.buttonText}>Ch +</Text>
          </Pressable>

          <Pressable
            style={styles.remoteButton}
            onPress={() => Alert.alert("Channel Down")}
          >
            <Text style={styles.buttonText}>Ch -</Text>
          </Pressable>
        </View>
      </View>
    )}

    {isCamera && (
      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>Camera Controls</Text>

        <View style={styles.remoteRow}>
          <Pressable
            style={styles.remoteButton}
            onPress={() =>
              router.push({
                pathname: "/camera-live",
                params: {
                  cameraName: String(name),
                  room: String(name),
                  battery: "86",
                  signal: "Excellent",
                  thumbnail: "",
                  image: "",
                },
              })
            }
          >
            <Text style={styles.buttonText}>Live View</Text>
          </Pressable>

          <Pressable style={styles.remoteButton} onPress={() => Alert.alert("Snapshot", "Snapshot captured")}>
            <Text style={styles.buttonText}>Snapshot</Text>
          </Pressable>
        </View>

        <View style={styles.remoteRow}>
          <Pressable style={styles.remoteButton} onPress={() => Alert.alert("Record", "Recording started")}>
            <Text style={styles.buttonText}>Record</Text>
          </Pressable>

          <Pressable style={styles.remoteButton} onPress={() => Alert.alert("Settings", "Camera settings coming soon")}>
            <Text style={styles.buttonText}>Settings</Text>
          </Pressable>
        </View>
      </View>
    )}

    {isPlug && (
      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>Smart Plug Controls</Text>

        <Text style={styles.statusText}>
          Power Usage: {isOn ? "23W" : "0W"}
        </Text>

        <View style={styles.remoteRow}>
          <Pressable
            style={styles.remoteButton}
            onPress={() => Alert.alert("Timer", "Plug timer set for 1 hour")}
          >
            <Text style={styles.buttonText}>1 Hour</Text>
          </Pressable>

          <Pressable
            style={styles.remoteButton}
            onPress={() => Alert.alert("Timer", "Plug timer set for 2 hours")}
          >
            <Text style={styles.buttonText}>2 Hours</Text>
          </Pressable>
        </View>
      </View>
    )}

    {isSensor && (
      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>Sensor Information</Text>

        <Text style={styles.statusText}>
          Motion: Detected
        </Text>

        <Text
          style={{
            color: "#9CA3AF",
            marginTop: 12,
            fontSize: 16,
          }}
        >
          Last activity: Just now
        </Text>
      </View>
    )}

      {isLight && (
      <>
       <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>
          Brightness
        </Text>

        <Text style={styles.statusText}>
          {brightness}%
        </Text>

        <View
          style={{
            height: 10,
            backgroundColor: "#1E88E5",
            width: `${brightness}%`,
            borderRadius: 10,
            marginTop: 10,
          }}
        />
      </View>

      <View
        style={{
          flexDirection: "row",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <Pressable
          style={styles.smallButton}
          onPress={decreaseBrightness}
        >
          <Text style={styles.buttonText}>
            -10%
          </Text>
        </Pressable>

        <Pressable
          style={styles.smallButton}
          onPress={increaseBrightness}
        >
          <Text style={styles.buttonText}>
            +10%
          </Text>
        </Pressable>
      </View>
       </>
     )}
      <Pressable style={styles.button} onPress={toggleDevice}>
        <Text style={styles.buttonText}>
          Turn {isOn ? "OFF" : "ON"}
        </Text>
      </Pressable>

      <Pressable
        style={styles.deleteButton}
        onPress={() =>
          Alert.alert(
            "Delete Device?",
            "This action cannot be undone.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: deleteDevice,
              },
            ]
          )
        }
      >
        <Text style={styles.deleteButtonText}>
         Delete Device
        </Text>
      </Pressable>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
container: {
  padding: 24,
  paddingTop: 70,
  paddingBottom: 160,
  backgroundColor: "#071827",
},
  back: {
    color: "#7CC8FF",
    fontSize: 18,
    marginBottom: 24,
  },
  title: {
    color: "#fff",
    fontSize: 38,
    fontWeight: "800",
    marginBottom: 10,
  },
  subtitle: {
    color: "#9ca3af",
    fontSize: 18,
    marginBottom: 30,
  },
  statusCard: {
    backgroundColor: "#0B2236",
    padding: 24,
    borderRadius: 22,
    marginBottom: 24,
  },
  statusLabel: {
    color: "#9ca3af",
    fontSize: 16,
    marginBottom: 8,
  },
  statusText: {
    color: "#fff",
    fontSize: 34,
    fontWeight: "800",
  },
  button: {
    backgroundColor: "#1E88E5",
    padding: 18,
    borderRadius: 18,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 18,
  },

  smallButton: {
  flex: 1,
  backgroundColor: "#1E88E5",
  padding: 16,
  borderRadius: 16,
  alignItems: "center",
},

deleteButton: {
  marginTop: 18,
  borderWidth: 1,
  borderColor: "#ef4444",
  padding: 18,
  borderRadius: 18,
  alignItems: "center",
},

deleteButtonText: {
  color: "#ef4444",
  fontSize: 18,
  fontWeight: "800",
},

remoteRow: {
  flexDirection: "row",
  gap: 12,
  marginTop: 12,
},

remoteButton: {
  flex: 1,
  backgroundColor: "#1E88E5",
  paddingVertical: 18,
  borderRadius: 18,
  alignItems: "center",
},
});