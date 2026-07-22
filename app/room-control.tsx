import { useLocalSearchParams, useRouter } from "expo-router";
import { collection, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { auth, db } from "../lib/firebase";

export default function RoomControlScreen() {
  const router = useRouter();
  const { room } = useLocalSearchParams();

  const [devices, setDevices] = useState<any[]>([]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user || !room) return;

    const q = query(
      collection(db, "users", user.uid, "devices"),
      where("room", "==", String(room))
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setDevices(
        snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
      );
    });

    return unsubscribe;
  }, [room]);

  async function updateRoom(status: boolean) {
    const user = auth.currentUser;
    if (!user) return;

    try {
      await Promise.all(
        devices.map((device) =>
          updateDoc(doc(db, "users", user.uid, "devices", device.id), {
            status,
            brightness: status ? Number(device.brightness ?? 100) : 0,
          })
        )
      );

      Alert.alert(
        "Room updated",
        `${room} devices turned ${status ? "ON" : "OFF"}.`
      );
    } catch (error) {
      console.log("Room update error:", error);
      Alert.alert("Error", "Could not update room devices.");
    }
  }

  async function updateRoomBrightness(change: number) {
  const user = auth.currentUser;
  if (!user) return;

  await Promise.all(
    devices.map((device) => {
      const isLight =
        device.type === "Smart Light" ||
        String(device.name).toLowerCase().includes("light");

      if (!isLight || !device.status) {
        return Promise.resolve();
      }

      const currentBrightness = Number(device.brightness ?? 100);
      const newBrightness = Math.max(
        0,
        Math.min(100, currentBrightness + change)
      );

      return updateDoc(
        doc(db, "users", user.uid, "devices", device.id),
        {
          brightness: newBrightness,
        }
      );
    })
  );
}

  return (
    <View style={styles.container}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>{room}</Text>
      <Text style={styles.subtitle}>
        {devices.length} device{devices.length === 1 ? "" : "s"} in this room
      </Text>

      <View style={styles.row}>
        <Pressable style={styles.smallButton} onPress={() => updateRoom(true)}>
          <Text style={styles.buttonText}>Turn ON</Text>
        </Pressable>

        <Pressable style={styles.smallButton} onPress={() => updateRoom(false)}>
          <Text style={styles.buttonText}>Turn OFF</Text>
        </Pressable>
      </View>

       <Text style={styles.sectionTitle}>Room Brightness</Text>

      <View style={styles.row}>
        <Pressable
          style={styles.smallButton}
          onPress={() => updateRoomBrightness(-10)}
        >
          <Text style={styles.buttonText}>-10%</Text>
        </Pressable>

        <Pressable
          style={styles.smallButton}
          onPress={() => updateRoomBrightness(10)}
        >
          <Text style={styles.buttonText}>+10%</Text>
        </Pressable>
      </View>

      {devices.map((device) => (
        <Pressable
          key={device.id}
          style={styles.deviceCard}
          onPress={() =>
            router.push({
              pathname: "/device-control",
              params: {
                id: device.id,
                name: device.name,
                type: device.type,
                room: device.room,
                status: String(device.status),
                brightness: String(device.brightness ?? 100),
              },
            })
          }
        >
          <Text style={styles.deviceName}>{device.name}</Text>
          <Text style={styles.deviceText}>
            
          {String(device.type).toLowerCase().includes("light") && (
            <Text style={styles.deviceText}>
              Brightness: {Number(device.brightness ?? 0)}%
            </Text>
          )}
            {device.type} • Status: {device.status ? "ON" : "OFF"}
          </Text>
        </Pressable>
      ))}
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
    fontSize: 42,
    fontWeight: "800",
    marginBottom: 8,
  },
  subtitle: {
    color: "#9ca3af",
    fontSize: 18,
    marginBottom: 28,
  },
  row: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  smallButton: {
    flex: 1,
    backgroundColor: "#1E88E5",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
  },
  deviceCard: {
    backgroundColor: "#0B2236",
    padding: 20,
    borderRadius: 20,
    marginBottom: 14,
  },
  deviceName: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 8,
  },
  deviceText: {
    color: "#9ca3af",
    fontSize: 16,
  },

  sectionTitle: {
  color: "#fff",
  fontSize: 22,
  fontWeight: "800",
  marginBottom: 12,
},
});