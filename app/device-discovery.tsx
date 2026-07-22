  import { useLocalSearchParams, useRouter } from "expo-router";
import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { auth, db } from "../lib/firebase";

  export default function DeviceDiscoveryScreen() {
    const router = useRouter();

    const { propertyId } = useLocalSearchParams();
    const currentPropertyId = String(propertyId || "home");

    const [scanning, setScanning] = useState(true);
    const [pairedIds, setPairedIds] = useState<string[]>([]);

    const discoveredDevices = [
      { id: "bedroom-light", name: "Bedroom Light", type: "Smart Light", status: "Online" },
      { id: "living-camera", name: "Living Room Camera", type: "Camera", status: "Online" },
      { id: "smart-plug", name: "Smart Plug", type: "Smart Plug", status: "Offline" },
      { id: "motion-sensor", name: "Motion Sensor", type: "Sensor", status: "Online" },
    ];

  useEffect(() => {
    const timer = setTimeout(() => {
      setScanning(false);
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const user = auth.currentUser;

    if (!user) return;

    const ref = collection(
      db,
      "users",
      user.uid,
      "devices"
    );

    const unsubscribe = onSnapshot(ref, (snapshot) => {
      const ids = snapshot.docs
        .map((doc) => doc.data().discoveredId)
        .filter(Boolean);

      setPairedIds(ids);
    });

    return unsubscribe;
  }, []);

    const visibleDevices = discoveredDevices.filter((device) => {
      return !
      pairedIds.includes(String(device.id));
    });

    function scanAgain() {
    setScanning(true);

    setTimeout(() => {
      setScanning(false);
    }, 2500);
  }

  return (
    <View style={styles.container}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>Discover Devices</Text>

      {scanning && (
        <View style={styles.scanCard}>
          <Text style={styles.scanText}>
            🔍 Scanning network...
          </Text>
        </View>
      )}

      <Text style={styles.subtitle}>
        Devices found on your network
      </Text>

      {!scanning && 
      visibleDevices.map((device, index) => (
        <Pressable
          key={index}
          style={styles.deviceCard}
          onPress={() =>
            router.push({
              pathname: "/device-setup" as any,
              params: {
                type: device.type,
                discoveredId: device.id,
                suggestedName: device.name,
              },
            })
          }
        >
          <Text style={styles.deviceName}>
            {device.name}
          </Text>

          <Text
            style={[
              styles.status,
              {
                color:
                  device.status === "Online"
                    ? "#22C55E"
                    : "#EF4444",
              },
            ]}
          >
            {device.status}
          </Text>
        </Pressable>
      ))}

      <Pressable style={styles.button} onPress={scanAgain}>
        <Text style={styles.buttonText}>
          {scanning ? "Scanning..." : "Scan Again"}
        </Text>
      </Pressable>

      <Pressable
        style={{
          backgroundColor: "#0A2747",
          padding: 20,
          borderRadius: 20,
          marginTop: 16,
        }}
        onPress={() =>
          router.push({
            pathname: "/add-camera",
            params: {
              propertyId: currentPropertyId,
            },
          })
        }
      >
        <Text style={{
          color: "#fff",
          fontSize: 24,
          fontWeight: "700",
          marginBottom: 8,
        }}>+ Add Device</Text>
        <Text style={{
          color: "#94a3b8",
          fontSize: 16,
        }}>
          Connect smart plugs, lights, cameras and sensors
        </Text>
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
    fontSize: 28,
    marginBottom: 24,
  },

  title: {
    color: "#FFFFFF",
    fontSize: 46,
    fontWeight: "800",
  },

  subtitle: {
    color: "#9CA3AF",
    fontSize: 18,
    marginTop: 8,
    marginBottom: 24,
  },

  deviceCard: {
    backgroundColor: "#0D2340",
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
  },

  deviceName: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },

  status: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: "700",
  },

  button: {
    backgroundColor: "#1E88E5",
    padding: 18,
    borderRadius: 20,
    marginTop: 24,
    alignItems: "center",
  },

  buttonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },

  scanCard: {
  backgroundColor: "#0D2340",
  borderRadius: 20,
  padding: 20,
  marginBottom: 20,
},

scanText: {
  color: "#7CC8FF",
  fontSize: 18,
  fontWeight: "700",
},
});