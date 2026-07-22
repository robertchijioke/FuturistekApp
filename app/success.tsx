import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SuccessScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const total = typeof params.total === "string" ? params.total : "0.00";
  const name = typeof params.name === "string" ? params.name : "";

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>✅ Order Successful</Text>
        <Text style={styles.subtitle}>
          {name ? `Thanks ${name}!` : "Thanks!"} Your order total is £{total}.
        </Text>

        <Pressable style={styles.btn} onPress={() => router.replace("/(tabs)/store")}>
          <Text style={styles.btnText}>Continue Shopping</Text>
        </Pressable>

        <Pressable style={styles.linkBtn} onPress={() => router.replace("/(tabs)/cart")}>
          <Text style={styles.linkText}>Back to Cart</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B1623", justifyContent: "center", padding: 16 },
  card: {
    backgroundColor: "#142233",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  title: 
  { fontSize: 24, fontWeight: "800", color: "#fff", marginBottom: 10 },
  subtitle: { fontSize: 15, color: "rgba(255,255,255,0.8)", marginBottom: 18, lineHeight: 21 },
  btn: { backgroundColor: "#2B6BDF", paddingVertical: 12, borderRadius: 14, alignItems: "center" },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  linkBtn: { paddingVertical: 12, alignItems: "center" },
  linkText: { color: "rgba(255,255,255,0.75)", fontSize: 14, fontWeight: "600" },
});
