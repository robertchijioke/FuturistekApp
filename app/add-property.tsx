import { useRouter } from "expo-router";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { auth, db } from "../lib/firebase";

export default function AddProperty() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [icon, setIcon] = useState("🏠");
  const [saving, setSaving] = useState(false);

  const saveProperty = async () => {
    if (!name.trim()) {
      Alert.alert("Property name required", "Please enter a property name.");
      return;
    }

    const user = auth.currentUser;
    if (!user) return;

    try {
      setSaving(true);

      await addDoc(collection(db, "users", user.uid, "properties"), {
        name: name.trim(),
        icon: icon.trim() || "🏠",
        devices: 0,
        createdAt: serverTimestamp(),
      });

      Alert.alert("Property added", `${name.trim()} has been added.`);
      router.back();
    } catch (error) {
      Alert.alert("Error", "Could not add property. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#021a35", padding: 24, paddingTop: 60 }}
    >
      <Pressable onPress={() => router.back()}>
        <Text style={{ color: "#7dd3fc", fontSize: 22, marginBottom: 30 }}>← Back</Text>
      </Pressable>

      <Text style={{ color: "#fff", fontSize: 44, fontWeight: "700", marginBottom: 10 }}>
        + Add Property
      </Text>

      <Text style={{ color: "#94a3b8", fontSize: 20, marginBottom: 30 }}>
        Create a new smart property
      </Text>

      <View style={{ backgroundColor: "#0a2b52", padding: 24, borderRadius: 20 }}>
        <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 8 }}>
          Property Name
        </Text>

        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Warehouse"
          placeholderTextColor="#64748b"
          style={{
            backgroundColor: "#021a35",
            color: "#fff",
            padding: 18,
            borderRadius: 14,
            fontSize: 18,
            marginBottom: 20,
          }}
        />

        <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 8 }}>
          Icon
        </Text>

        <TextInput
          value={icon}
          onChangeText={setIcon}
          placeholder="🏠"
          placeholderTextColor="#64748b"
          style={{
            backgroundColor: "#021a35",
            color: "#fff",
            padding: 18,
            borderRadius: 14,
            fontSize: 18,
            marginBottom: 30,
          }}
        />

        <Pressable
          onPress={saveProperty}
          disabled={saving}
          style={{
            backgroundColor: "#2563eb",
            padding: 20,
            borderRadius: 16,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700" }}>
            {saving ? "Saving..." : "+ Save Property"}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}