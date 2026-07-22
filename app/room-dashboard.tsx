import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

export default function RoomDashboard() {
  const router = useRouter();
  const { room, status } = useLocalSearchParams();

  return (
    <ScrollView
      style={{
        flex: 1,
        backgroundColor: "#061826",
      }}
      contentContainerStyle={{
        padding: 20,
        paddingTop: 40,
        paddingBottom: 80,
      }}
    >
      <Text
        style={{
          color: "#fff",
          fontSize: 34,
          fontWeight: "700",
          marginBottom: 8,
        }}
      >
        🏠 {room}
      </Text>

      <View style={{
          backgroundColor: "#0a2b52",
          padding: 20,
          borderRadius: 20,
          marginBottom: 16,
        }}>
          <Text style={{ color: "#fff", fontSize: 26, fontWeight: "700", marginBottom: 12 }}>
            📊 Room Status
          </Text>

          <Text style={{ color: "#cbd5e1", fontSize: 18 }}>Status: {status}</Text>
          <Text style={{ color: "#cbd5e1", fontSize: 18 }}>Devices Online: 3</Text>
          <Text style={{ color: "#cbd5e1", fontSize: 18 }}>Last Activity: Just now</Text>
        </View>

        <View
          style={{
            backgroundColor: "#0a2b52",
            padding: 20,
            borderRadius: 20,
            marginBottom: 24,
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontSize: 30,
              fontWeight: "700",
              marginBottom: 16,
            }}
          >
            📹 Live Camera
          </Text>

          <View
            style={{
              height: 210,
              backgroundColor: "#061826",
              borderRadius: 18,
              justifyContent: "center",
              alignItems: "center",
              marginBottom: 16,
              borderWidth: 1,
              borderColor: "#2563eb",
            }}
          >
            <Text style={{ fontSize: 46 }}>📷</Text>

            <Text
              style={{
                color: "#fff",
                fontSize: 22,
                fontWeight: "700",
                marginTop: 10,
              }}
            >
              {room} Camera
            </Text>

            <Text style={{ color: "#93c5fd", fontSize: 16, marginTop: 6 }}>
              Live preview ready
            </Text>
          </View>

          <Text style={{ color: "#22c55e", fontSize: 18, fontWeight: "700" }}>
            🔴 LIVE
          </Text>

          <Text style={{ color: "#cbd5e1", fontSize: 18, marginTop: 8 }}>
            Last motion: Just now
          </Text>
        </View>

        <View
          style={{
            backgroundColor: "#0a2b52",
            padding: 20,
            borderRadius: 20,
            marginBottom: 28,
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontSize: 30,
              fontWeight: "800",
              marginBottom: 18,
            }}
          >
            🧠 Live Devices
          </Text>

          {[
            { icon: "💡", name: "Ceiling Light", status: "ON", color: "#22c55e" },
            { icon: "📷", name: "Camera", status: "LIVE", color: "#22c55e" },
            { icon: "📡", name: "Motion Sensor", status: "ACTIVE", color: "#22c55e" },
            { icon: "🔌", name: "Smart Plug", status: "OFF", color: "#ef4444" },
          ].map((device, index) => (
            <Pressable
              key={index}
              style={{
                backgroundColor: "#123f73",
                padding: 16,
                borderRadius: 16,
                marginBottom: 12,
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>
                {device.icon} {device.name}
              </Text>

              <Text
                style={{
                  color: device.color,
                  fontSize: 16,
                  fontWeight: "800",
                }}
              >
                {device.status}
              </Text>
            </Pressable>
          ))}
        </View>

        <View
          style={{
            backgroundColor: "#0f2d49",
            borderRadius: 20,
            padding: 20,
            marginTop: 20,
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontSize: 28,
              fontWeight: "700",
              marginBottom: 18,
            }}
          >
            📜 Recent Activity
          </Text>

          {[
            "📸 Motion detected",
            "🎥 Camera recording started",
            "💡 Ceiling light turned on",
            "👤 Owner viewed camera",
            "✅ Motion sensor reset",
          ].map((item, index) => (
            <View
              key={index}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 14,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 17 }}>
                {item}
              </Text>

              <Text
                style={{
                  color: "#8fa7c6",
                  fontSize: 15,
                }}
              >
                Just now
              </Text>
            </View>
          ))}
        </View>

        <View
          style={{
            backgroundColor: "#0f2d49",
            borderRadius: 20,
            padding: 20,
            marginTop: 20,
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontSize: 28,
              fontWeight: "700",
              marginBottom: 18,
            }}
          >
            🧠 Room Intelligence
          </Text>

          <Text style={{ color: "#c7d7ea", fontSize: 18, marginBottom: 10 }}>
            Occupancy: 👤 1 person detected
          </Text>

          <Text style={{ color: "#c7d7ea", fontSize: 18, marginBottom: 10 }}>
            Motion: Active
          </Text>

          <Text style={{ color: "#c7d7ea", fontSize: 18, marginBottom: 10 }}>
            Risk: MEDIUM
          </Text>

          <Text style={{ color: "#c7d7ea", fontSize: 18, marginBottom: 10 }}>
            Confidence: 93%
          </Text>

          <View
            style={{
              height: 1,
              backgroundColor: "rgba(255,255,255,0.18)",
              marginVertical: 14,
            }}
          />

          <Text
            style={{
              color: "#fff",
              fontSize: 22,
              fontWeight: "700",
              marginBottom: 8,
            }}
          >
            AI Recommendation
          </Text>

          <Text style={{ color: "#c7d7ea", fontSize: 18, lineHeight: 26 }}>
            Continue monitoring. No abnormal behaviour detected.
          </Text>
        </View>

        <View style={{
          backgroundColor: "#0a2b52",
          padding: 20,
          borderRadius: 20,
          marginBottom: 16,
        }}>
          <Text style={{ color: "#fff", fontSize: 26, fontWeight: "700",    marginBottom: 12 }}>
            ⚡ Quick Controls
          </Text>

          <Pressable
            onPress={() =>
              router.push({
                pathname: "/incident-playback",
                params: {
                  room,
                  cameraName: `${room} Camera`,
                },
              } as any)
            }
            style={{
              backgroundColor: "#2563eb",
              padding: 16,
              borderRadius: 14,
              marginBottom: 12,
            }}
          >
            <Text style={{ color: "#fff", textAlign: "center", fontWeight: "700", fontSize: 18 }}>
              📹 Open Camera
            </Text>
          </Pressable>

          <Pressable
            style={{
              backgroundColor: "#2563eb",
              padding: 16,
              borderRadius: 14,
              marginBottom: 12,
            }}
          >
            <Text style={{ color: "#fff", textAlign: "center", fontWeight: "700", fontSize: 18 }}>
              💡 Toggle Lights
            </Text>
          </Pressable>

          <Pressable
            style={{
              backgroundColor: "#dc2626",
              padding: 16,
              borderRadius: 14,
            }}
          >
            <Text style={{ color: "#fff", textAlign: "center", fontWeight: "700", fontSize: 18 }}>
              🚨 Trigger Room Alert
            </Text>
          </Pressable>
        </View>
    </ScrollView>     
  );
}