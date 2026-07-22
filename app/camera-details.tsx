import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { auth, db } from "../lib/firebase";

export default function CameraDetails() {
  const router = useRouter();
  const { cameraId } = useLocalSearchParams<{ cameraId: string }>();

  const [camera, setCamera] = useState<any>(null);

useEffect(() => {
  const user = auth.currentUser;
  if (!user || !cameraId) return;

  const unsub = onSnapshot(
    doc(db, "users", user.uid, "devices", String(cameraId)),
    (snap) => {
      if (snap.exists()) {
        setCamera({ id: snap.id, ...snap.data() });
      }
    }
  );

  return unsub;
}, [cameraId]);

  if (!camera) {
    return (
      <View style={{ flex: 1, backgroundColor: "#021a35", padding: 24, paddingTop: 70 }}>
        <Text style={{ color: "#fff", fontSize: 28, fontWeight: "800" }}>Loading camera...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#021a35", padding: 24, paddingTop: 70 }}>
      <Pressable onPress={() => router.back()}>
        <Text style={{ color: "#7ea6ff", fontSize: 20, marginBottom: 40 }}>← Back</Text>
      </Pressable>

      <Text style={{ color: "#fff", fontSize: 42, fontWeight: "800", marginBottom: 12 }}>
        📹 {camera.room || camera.name}
      </Text>

      <Text style={{ color: "#b8c7d9", fontSize: 20, marginBottom: 30 }}>
        Camera Details
      </Text>

      <View style={{ backgroundColor: "#0a2b52", borderRadius: 18, padding: 22 }}>
        <Text style={{ color: "#fff", fontSize: 22, fontWeight: "700" }}>
          Status: {camera.status === true ? "Online ✅" : "Offline ⚠️"}
        </Text>
        <Text style={{ color: "#b8c7d9", fontSize: 20, marginTop: 14 }}>
          Battery: {camera.battery ?? 100}%
        </Text>
        <Text style={{ color: "#b8c7d9", fontSize: 20, marginTop: 8 }}>
          Signal: {camera.signal || "Excellent"}
        </Text>
        <Text style={{ color: "#b8c7d9", fontSize: 20, marginTop: 8 }}>
          Slot: {camera.slot || "Not assigned"}
        </Text>
      </View>

      <Pressable
          onPress={() =>
           router.push({
              pathname: "/snapshot-viewer",
              params: {
                cameraId: camera.id,
                cameraName: camera.room || camera.name || "Camera",
                room: camera.room || "Unknown",
                type: "motion",
                image: camera.image || camera.thumbnail || "",
                thumbnail: camera.thumbnail || camera.image || "",
                battery: String(camera.battery || 100),
                signal: camera.signal || "Excellent",
              },
            } as any)
          }
          style={{
            backgroundColor: "#3d6df2",
            padding: 14,
            borderRadius: 12,
            marginTop: 20,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontWeight: "700",
              fontSize: 16,
            }}
          >
            📸 Snapshot
          </Text>
        </Pressable>

       <Pressable
          onPress={() =>
            router.push({
              pathname: "/camera-live",
              params: {
                cameraId: camera.id,
                cameraName: camera.room,
                battery: String(camera.battery),
                signal: camera.signal,
                thumbnail: camera.thumbnail || camera.image || "",
                image: camera.image || camera.thumbnail || "",
              },
            } as any)
          }
          style={{
            backgroundColor: "#0f4c81",
            padding: 14,
            borderRadius: 12,
            marginTop: 12,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
            🎥 View Live
          </Text>
        </Pressable>
    </View>
  );
}