import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

export default function CareAIMonitoring() {
  const router = useRouter();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#061826" }}
      contentContainerStyle={{ padding: 24, paddingTop: 70, paddingBottom: 80 }}
    >
      <Text style={{ color: "#fff", fontSize: 46, fontWeight: "900" }}>
        🤖 AI Monitoring
      </Text>

      <Text style={{ color: "#9fc8ff", fontSize: 22, marginTop: 12 }}>
        Live resident intelligence
      </Text>

      <View style={{
        backgroundColor: "#0f2d49",
        borderRadius: 20,
        padding: 20,
        marginTop: 24,
      }}>
        <Text style={{ color: "#fff", fontSize: 30, fontWeight: "900" }}>
          🧠 Current AI Focus
        </Text>

        <Text style={{ color: "#cfe2ff", fontSize: 20, marginTop: 16, lineHeight: 30 }}>
          Monitoring falls, wandering, unusual inactivity, night movement,
          room exits, and emergency-risk patterns.
        </Text>
      </View>

      <View style={{
        backgroundColor: "#0f2d49",
        borderRadius: 20,
        padding: 20,
        marginTop: 20,
      }}>
        <Text style={{ color: "#fff", fontSize: 30, fontWeight: "900" }}>
          📊 AI Risk Summary
        </Text>

        <Text style={{ color: "#22c55e", fontSize: 22, marginTop: 16 }}>
          🟢 Low risk residents: 4
        </Text>

        <Text style={{ color: "#f59e0b", fontSize: 22, marginTop: 10 }}>
          🟡 Needs attention: 1
        </Text>

        <Text style={{ color: "#ef4444", fontSize: 22, marginTop: 10 }}>
          🔴 Critical: 0
        </Text>
      </View>

      <View style={{
        backgroundColor: "#0f2d49",
        borderRadius: 20,
        padding: 20,
        marginTop: 20,
      }}>
        <Text style={{ color: "#fff", fontSize: 30, fontWeight: "900" }}>
          🚶 Latest AI Observation
        </Text>

        <Text style={{ color: "#cfe2ff", fontSize: 20, marginTop: 16, lineHeight: 30 }}>
          Room 5: Wandering pattern detected. Staff attention recommended,
          but no emergency confirmed.
        </Text>

        <Text style={{ color: "#9fc8ff", fontSize: 18, marginTop: 12 }}>
          Confidence: 86%
        </Text>
      </View>

      <Pressable
        onPress={() => router.back()}
        style={{
          backgroundColor: "#2563eb",
          padding: 18,
          borderRadius: 16,
          marginTop: 24,
        }}
      >
        <Text style={{ color: "#fff", textAlign: "center", fontSize: 22, fontWeight: "800" }}>
          ← Back
        </Text>
      </Pressable>
    </ScrollView>
  );
}