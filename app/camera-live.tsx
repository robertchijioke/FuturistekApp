import { CameraView, useCameraPermissions } from "expo-camera";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useRef } from "react";
import { Pressable, Text, View } from "react-native";
import { auth, db } from "../lib/firebase";

export default function CameraLive() {
  const router = useRouter();

  const cameraRef = useRef<CameraView>(null);

  const classifySnapshot = () => {
    const hour = new Date().getHours();

    if (hour >= 23 || hour < 6) {
      return {
        type: "person",
        aiClassification: "Unknown movement at night",
        risk: "HIGH",
        threatLevel: "HIGH",
        timeline: [
          { label: "Motion captured", createdAt: new Date() },
          { label: "Night activity detected", createdAt: new Date() },
          { label: "High risk alert created", createdAt: new Date() },
        ],
        recommendedActions: [
          "View Live Camera",
          "Turn On Lights",
          "Sound Siren",
          "Notify Owner",
        ],
      };
    }

    return {
      type: "motion",
      aiClassification: "Motion Detected",
      risk: "MEDIUM",
      threatLevel: "MEDIUM",
      timeline: [
        { label: "Motion captured", createdAt: new Date() },
        { label: "Snapshot saved", createdAt: new Date() },
      ],
      recommendedActions: [
        "View Live Camera",
        "Save Snapshot",
      ],
    };
  };

  const takeSnapshot = async () => {
    const photo = await cameraRef.current?.takePictureAsync({
      quality: 0.7,
    });

    if (!photo?.uri) return;

    const analysis = classifySnapshot();

    const user = auth.currentUser;

    let savedId = "";

    if (user) {
      const saved = await addDoc(
        collection(db, "users", user.uid, "securityCaptures"),
        {
          image: photo.uri,
          thumbnail: photo.uri,
          cameraName: "Living Room",
          room: "Living Room",
          type: analysis.type,
          risk: analysis.risk,
         threatLevel: analysis.threatLevel,
          aiClassification: analysis.aiClassification,
          timeline: analysis.timeline,
          recommendedActions: analysis.recommendedActions,
          archived: false,
          deleted: false,
          favorite: false,
          createdAt: serverTimestamp(),
        }
      );

      savedId = saved.id;

      await Notifications.scheduleNotificationAsync({
        content: {
          title:
            analysis.threatLevel === "HIGH"
              ? "🚨 HIGH Risk Motion Detected"
              : "🚨 Motion Detected",
          body: `${analysis.aiClassification} in Living Room`,
          sound: "default",
          data: {
            snapshotId: savedId,
            room: "Living Room",
            threatLevel: analysis.threatLevel,
          },
        },
        trigger: null,
      });
    }

    router.push({
      pathname: "/snapshot-viewer",
      params: {
        snapshotId: savedId,
        image: photo.uri,
        thumbnail: photo.uri,
        cameraName: "Living Room",
        room: "Living Room",
        type: analysis.type,
        risk: analysis.risk,
        threatLevel: analysis.threatLevel,
        aiClassification: analysis.aiClassification,
        timeline: analysis.timeline,
        recommendedActions: analysis.recommendedActions,
        deleted: false,
      },
    } as any);
  };

  const [permission, requestPermission] = useCameraPermissions();

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#021a35",
          justifyContent: "center",
          alignItems: "center",
          padding: 30,
        }}
      >
        <Text
          style={{
            color: "white",
            fontSize: 22,
            marginBottom: 20,
            textAlign: "center",
          }}
        >
          Camera permission required
        </Text>

        <Pressable
          onPress={requestPermission}
          style={{
            backgroundColor: "#2563eb",
            paddingHorizontal: 24,
            paddingVertical: 14,
            borderRadius: 12,
          }}
        >
          <Text style={{ color: "white", fontWeight: "700" }}>
            Grant Permission
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#021a35" }}>
     <CameraView
        ref={cameraRef}
        style={{ flex: 1 }}
        facing="back"
      />

      <Pressable
        onPress={() => router.back()}
        style={{
          position: "absolute",
          top: 55,
          left: 20,
          backgroundColor: "#00000099",
          paddingHorizontal: 18,
          paddingVertical: 10,
          borderRadius: 10,
        }}
      >
        <Text style={{ color: "white", fontWeight: "700" }}>
          ← Back
        </Text>
      </Pressable>

      <Pressable
        onPress={takeSnapshot}
        style={{
          position: "absolute",
          bottom: 50,
          alignSelf: "center",
          backgroundColor: "#2563eb",
          paddingHorizontal: 28,
          paddingVertical: 14,
          borderRadius: 12,
        }}
      >
        <Text style={{ color: "white", fontWeight: "700" }}>
          📸 Snapshot
        </Text>
      </Pressable>
    </View>
  );
}