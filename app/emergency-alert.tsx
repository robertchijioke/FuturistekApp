import { useLocalSearchParams, useRouter } from "expo-router";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";

export default function EmergencyAlert() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const room =
    typeof params.room === "string"
      ? params.room.trim()
      : "";

  const type =
    typeof params.type === "string" && params.type.trim()
      ? params.type.trim()
      : "Incident";

  const severity =
    typeof params.severity === "string" && params.severity.trim()
      ? params.severity.trim()
      : "CRITICAL";

  const hasValidRoom = Boolean(room);

  const callEmergency = () => {
    Linking.openURL("tel:999");
  };

  if (!hasValidRoom) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#061826",
          padding: 24,
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            color: "#ef4444",
            fontSize: 30,
            fontWeight: "900",
            textAlign: "center",
          }}
        >
          Emergency details unavailable
        </Text>

        <Text
          style={{
            color: "#cfe2ff",
            fontSize: 18,
            textAlign: "center",
            marginTop: 14,
          }}
        >
          This alert does not contain a valid room.
        </Text>

        <Pressable
          onPress={() => router.back()}
          style={{
            backgroundColor: "#2563eb",
            padding: 16,
            borderRadius: 14,
            marginTop: 24,
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontSize: 18,
              fontWeight: "900",
              textAlign: "center",
            }}
          >
            Go Back
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#061826" }}
      contentContainerStyle={{ padding: 24, paddingTop: 70, paddingBottom: 80 }}
    >
      <Text style={{ color: "#fff", fontSize: 46, fontWeight: "900" }}>
        🚨 Emergency Alert
      </Text>

      <Text style={{ color: "#ff6b6b", fontSize: 30, fontWeight: "800", marginTop: 24 }}>
        {severity} concern detected
      </Text>

      <View style={{ backgroundColor: "#0f2d49", borderRadius: 20, padding: 20, marginTop: 24 }}>
        <Text style={{ color: "#cfe2ff", fontSize: 20 }}>Location</Text>
        <Text style={{ color: "#fff", fontSize: 30, fontWeight: "800" }}>{room}</Text>

        <Text style={{ color: "#cfe2ff", fontSize: 20, marginTop: 18 }}>Incident Type</Text>
        <Text style={{ color: "#fff", fontSize: 30, fontWeight: "800" }}>{type}</Text>

        <Text style={{ color: "#cfe2ff", fontSize: 18, marginTop: 24 }}>
          AI detected a serious concern. Review the live camera immediately.
          Only contact emergency services if there is a real emergency.
        </Text>
      </View>

      <Pressable
        onPress={() =>
          router.push({
            pathname: "/camera-live",
            params: { room, cameraName: `${room} Camera` },
          } as any)
        }
        style={{ backgroundColor: "#2563eb", padding: 18, borderRadius: 16, marginTop: 24 }}
      >
        <Text style={{ color: "#fff", textAlign: "center", fontSize: 22, fontWeight: "800" }}>
          📹 View Live Camera
        </Text>
      </Pressable>

      <Pressable
        onPress={callEmergency}
        style={{ backgroundColor: "#dc2626", padding: 18, borderRadius: 16, marginTop: 16 }}
      >
        <Text style={{ color: "#fff", textAlign: "center", fontSize: 22, fontWeight: "800" }}>
          📞 Call 999
        </Text>
      </Pressable>

      <Pressable
        onPress={() => router.back()}
        style={{ backgroundColor: "#334155", padding: 18, borderRadius: 16, marginTop: 16 }}
      >
        <Text style={{ color: "#fff", textAlign: "center", fontSize: 22, fontWeight: "800" }}>
          Dismiss
        </Text>
      </Pressable>
    </ScrollView>
  );
}