  import { useLocalSearchParams, useRouter } from "expo-router";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { auth, db } from "../lib/firebase";


  export default function IncidentPlayback() {
    const router = useRouter();

    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [evidence, setEvidence] = useState<any[]>([]);

    const {
      room = "Living Room",
      cameraName = "Living Room Camera",
    } = useLocalSearchParams();

    useEffect(() => {
    if (!isPlaying) return;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          return 100;
        }

        return prev + 2;
      });
    }, 300);

    return () => clearInterval(timer);
  }, [isPlaying]);

    useEffect(() => {
    const loadEvidence = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const evidenceRef = collection(
        db,
        "users",
        user.uid,
        "securityCaptures"
      );

      const snap = await getDocs(
        query(evidenceRef, orderBy("createdAt", "desc"), limit(4))
      );

      setEvidence(
        snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
      );
    };

    loadEvidence();
  }, []);

  const getStepStatus = (index: number) => {
    const stepProgress = [0, 20, 40, 60, 80, 100];

    if (progress >= stepProgress[index]) {
      return "complete";
    }

    if (progress >= stepProgress[index] - 10) {
      return "active";
    }

    return "pending";
  };

  
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#061826" }}
      contentContainerStyle={{ padding: 22, paddingTop: 70, paddingBottom: 60 }}
    >
      <Text style={{ color: "#fff", fontSize: 42, fontWeight: "800" }}>
        🎬 Incident Playback
      </Text>

      <Text style={{ color: "#9fb3c8", fontSize: 22, marginTop: 8 }}>
        {String(room)}
      </Text>

      <View
        style={{
          backgroundColor: "#0f2d49",
          borderRadius: 20,
          padding: 20,
          marginTop: 24,
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
          🎥 Incident Recording
        </Text>

        <View
          style={{
            height: 220,
            borderRadius: 18,
            borderWidth: 2,
            borderColor: "#2563eb",
            backgroundColor: "#081826",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 70 }}>📹</Text>

          <Text
            style={{
              color: "#fff",
              fontSize: 28,
              fontWeight: "700",
              marginTop: 14,
              textAlign: "center",
            }}
          >
            {String(cameraName)}
          </Text>

          <Text style={{ color: "#8fb8ff", fontSize: 20, marginTop: 10 }}>
            Recording Ready
          </Text>
        </View>

        <Text
          style={{
            color: "#22c55e",
            fontSize: 22,
            fontWeight: "700",
            marginTop: 20,
          }}
        >
          Duration: 17 seconds
        </Text>
      </View>

      <View
        style={{
          marginTop: 20,
          marginBottom: 10,
        }}
      >
        <Text
          style={{
            color: "#8fb8ff",
            marginBottom: 8,
          }}
        >
          Playback Progress
        </Text>

        <View
          style={{
            height: 8,
            backgroundColor: "#1b3654",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              width: `${progress}%`,
              height: "100%",
              backgroundColor: "#22c55e",
            }}
          />
        </View>

        <Text
          style={{
            color: "#8fb8ff",
            marginTop: 8,
          }}
        >
          {progress}%
        </Text>
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
          🕒 Playback Timeline
        </Text>

     {[
        ["📸", "Motion detected", "17:22:41"],
        ["👤", "Person detected", "17:22:43"],
        ["🧠", "AI classified subject", "17:22:45"],
        ["🚨", "Alert created", "17:22:47"],
        ["📢", "Voice warning played", "17:22:49"],
        ["👮", "Owner notified", "17:22:55"],
      ].map(([icon, event, time], index) => {
        const status = getStepStatus(index);

        return (
          <View
            key={index}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginBottom: 14,
              opacity: status === "pending" ? 0.45 : 1,
              backgroundColor: status === "active" ? "#123f66" : "transparent",
              padding: status === "active" ? 10 : 0,
              borderRadius: 12,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 18, flex: 1 }}>
              {status === "complete" ? "✅" : icon} {event}
            </Text>

            <Text style={{ color: "#8fb8ff", fontSize: 16 }}>
              {time}
            </Text>
          </View>
        );
      })}
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
          ▶ Playback Controls
        </Text>

        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
          }}
        >
          {["⏮", "▶", "⏸", "⏭"].map((icon) => (
            <Pressable
              key={icon}
              onPress={() => {
                if (icon === "▶") {
                  setIsPlaying(true);
                } else if (icon === "⏸") {
                  setIsPlaying(false);
                } else if (icon === "⏮") {
                  setProgress((p) => Math.max(0, p - 10));
                } else if (icon === "⏭") {
                  setProgress((p) => Math.min(100, p + 10));
                }
              }}
              style={{
                backgroundColor: "#2563eb",
                width: 70,
                height: 70,
                borderRadius: 18,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 28 }}>{icon}</Text>
            </Pressable>
          ))}
        </View>
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
          🧠 AI Investigation Summary
        </Text>

        <Text style={{ color: "#c7d7ea", fontSize: 18, marginBottom: 10 }}>
          Detected Subject: Unknown Person
        </Text>

        <Text style={{ color: "#c7d7ea", fontSize: 18, marginBottom: 10 }}>
          Threat Level: HIGH
        </Text>

        <Text style={{ color: "#c7d7ea", fontSize: 18, marginBottom: 10 }}>
          Confidence: 97%
        </Text>

        <Text style={{ color: "#c7d7ea", fontSize: 18, marginBottom: 10 }}>
          Behaviour: Loitering
        </Text>

        <Text
          style={{
            color: "#fff",
            fontSize: 22,
            fontWeight: "700",
            marginTop: 18,
            marginBottom: 10,
          }}
        >
          Recommendation
        </Text>

        <Text
          style={{
            color: "#8fb8ff",
            fontSize: 18,
            lineHeight: 28,
          }}
        >
          Continue recording. Notify authorities if movement persists.
        </Text>
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
          📸 Evidence Gallery
        </Text>

        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "space-between",
          }}
        >
         {evidence.map((item, index) => {
          const imageSource = item.image || item.thumbnail;

          return (
            <Pressable
              key={item.id || index}
              onPress={() =>
                router.push({
                  pathname: "/snapshot-viewer",
                  params: {
                    image: imageSource,
                    title: `Snapshot ${index + 1}`,
                    room: item.room || item.cameraName || "Living Room",
                    classification: item.aiClassification || "Unknown movement",
                    threatLevel: item.threatLevel || item.risk || "MEDIUM",
                    time: item.createdAt?.seconds
                      ? new Date(item.createdAt.seconds * 1000).toLocaleString()
                      : "",
                  },
                } as any)
              }
              style={{
                width: "48%",
                height: 150,
                backgroundColor: "#081826",
                borderRadius: 16,
                borderWidth: 1,
                borderColor: "#2563eb",
                marginBottom: 14,
                overflow: "hidden",
              }}
            >
              {imageSource ? (
                <Image
                  source={{ uri: imageSource }}
                  style={{
                    width: "100%",
                    height: 95,
                  }}
                  resizeMode="cover"
                />
              ) : (
                <Text style={{ fontSize: 38, textAlign: "center", marginTop: 25 }}>
                  📷
                </Text>
              )}

              <Text
                style={{
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: "700",
                  marginTop: 8,
                  textAlign: "center",
                }}
              >
                Snapshot {index + 1}
              </Text>
            </Pressable>
          );
        })}
        </View>
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
        <Text
          style={{
            color: "#fff",
            fontSize: 22,
            fontWeight: "700",
            textAlign: "center",
          }}
        >
          ← Back
        </Text>
      </Pressable>
    </ScrollView>
  );
}