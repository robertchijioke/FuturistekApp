import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { useIncident } from "../context/IncidentContext";


  export default function CareCameraPlayback() {
    const router = useRouter();

    const { incidentId, room, stage } = useLocalSearchParams<{
      incidentId?: string;
      room?: string;
      stage?: string;
    }>();

    console.log("PLAYBACK PARAMS:", {
      incidentId,
      room,
      stage,
    });

    const { incident } = useIncident();

    const routeIncidentId =
      typeof incidentId === "string"
        ? incidentId.trim()
        : "";

    const contextIncidentId = String(
      (incident as any)?.incidentId ??
        (incident as any)?.eventId ??
        (incident as any)?.id ??
        ""
    ).trim();

    const currentIncidentId =
      routeIncidentId || contextIncidentId;

    const routeStage =
      typeof stage === "string"
        ? stage.trim()
        : "";

    const contextStage = String(
      (incident as any)?.stage ?? ""
    ).trim();

    const currentStage = (
      routeStage ||
      contextStage ||
      "ALERT_CREATED"
    ).toUpperCase();

    const routeRoom =
      typeof room === "string"
        ? room.trim()
        : "";

    const contextRoom = String(
      (incident as any)?.room ?? ""
    ).trim();

    const currentRoom =
      routeRoom || contextRoom;

    const incidentRoom = currentRoom;

    const incidentType =
      String(
        (incident as any)?.type ?? "Incident"
      ).trim() || "Incident";

    const assignedStaffName =
      String(
        (incident as any)?.assignedStaff ??
          "Assigned staff"
      ).trim() || "Assigned staff";

    const firstEventTitle =
      incidentType === "Fall Detection"
        ? "Fall detected"
        : `${incidentType} detected`;

    const firstEventDetail =
      incidentType === "Fall Detection"
        ? `Camera flagged sudden movement in ${incidentRoom}`
        : `AI camera detected a possible ${incidentType.toLowerCase()} in ${incidentRoom}`;

    const cameraEvents = [
      {
        stage: "ALERT_CREATED",
        title: firstEventTitle,
        detail: firstEventDetail,
        icon: "🚨",
        image: "🛏️",
      },
      {
        stage: "STAFF_ASSIGNED",
        title: "Camera tracking active",
        detail: `AI keeps monitoring while ${assignedStaffName} is assigned`,
        icon: "📹",
        image: "📹",
      },
      { stage: "EN_ROUTE", title: "Resident still monitored", detail: "No staff visible yet. Camera continues observation", icon: "👁️", image: "🚪" },
      {
        stage: "AT_SCENE",
        title: "Staff entered room",
        detail: `${assignedStaffName} appears at ${
          incidentRoom || "the resident room"
        } scene`,
        icon: "📍",
        image: "🧑",
      },
      { stage: "ASSESSMENT", title: "Assessment in progress", detail: "Camera records care assessment activity", icon: "🩺", image: "🩺" },
      { stage: "AMBULANCE_REQUESTED", title: "Emergency support", detail: "Camera keeps scene visible for handover", icon: "🚑", image: "🚑" },
      { stage: "TRANSPORT", title: "Resident transport", detail: "Resident prepared for safe transport", icon: "🏥", image: "🏥" },
      { stage: "RESOLVED", title: "Playback complete", detail: "Incident closed. Footage archived", icon: "✅", image: "✅" },
    ];

    const stageOrder = [
      "ALERT_CREATED",
      "STAFF_ASSIGNED",
      "EN_ROUTE",
      "AT_SCENE",
      "ASSESSMENT",
      "AMBULANCE_REQUESTED",
      "TRANSPORT",
      "RESOLVED",
    ];

    const currentStageIndex = stageOrder.indexOf(currentStage);
    const activeStage = stageOrder[currentStageIndex];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#061826" }}
      contentContainerStyle={{ padding: 24, paddingTop: 50, paddingBottom: 90 }}
    >
      <Text style={{ color: "#fff", fontSize: 42, fontWeight: "900" }}>
        📹 Camera Playback
      </Text>

      <Text
        style={{
          color: "#93c5fd",
          fontSize: 20,
          marginTop: 8,
        }}
      >
        {incidentRoom} visual incident review
      </Text>

      <View style={{ marginTop: 24 }}>
        {cameraEvents
          .filter((item) => {
            const eventIndex = stageOrder.indexOf(item.stage);
            return eventIndex <= currentStageIndex;
          })
          .map((item, index) => {
          const isActive = item.stage === activeStage;

          return (
            <View
              key={index}
             style={{
                backgroundColor: isActive ? "#102c46" : "#081826",
                borderRadius: 16,
                padding: 16,
                marginBottom: 14,
                borderWidth: isActive ? 3 : 1,
                borderColor: isActive ? "#38bdf8" : "#2563eb",
              }}
            >

              <View
                style={{
                  height: 140,
                  backgroundColor: "#061826",
                  borderRadius: 14,
                  marginBottom: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: "#2563eb",
                }}
              >
                <Text style={{ fontSize: 64 }}>
                  {item.image}
                </Text>

                <Text
                  style={{
                    color: "#93c5fd",
                    fontSize: 14,
                    marginTop: 6,
                  }}
                >
                  CCTV FRAME
                </Text>
              </View>

              {isActive && (
                <View
                    style={{
                        alignSelf: "flex-start",
                        backgroundColor: "#22c55e",
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 20,
                        marginBottom: 10,
                    }}>
                    <Text
                        style={{
                            color: "#fff",
                            fontWeight: "900",
                            fontSize: 12,
                        }}>
                        ● LIVE
                    </Text>
                </View>
            )}

            <Text style={{ color: "#fbbf24", fontSize: 18, fontWeight: "900" }}>
              {item.stage}
            </Text>

            <Text style={{ color: "#fff", fontSize: 24, fontWeight: "900", marginTop: 10 }}>
              {item.icon} {item.title}
            </Text>

            <Text style={{ color: "#cfe2ff", fontSize: 17, marginTop: 8 }}>
              {item.detail}
            </Text>
          </View>
          );
          })}
      </View>
    </ScrollView>
)}
