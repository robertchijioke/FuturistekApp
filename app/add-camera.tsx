import { useLocalSearchParams, useRouter } from "expo-router";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { auth, db } from "../lib/firebase";

export default function AddCamera() {
  const router = useRouter();

  const { propertyId, from, slot } = useLocalSearchParams();
  const currentPropertyId = String(propertyId || "home");


  const [name, setName] = useState("");
  const [room, setRoom] = useState("");
  const [battery, setBattery] = useState("100");
  const [signal, setSignal] = useState("Excellent");
  const [saving, setSaving] = useState(false);

  const saveCamera = async () => {
    if (!room.trim()) {
      Alert.alert("Room required", "Please enter where this camera is located.");
      return;
    }

    try {
      setSaving(true);

      const user = auth.currentUser;
      if (!user) return;

      await addDoc(collection(db, "users", user.uid, "devices"), {
        type: "Camera",
        name: name.trim() || `${room.trim()} Camera`,
        room: room.trim(),
        icon: "📹",
        status: true,
        online: true,
        isOn: true,
        lastSeen: new Date(),
        battery: Number(battery) || 100,
        signal: signal.trim() || "Excellent",
        slot: Number(slot) || undefined,
        thumbnail: "",
        image: "",
        createdAt: serverTimestamp(),
        propertyId: currentPropertyId,
        source: String(from || ""),
      });

      Alert.alert("Camera added", `Saved to ${currentPropertyId}`);
      router.back();
    } catch (error) {
      Alert.alert("Error", "Could not add camera. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>📹 Add Camera</Text>
      <Text style={styles.subtitle}>Add a new camera to your CCTV Wall.</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Camera Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Driveway Camera"
          placeholderTextColor="#6f8aa8"
          style={styles.input}
        />

        <Text style={styles.label}>Room / Area</Text>
        <TextInput
          value={room}
          onChangeText={setRoom}
          placeholder="e.g. Driveway"
          placeholderTextColor="#6f8aa8"
          style={styles.input}
        />

        <Text style={styles.label}>Battery %</Text>
        <TextInput
          value={battery}
          onChangeText={setBattery}
          keyboardType="numeric"
          placeholder="100"
          placeholderTextColor="#6f8aa8"
          style={styles.input}
        />

        <Text style={styles.label}>Signal</Text>
        <TextInput
          value={signal}
          onChangeText={setSignal}
          placeholder="Excellent / Good / Weak"
          placeholderTextColor="#6f8aa8"
          style={styles.input}
        />

        <Pressable style={styles.button} onPress={saveCamera} disabled={saving}>
          <Text style={styles.buttonText}>
            {saving ? "Adding..." : "➕ Add Camera"}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = {
  container: {
    flex: 1,
    backgroundColor: "#021a35",
  },
  content: {
    padding: 24,
    paddingTop: 70,
  },
  back: {
    color: "#75aaff",
    fontSize: 22,
    marginBottom: 40,
  },
  title: {
    color: "#fff",
    fontSize: 42,
    fontWeight: "800" as const,
    marginBottom: 14,
  },
  subtitle: {
    color: "#b8c7d9",
    fontSize: 22,
    marginBottom: 28,
  },
  card: {
    backgroundColor: "#0a2b52",
    borderRadius: 22,
    padding: 22,
  },
  label: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700" as const,
    marginBottom: 8,
    marginTop: 14,
  },
  input: {
    backgroundColor: "#021a35",
    color: "#fff",
    borderRadius: 14,
    padding: 16,
    fontSize: 18,
    borderWidth: 1,
    borderColor: "#1e3a5f",
  },
  button: {
    backgroundColor: "#2563eb",
    borderRadius: 16,
    padding: 18,
    alignItems: "center" as const,
    marginTop: 28,
  },
  buttonText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800" as const,
  },
};