import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { auth, db } from "../../lib/firebase";
import { registerForPushNotificationsAsync } from "../../lib/notifications";
import { getUserProfile, updateUserProfile } from "../../lib/user";

export default function ProfileScreen() {
  const user = auth.currentUser;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const profile = await getUserProfile(user.uid);
        if (profile) {
          setFullName(profile.fullName ?? "");
          setPhone(profile.phone ?? "");
        }
      } catch (error) {
        console.log("PROFILE LOAD ERROR:", error);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user]);

  useEffect(() => {
  const savePushToken = async () => {
    const user = auth.currentUser;
    if (!user?.uid) return;

    const token = await registerForPushNotificationsAsync();
    if (!token) return;

    await setDoc(
      doc(db, "users", user.uid),
      {
        email: user.email ?? "",
        expoPushToken: token,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    console.log("Saved expo push token:", token);
  };

  savePushToken();
}, []);

  const onSave = async () => {
    if (!user) return;

    try {
      setSaving(true);

      await updateUserProfile(user.uid, {
        fullName: fullName.trim(),
        phone: phone.trim(),
      });

      Alert.alert("Saved", "Your profile has been updated.");
    } catch (error: any) {
      Alert.alert("Error", error?.message ?? "Could not save profile.");
    } finally {
      setSaving(false);
    }
  };

  const onSignOut = async () => {
    await signOut(auth);
    router.replace("/(tabs)/profile");
  };

  if (!user) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#020817",
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
        }}
      >
        <Text
          style={{
            color: "white",
            fontSize: 24,
            fontWeight: "700",
            marginBottom: 16,
          }}
        >
          Welcome
        </Text>

        <Text
          style={{
            color: "#cbd5e1",
            fontSize: 16,
            textAlign: "center",
            marginBottom: 24,
          }}
        >
          Sign in to manage your profile, saved details, and account settings.
        </Text>

        <Pressable
          onPress={() => router.push("/(auth)/login?redirectTo=/(tabs)/profile")}
          style={{
            backgroundColor: "#6da5fa",
            paddingVertical: 14,
            paddingHorizontal: 32,
            borderRadius: 14,
          }}
        >
          <Text style={{ color: "white", fontWeight: "700", fontSize: 18 }}>
            Sign In
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#020817",
        paddingHorizontal: 24,
        paddingTop: 80,
      }}
    >
      <Text
        style={{
          color: "white",
          fontSize: 28,
          fontWeight: "800",
          marginBottom: 12,
        }}
      >
        My Profile
      </Text>

      <Text
        style={{
          color: "#cbd5e1",
          fontSize: 16,
          marginBottom: 24,
        }}
      >
        Signed in as {user.email}
      </Text>

      <TextInput
        value={fullName}
        onChangeText={setFullName}
        placeholder="Full name"
        placeholderTextColor="#64748b"
        style={{
          backgroundColor: "#0f172a",
          color: "white",
          borderWidth: 1,
          borderColor: "#334155",
          borderRadius: 14,
          padding: 14,
          marginBottom: 16,
        }}
      />

      <TextInput
        value={phone}
        onChangeText={setPhone}
        placeholder="Phone number"
        placeholderTextColor="#64748b"
        keyboardType="phone-pad"
        style={{
          backgroundColor: "#0f172a",
          color: "white",
          borderWidth: 1,
          borderColor: "#334155",
          borderRadius: 14,
          padding: 14,
          marginBottom: 20,
        }}
      />

      <Pressable
        onPress={onSave}
        disabled={saving || loading}
        style={{
          backgroundColor: "#6da5fa",
          paddingVertical: 16,
          borderRadius: 14,
          alignItems: "center",
          marginBottom: 16,
          opacity: saving ? 0.7 : 1,
        }}
      >
        <Text style={{ color: "white", fontWeight: "700", fontSize: 18 }}>
          {saving ? "Saving..." : "Save Profile"}
        </Text>
      </Pressable>

      <Pressable
      onPress={() => router.push("/addresses")}
      style={{
        backgroundColor: "#0f172a",
        padding: 16,
        borderRadius: 14,
        alignItems: "center",
        marginTop: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "#1e293b",
  }}
      >
        <Text style={{ color: "white", fontWeight: "700", fontSize: 16 }}>
          Manage Addresses
        </Text>
      </Pressable>

      <Pressable
        onPress={() => router.push("/admin")}
        style={{
          backgroundColor: "#101a33",
          paddingVertical: 18,
          borderRadius: 18,
          alignItems: "center",
          marginTop: 18,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.06)",
        }}
      >
        <Text
          style={{
            color: "white",
            fontSize: 18,
            fontWeight: "700",
          }}
        >
          Admin Dashboard
        </Text>
      </Pressable>

      <Pressable
        onPress={onSignOut}
        style={{
          backgroundColor: "#1e293b",
          paddingVertical: 16,
          borderRadius: 14,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "white", fontWeight: "700", fontSize: 18 }}>
          Sign Out
        </Text>
      </Pressable>
    </View>
  );
}