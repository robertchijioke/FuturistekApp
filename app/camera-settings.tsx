import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { auth, db } from "../lib/firebase";

export default function CameraSettingsScreen() {
  const router = useRouter();
  const { cameraId, room, battery, signal } = useLocalSearchParams();

  const [motionDetection, setMotionDetection] = useState(true);
  const [recording, setRecording] = useState(false);
  const [nightVision, setNightVision] = useState(true);
  const [sensitivity, setSensitivity] = useState("Medium");

  useEffect(() => {
  if (!cameraId) return;

  const ref = doc(db, "users", auth.currentUser!.uid, "devices", String(cameraId));

  const unsubscribe = onSnapshot(ref, (snap) => {
    if (!snap.exists()) return;

    const data = snap.data();

    setMotionDetection(data.motionDetection ?? true);
    setRecording(data.recording ?? false);
    setNightVision(data.nightVision ?? true);
    setSensitivity(data.sensitivity ?? "Medium");
  });

  return unsubscribe;
}, [cameraId]);

  const saveSettings = async () => {
  const user = auth.currentUser;

  if (!user) {
    Alert.alert("Error", "Please log in first.");
    return;
  }

  await updateDoc(doc(db, "users", user.uid, "devices", String(cameraId)), {
    motionDetection,
    recording,
    nightVision,
    sensitivity,
  });

  Alert.alert(
    "✅ Settings Saved",
    "Camera settings updated."
  );

  router.back();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>⚙️ Camera Settings</Text>

      <View style={styles.card}>
        <Text style={styles.cameraName}>📹 {room || "Camera"}</Text>
        <Text style={styles.subText}>🟢 Status: Online</Text>
        <Text style={styles.subText}>🔋 Battery: {battery || "100"}%</Text>
        <Text style={styles.subText}>📶 Signal: {signal || "Excellent"}</Text>
      </View>

      <SettingRow label="👁️ Motion Detection" value={motionDetection} onPress={() => setMotionDetection(!motionDetection)} />
      <SettingRow label="🎥 Recording" value={recording} onPress={() => setRecording(!recording)} />
      <SettingRow label="🌙 Night Vision" value={nightVision} onPress={() => setNightVision(!nightVision)} />

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>🎚️ Sensitivity</Text>

        <View style={styles.sensitivityRow}>
          {["Low", "Medium", "High"].map((level) => (
            <Pressable
              key={level}
              onPress={() => setSensitivity(level)}
              style={[
                styles.sensitivityButton,
                sensitivity === level && styles.activeSensitivity,
              ]}
            >
              <Text style={styles.buttonText}>{level}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Pressable
        style={styles.saveButton}
        onPress={saveSettings}
      >
        <Text style={styles.saveText}>💾 Save Changes</Text>
      </Pressable>
    </ScrollView>
  );
}

function SettingRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value: boolean;
  onPress: () => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{label}</Text>

      <Pressable
        onPress={onPress}
        style={[styles.toggleButton, value ? styles.toggleOn : styles.toggleOff]}
      >
        <Text style={styles.buttonText}>{value ? "ON" : "OFF"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#001f3f",
  },
  content: {
    padding: 24,
    paddingBottom: 50,
  },
  title: {
    color: "#ffffff",
    fontSize: 36,
    fontWeight: "800",
    marginBottom: 24,
  },
  card: {
    backgroundColor: "#0a2b52",
    padding: 20,
    borderRadius: 20,
    marginBottom: 18,
  },
  cameraName: {
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 10,
  },
  subText: {
    color: "#b8c7d9",
    fontSize: 18,
    marginTop: 6,
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 14,
  },
  toggleButton: {
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  toggleOn: {
    backgroundColor: "#22c55e",
  },
  toggleOff: {
    backgroundColor: "#ef4444",
  },
  sensitivityRow: {
    flexDirection: "row",
    gap: 10,
  },
  sensitivityButton: {
    flex: 1,
    backgroundColor: "#3B82F6",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  activeSensitivity: {
    backgroundColor: "#22c55e",
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  saveButton: {
    backgroundColor: "#3B82F6",
    padding: 20,
    borderRadius: 18,
    alignItems: "center",
    marginTop: 10,
  },
  saveText: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "800",
  },
});