import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, updateDoc } from "firebase/firestore";
import { useState } from "react";
import {
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { auth, db } from "../lib/firebase";

export default function RenameCamera() {
  const router = useRouter();

  const { cameraId, currentName } = useLocalSearchParams<{
    cameraId: string;
    currentName: string;
  }>();

  const [name, setName] = useState(currentName || "");
  const [saving, setSaving] = useState(false);

  const saveRename = async () => {
    if (!name.trim()) {
      Alert.alert("Name required", "Please enter a camera name.");
      return;
    }

    try {
      setSaving(true);

      const user = auth.currentUser;
      if (!user) return;

      await updateDoc(
        doc(db, "users", user.uid, "devices", String(cameraId)),
        {
          room: name.trim(),
          name: `${name.trim()} Camera`,
        }
      );

      Alert.alert("Success", "Camera renamed.");
      router.back();
    } catch (error) {
      Alert.alert("Error", "Could not rename camera.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#021a35",
        padding: 24,
        paddingTop: 70,
      }}
    >
      <Pressable onPress={() => router.back()}>
        <Text
          style={{
            color: "#7ea6ff",
            fontSize: 20,
            marginBottom: 40,
          }}
        >
          ← Back
        </Text>
      </Pressable>

      <Text
        style={{
          color: "#fff",
          fontSize: 42,
          fontWeight: "800",
          marginBottom: 16,
        }}
      >
        ✏️ Rename Camera
      </Text>

      <Text
        style={{
          color: "#b8c7d9",
          fontSize: 18,
          marginBottom: 24,
        }}
      >
        Update camera name
      </Text>

      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Camera name"
        placeholderTextColor="#7f8ea3"
        style={{
          backgroundColor: "#0a2b52",
          color: "#fff",
          borderRadius: 12,
          padding: 16,
          fontSize: 18,
          marginBottom: 24,
        }}
      />

      <Pressable
        onPress={saveRename}
        disabled={saving}
        style={{
          backgroundColor: "#3d6df2",
          padding: 18,
          borderRadius: 14,
          alignItems: "center",
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 18,
            fontWeight: "700",
          }}
        >
          {saving ? "Saving..." : "💾 Save"}
        </Text>
      </Pressable>
    </View>
  );
}