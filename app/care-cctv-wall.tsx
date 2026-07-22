import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useIncident } from "../context/IncidentContext";


  export default function CareCCTVWall() {
    const router = useRouter();
    const { incidentId, room, stage } = useLocalSearchParams<{
      incidentId?: string;
      room?: string;
      stage?: string;
    }>();

    const { incident } = useIncident();

    const currentIncidentId =
      typeof incidentId === "string" && incidentId.trim()
        ? incidentId
        : String(
            (incident as any)?.incidentId ??
              (incident as any)?.eventId ??
              (incident as any)?.id ??
              ""
          );

    const currentRoom =
      typeof room === "string" && room.trim()
        ? room.trim()
        : typeof incident?.room === "string" && incident.room.trim()
        ? incident.room.trim()
        : "";
    

    const getCameras = (stage: string) => [
      {
        name: `${currentRoom || "Resident room"} Camera`,
        icon: "🛏️",
        active: ["ALERT_CREATED", "ASSESSMENT"].includes(stage),
        ai: stage === "ALERT_CREATED" ? "🤖 Fall 98%" : "🤖 Monitoring",
      },
      {
        name: "Corridor Camera",
        icon: "🚪",
        active: stage === "EN_ROUTE",
        ai: "👣 Tracking",
      },
      {
        name: "Door Camera",
        icon: "🚪",
        active: stage === "AT_SCENE",
        ai: "🚪 Arrival",
      },
      {
        name: "Entrance Camera",
        icon: "🚑",
        active: stage === "AMBULANCE_REQUESTED",
        ai: "🚑 Handover",
      },
      {
        name: "Nurse Station",
        icon: "👩‍⚕️",
        active: stage === "STAFF_ASSIGNED",
        ai: "👩‍⚕️ Dispatch",
      },
      {
        name: "Exit Camera",
        icon: "🏥",
        active: stage === "TRANSPORT",
        ai: "🏥 Transport",
      },
    ];

    const currentStage = typeof stage === "string" ? stage : "ALERT_CREATED";
    const cameras = getCameras(currentStage);
    const isResolved = currentStage === "RESOLVED";

    const [time, setTime] = useState(new Date());
    const [blink, setBlink] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setBlink((prev) => !prev);
    }, 600);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#061826" }}
      contentContainerStyle={{ padding: 24, paddingTop: 50, paddingBottom: 80 }}
    >
      <Text style={{ color: "#fff", fontSize: 44, fontWeight: "900" }}>
        📹 AI CCTV Wall
      </Text>

      <Text style={{ color: "#93c5fd", fontSize: 20, marginTop: 10 }}>
        Live multi-camera incident monitoring
      </Text>

      <Text style={{ color: isResolved ? "#22c55e" : "#fbbf24", fontSize: 18, fontWeight: "900", marginTop: 12 }}>
        {isResolved ? "✅ Incident Closed — All Cameras Standby" : `Active Stage: ${currentStage}`}
      </Text>

      <View style={{ marginTop: 28, flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
        {cameras.map((cam) => (
          <Pressable
              key={cam.name}
              onPress={() => {
                console.log("CCTV WALL → CAMERA VIEWER:", {
                  incidentId: currentIncidentId,
                  room: currentRoom,
                  camera: cam.name,
                  stage: currentStage,
                });

                router.push({
                  pathname: "/care-camera-viewer",
                  params: {
                    incidentId: currentIncidentId,
                    room: currentRoom,
                    camera: cam.name,
                    stage: currentStage,
                  },
                } as any);
              }}
            style={{
              width: "47%",
              backgroundColor: "#081826",
              borderRadius: 16,
              padding: 14,
              borderWidth: 2,
              borderColor: cam.active ? "#22c55e" : "#2563eb",
              minHeight: 150,
            }}
          >
            <View
              style={{
                height: 82,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: cam.active ? "#22c55e" : "#2563eb",
                backgroundColor: "#020617",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 10,
                position: "relative",
              }}
            >
              <Text style={{ fontSize: 34 }}>{cam.icon}</Text>

              <Text
                style={{
                  position: "absolute",
                  bottom: 6,
                  left: 8,
                  color: cam.active ? "#22c55e" : "#93c5fd",
                  fontSize: 9,
                  fontWeight: "900",
                }}
              >
                {cam.ai}
              </Text>

              <Text
                style={{
                  position: "absolute",
                  top: 6,
                  left: 8,
                  color: cam.active ? "#22c55e" : "#93c5fd",
                  fontSize: 10,
                  fontWeight: "900",
                }}
              >
                {cam.active ? `${blink ? "🔴" : "⚫"} REC` : "⚪ IDLE"}
              </Text>

              <Text
                style={{
                  position: "absolute",
                  top: 22,
                  left: 8,
                  color: "#93c5fd",
                  fontSize: 9,
                  fontWeight: "700",
                }}
              >
                {time.toLocaleTimeString()}
              </Text>

              <Text
                style={{
                  position: "absolute",
                  bottom: 6,
                  right: 8,
                  color: "#93c5fd",
                  fontSize: 10,
                  fontWeight: "800",
                }}
              >
                CCTV
              </Text>
            </View>

            <Text
              style={{
                color: "#fff",
                fontSize: 16,
                fontWeight: "900",
                textAlign: "center",
                marginTop: 10,
              }}
            >
              {cam.name}
            </Text>

            <Text
              style={{
                color: cam.active ? "#22c55e" : "#93c5fd",
                fontSize: 13,
                fontWeight: "800",
                textAlign: "center",
                marginTop: 8,
              }}
            >
              {cam.active ? "● LIVE" : "STANDBY"}
            </Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}