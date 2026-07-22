import { router } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import React, { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { auth } from "../../lib/firebase";

export default function SignupScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const onSignup = async () => {
    if (!email.trim() || !password.trim() || !confirmPassword.trim()) {
      Alert.alert("Missing details", "Please fill all fields.");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Password mismatch", "Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Weak password", "Password must be at least 6 characters.");
      return;
    }

    try {
      await createUserWithEmailAndPassword(auth, email.trim(), password);
      router.replace("/(tabs)/profile");
    } catch (e: any) {
      Alert.alert("Sign up failed", e?.message ?? "Please try again.");
    }
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#020817",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <View
        style={{
          backgroundColor: "#0f172a",
          borderRadius: 24,
          padding: 24,
          borderWidth: 1,
          borderColor: "#1e293b",
        }}
      >
        <Text
          style={{
            color: "white",
            fontSize: 30,
            fontWeight: "800",
            marginBottom: 10,
          }}
        >
          Create Account
        </Text>

        <Text
          style={{
            color: "#cbd5e1",
            fontSize: 16,
            lineHeight: 24,
            marginBottom: 24,
          }}
        >
          Sign up to track orders, save your details, and manage your account.
        </Text>

        <TextInput
          placeholder="Email"
          placeholderTextColor="#64748b"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          style={{
            backgroundColor: "#020617",
            color: "white",
            borderWidth: 1,
            borderColor: "#334155",
            padding: 14,
            borderRadius: 14,
            marginBottom: 16,
          }}
        />

        <TextInput
          placeholder="Password"
          placeholderTextColor="#64748b"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={{
            backgroundColor: "#020617",
            color: "white",
            borderWidth: 1,
            borderColor: "#334155",
            padding: 14,
            borderRadius: 14,
            marginBottom: 16,
          }}
        />

        <TextInput
          placeholder="Confirm password"
          placeholderTextColor="#64748b"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          style={{
            backgroundColor: "#020617",
            color: "white",
            borderWidth: 1,
            borderColor: "#334155",
            padding: 14,
            borderRadius: 14,
            marginBottom: 20,
          }}
        />

        <Pressable
          onPress={onSignup}
          style={{
            backgroundColor: "#5b8def",
            padding: 16,
            borderRadius: 16,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              color: "white",
              fontSize: 18,
              fontWeight: "700",
            }}
          >
            Sign Up
          </Text>
        </Pressable>

        <Pressable onPress={() => router.back()}>
          <Text
            style={{
              color: "#94a3b8",
              textAlign: "center",
              marginTop: 16,
              fontSize: 14,
            }}
          >
            Back to sign in
          </Text>
        </Pressable>
      </View>
    </View>
  );
}