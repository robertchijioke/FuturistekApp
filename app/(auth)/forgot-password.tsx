import { router } from "expo-router";
import { sendPasswordResetEmail } from "firebase/auth";
import React, { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { auth } from "../../lib/firebase";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");

  const onResetPassword = async () => {
    if (!email.trim()) {
      Alert.alert("Missing email", "Please enter your email address.");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email.trim());
      Alert.alert(
        "Email sent",
        "Password reset instructions have been sent to your email."
      );
      router.back();
    } catch (e: any) {
      Alert.alert("Reset failed", e?.message ?? "Please try again.");
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
          Reset Password
        </Text>

        <Text
          style={{
            color: "#cbd5e1",
            fontSize: 16,
            lineHeight: 24,
            marginBottom: 24,
          }}
        >
          Enter your email and we’ll send you password reset instructions.
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
            marginBottom: 20,
          }}
        />

        <Pressable
          onPress={onResetPassword}
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
            Send Reset Link
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