import { useLocalSearchParams, useRouter } from "expo-router";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useIncident } from "../context/IncidentContext";
import { db } from "../lib/firebase";

export default function CareCameraViewer() {
  const router = useRouter();

  const { incidentId, room, camera, stage } =
    useLocalSearchParams<{
      incidentId?: string;
      room?: string;
      camera?: string;
      stage?: string;
    }>();

  const { incident } = useIncident();

  const currentIncidentId =
  typeof incidentId === "string" && incidentId.trim()
    ? incidentId.trim()
    : String(
        (incident as any)?.id ??
        (incident as any)?.incidentId ??
        ""
      ).trim();

const currentRoom =
  typeof room === "string" && room.trim()
    ? room.trim()
    : String((incident as any)?.room ?? "").trim();

const currentStage =
  typeof stage === "string" && stage.trim()
    ? stage.trim().toUpperCase()
    : String((incident as any)?.stage ?? "RESOLVED")
        .trim()
        .toUpperCase();

  const currentAssignedStaff =
    String((incident as any)?.assignedStaff ?? "Assigned staff").trim() ||
    "Assigned staff";

  const [time, setTime] = useState(new Date());
  const [snapshotTaken, setSnapshotTaken] = useState(false);

  const currentCamera =
    typeof camera === "string" && camera.trim()
      ? camera.trim()
      : `${currentRoom} Camera`;

  const showStaff =
    currentStage === "AT_SCENE" ||
    currentStage === "ASSESSMENT" ||
    currentStage === "TRANSPORT";

  

 const cameraIconMap: Record<string, string> = {
    [`${currentRoom} Camera`]: "🛏️",
    "Corridor Camera": "🚪",
    "Door Camera": "🚪",
    "Entrance Camera": "🚑",
    "Nurse Station": "👩",
    "Exit Camera": "🏥",
  };

  const cameraIcon = cameraIconMap[currentCamera] ?? "📹";

  const stageMessageMap: Record<string, string> = {
    ALERT_CREATED: "🚨 Fall detected • Confidence 98%",
    STAFF_ASSIGNED:
     `👩 Staff assigned • ${currentAssignedStaff} responding`,
    EN_ROUTE: "👣 Corridor tracking • Staff en route",
    AT_SCENE: "📍 Staff on scene • Resident located",
    ASSESSMENT: "🩺 Assessment active • Monitoring vitals",
    AMBULANCE_REQUESTED: "🚑 Ambulance requested • Handover active",
    TRANSPORT: "🏥 Transport active • Route monitored",
    RESOLVED: "✅ Incident archived • Recording saved",
  };

  const stageMessage =
    stageMessageMap[currentStage] ?? "🤖 AI monitoring active";

  const stageEventsMap: Record<string, string[]> = {
    ALERT_CREATED: [
      "🟢 Resident detected",
      "🚨 Fall confidence 98%",
      "📡 Alert sent to command center",
    ],
    STAFF_ASSIGNED: [
      `👩 ${currentAssignedStaff} assigned`,
      "📡 Staff notification sent",
      "📹 Camera tracking continued",
    ],
    EN_ROUTE: [
      "👣 Staff movement detected",
      "📍 Corridor camera active",
      "⏱ ETA updating",
    ],
   AT_SCENE: [
      `📍 Staff entered ${currentRoom}`,
      `👩 ${currentAssignedStaff} identified`,
      "🤖 Resident interaction detected",
    ],
    ASSESSMENT: [
      "🩺 Assessment started",
      "❤️ Vitals observation active",
      "📹 Scene recording maintained",
    ],
    AMBULANCE_REQUESTED: [
      "🚑 Emergency support requested",
      "📡 Handover preparation active",
      "📹 Scene visibility maintained",
    ],
    TRANSPORT: [
      "🏥 Transport started",
      "🚑 Resident movement monitored",
      "📹 Exit route camera ready",
    ],
    RESOLVED: [
      "✅ Incident resolved",
      "💾 Recording archived",
      "📄 AI report generated",
    ],
  };

  const stageEvents = stageEventsMap[currentStage] ?? [
    "🤖 AI monitoring active",
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const saveIncidentSnapshot = async () => {
    if (!currentIncidentId) {
      console.warn("Snapshot not saved: incidentId is missing", {
        incidentId,
        room,
        stage,
      });

      return;
    }

    try {
      await addDoc(collection(db, "careEvidence"), {
        incidentId: currentIncidentId,
        room: currentRoom,
        stage: currentStage,
        evidenceType: "snapshot",
        icon: "📸",
        label: `${currentRoom} camera snapshot`,
        createdAt: serverTimestamp(),
      });

      console.log("✅ Incident snapshot saved:", {
        incidentId: currentIncidentId,
        room: currentRoom,
        stage: currentStage,
      });
    } catch (error) {
      console.error("❌ Could not save incident snapshot:", error);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#061826" }}
      contentContainerStyle={{
        padding: 24,
        paddingTop: 40,
        paddingBottom: 80,
      }}
    >

      <Text style={{ color: "#fff", fontSize: 42, fontWeight: "900" }}>
        📹 {currentCamera}
      </Text>

      <Text style={{ color: "#93c5fd", fontSize: 20, marginTop: 8 }}>
        Live AI camera inspection
      </Text>

      <View
        style={{
          marginTop: 24,
          backgroundColor: "#081826",
          borderRadius: 18,
          borderWidth: 2,
          borderColor: "#22c55e",
          padding: 18,
        }}
      >
        <Text style={{ color: "#22c55e", fontSize: 16, fontWeight: "900" }}>
          🔴 REC • {time.toLocaleTimeString()}
        </Text>

        <View
          style={{
            height: 260,
            marginTop: 16,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: "#2563eb",
            backgroundColor: "#020617",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 76 }}>{cameraIcon}</Text>

          <View
            style={{
              position: "absolute",
              top: 70,
              left: 170,
              borderWidth: 2,
              borderColor: "#22c55e",
              borderRadius: 8,
              paddingHorizontal: 8,
              paddingVertical: 4,
              backgroundColor: "rgba(34,197,94,0.15)",
            }}
          >
            <Text
              style={{
                color: "#22c55e",
                fontSize: 11,
                fontWeight: "900",
              }}
            >
              {currentStage === "RESOLVED" ? "Archived" : "Resident"}
            </Text>
          </View>

          {showStaff && (
            <View
              style={{
                position: "absolute",
                top: 150,
                left: 110,
                borderWidth: 2,
                borderColor: "#3b82f6",
                borderRadius: 8,
                paddingHorizontal: 8,
                paddingVertical: 4,
                backgroundColor: "rgba(59,130,246,0.15)",
              }}
            >
              <Text
                style={{
                  color: "#3b82f6",
                  fontSize: 11,
                  fontWeight: "900",
                }}
              >
                {currentAssignedStaff}
              </Text>
            </View>
          )}

          <Text style={{ color: "#93c5fd", fontSize: 16, marginTop: 8 }}>
            AI CCTV FEED
          </Text>
        </View>

        <Text style={{ color: "#fbbf24", fontSize: 18, fontWeight: "900", marginTop: 16 }}>
          Current Stage: {currentStage}
        </Text>

        <Text style={{ color: "#cfe2ff", fontSize: 16, marginTop: 8 }}>
          {stageMessage}
        </Text>
      </View>

      {snapshotTaken && (
        <View
          style={{
            marginTop: 12,
            backgroundColor: "#14532d",
            padding: 10,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: "#22c55e",
          }}
        >
          <Text
            style={{
              color: "#86efac",
              fontWeight: "900",
            }}
          >
            📸 Snapshot captured and saved to incident evidence.
          </Text>
        </View>
      )}

      <View
        style={{
          marginTop: 20,
          backgroundColor: "#081826",
          borderRadius: 16,
          borderWidth: 1,
          borderColor: "#2563eb",
          padding: 16,
        }}
      >
        <Text style={{ color: "#fff", fontSize: 24, fontWeight: "900" }}>
          🕒 AI Events
        </Text>

        {stageEvents.map((event, index) => (
          <Text
            key={index}
            style={{
              color: "#cfe2ff",
              fontSize: 16,
              marginTop: 10,
            }}
          >
            {event}
          </Text>
        ))}
      </View>

      <View
        style={{
          marginTop: 18,
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        {[
          "📸 Snapshot",
          "▶ Replay",
          "🔍 Zoom",
          "📤 Export",
        ].map((action) => (
          <Pressable
            key={action}
            onPress={async () => {
              if (action.includes("Snapshot")) {
                setSnapshotTaken(true);

                await saveIncidentSnapshot();

                setTimeout(() => {
                  setSnapshotTaken(false);
                }, 2000);
              }

              if (action.includes("Replay")) {
                router.push({
                  pathname: "/care-camera-playback",
                  params: {
                    incidentId: currentIncidentId,
                    room: currentRoom,
                    stage: currentStage,
                  },
                } as any);
              }

              if (action.includes("Export")) {
                console.log("CAMERA → EVIDENCE:", {
                  incidentId: currentIncidentId,
                  room: currentRoom,
                  stage: currentStage,
                });

                router.push({
                  pathname: "/care-evidence-gallery",
                  params: {
                    incidentId: currentIncidentId,
                    room: currentRoom,
                    stage: currentStage,
                  },
                } as any);
              }
            }}
            style={{
              backgroundColor: "#2563eb",
              padding: 12,
              borderRadius: 12,
              width: "48%",
            }}
          >
            <Text
              style={{
                color: "#fff",
                textAlign: "center",
                fontWeight: "900",
                fontSize: 14,
              }}
            >
              {action}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        onPress={() => router.back()}
        style={{
          backgroundColor: "#374151",
          padding: 14,
          borderRadius: 12,
          marginTop: 20,
        }}
      >
        <Text style={{ color: "#fff", textAlign: "center", fontWeight: "900" }}>
          ← Back
        </Text>
      </Pressable>

    </ScrollView>
  );
}