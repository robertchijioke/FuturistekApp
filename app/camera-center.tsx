import { useRouter } from "expo-router";
import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text } from "react-native";
import { db } from "../lib/firebase";

  export default function CameraCenter() {
    const router = useRouter();

    const [cameras, setCameras] = useState<any[]>([]);

    useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "devices"),
      (snapshot) => {
        const loadedDevices = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setCameras(loadedDevices);
      }
    );

    return unsubscribe;
  }, []);

  return (
    <ScrollView
      style={{
        flex: 1,
        backgroundColor: "#021a35",
        padding: 20,
        paddingTop: 60,
      }}
    >
      <Text style={{ color: "#fff", fontSize: 30, fontWeight: "700", marginBottom: 20 }}>
        📹 Camera Center
      </Text>

      <Pressable
        onPress={() => router.push("/cctv-wall" as any)}
        style={{
          backgroundColor: "#2563eb",
          padding: 16,
          borderRadius: 14,
          marginBottom: 20,
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 18,
            fontWeight: "700",
            textAlign: "center",
          }}
        >
          📺 Open CCTV Wall
        </Text>
      </Pressable>

      {cameras.map((camera, index) => (
        <Pressable
          key={index}
          onPress={() =>
            router.push({
              pathname: "/camera-live",
              params: {
                cameraId: camera.id,
                cameraName: camera.room,
                room: camera.room,
                battery: String(camera.battery),
                signal: camera.signal,
                thumbnail: camera.thumbnail || "",
                image: camera.thumbnail || "",
              },
            })
          }
          style={{
            backgroundColor: "#0a2b52",
            padding: 18,
            borderRadius: 18,
            marginBottom: 14,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 22, fontWeight: "700" }}>
            📹 {camera.name}
          </Text>

          <Text style={{ color: camera.status === "Online" ? "#4ade80" : "#facc15", fontSize: 17, marginTop: 8 }}>
            {camera.status === "Online" ? "🟢" : "⚠️"} Status: {camera.status}
          </Text>

          <Text style={{ color: camera.battery < 25 ? "#facc15" : "#b8c7d9", fontSize: 17, marginTop: 8 }}>
            🔋 Battery: {camera.battery}%
          </Text>

          <Text style={{ color: "#7dd3fc", fontSize: 16, marginTop: 10 }}>
            Tap to view live feed →
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}