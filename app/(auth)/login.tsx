import { Href, router, useLocalSearchParams } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import React, { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { auth } from "../../lib/firebase";
import { ensureUserDocument } from "../../lib/user";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { redirectTo } = useLocalSearchParams<{ redirectTo?: string }>();

const onLogin = async () => {
  try {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);

    console.log("LOGIN SUCCESS:", cred.user.uid, cred.user.email);
    console.log("AUTH AFTER LOGIN:", auth.currentUser?.uid, auth.currentUser?.email);

    await ensureUserDocument({
      uid: cred.user.uid,
      email: cred.user.email ?? "",
    });

    const destination = (redirectTo || "/(tabs)/profile") as Href;
    router.replace(destination);
  } catch (e: any) {
    console.log("❌ LOGIN FAILED:", e);
    Alert.alert("Login failed", e?.message ?? "Try again");
  }
};

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#020817",
        justifyContent: "center",
        paddingHorizontal: 24,
      }}
    >
      <View
        style={{
          backgroundColor: "#0F172A",
          borderRadius: 24,
          padding: 24,
          borderWidth: 1,
          borderColor: "#1E293B",
        }}
      >
        <Text
          style={{
            fontSize: 32,
            fontWeight: "800",
            color: "white",
            marginBottom: 12,
          }}
        >
          Welcome Back
        </Text>

        <Text
          style={{
            color: "#B8C7E0",
            fontSize: 16,
            marginBottom: 28,
            lineHeight: 22,
          }}
        >
          Sign in to shop smart devices and manage your orders.
        </Text>

        <TextInput
          placeholder="Email"
          placeholderTextColor="#64748B"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          style={{
            borderWidth: 1,
            borderColor: "#334155",
            backgroundColor: "#020817",
            color: "white",
            padding: 14,
            borderRadius: 14,
            marginBottom: 16,
          }}
        />

        <TextInput
          placeholder="Password"
          placeholderTextColor="#64748B"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={{
            borderWidth: 1,
            borderColor: "#334155",
            backgroundColor: "#020817",
            color: "white",
            padding: 14,
            borderRadius: 14,
            marginBottom: 20,
          }}
        />

        <Pressable
          onPress={onLogin}
          style={{
            backgroundColor: "#3B82F6",
            paddingVertical: 16,
            borderRadius: 14,
            alignItems: "center",
            marginTop: 8,
          }}
        >
          <Text style={{ color: "white", fontWeight: "700", fontSize: 16 }}>
            Sign In
          </Text>
        </Pressable>
        <Pressable onPress={() => router.push("/(auth)/signup")}>
  <Text
    style={{
      color: "#60a5fa",
      textAlign: "center",
      marginTop: 18,
      fontSize: 15,
      fontWeight: "600",
    }}
  >
    Create account
  </Text>
</Pressable>

<Pressable onPress={() => router.push("/(auth)/forgot-password")}>
  <Text
    style={{
      color: "#94a3b8",
      textAlign: "center",
      marginTop: 14,
      fontSize: 14,
    }}
  >
    Forgot password?
  </Text>
</Pressable>

        <Text
          style={{
            color: "#94A3B8",
            textAlign: "center",
            marginTop: 18,
            fontSize: 14,
          }}
        >
          Create an account to get started.
        </Text>
      </View>
    </View>
  );
}