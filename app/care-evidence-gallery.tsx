import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useIncident } from "../context/IncidentContext";

  export default function CareEvidenceGallery() {
    const router = useRouter();
    const { incident } = useIncident();
    const careIncident = incident;

    const safeSnapshots = Array.isArray((incident as any)?.snapshots)
      ? (incident as any).snapshots
      : [];

    const { incidentId, room, stage, assignedStaff } =
      useLocalSearchParams<{
        incidentId?: string;
        room?: string;
        stage?: string;
        assignedStaff?: string;
      }>();

    console.log("EVIDENCE GALLERY PARAMS:", {
      incidentId,
      room,
      stage,
    });

  const currentIncidentId =
    typeof incidentId === "string" && incidentId.trim()
      ? incidentId.trim()
      : String(
          (careIncident as any)?.id ??
            (careIncident as any)?.incidentId ??
            (careIncident as any)?.eventId ??
            ""
        ).trim();

  const currentRoom =
    typeof room === "string" && room.trim()
      ? room.trim()
      : String((careIncident as any)?.room ?? "").trim();

  const currentStage =
    typeof stage === "string" && stage.trim()
      ? stage.trim().toUpperCase()
      : String((careIncident as any)?.stage ?? "RESOLVED")
          .trim()
          .toUpperCase();

  const currentAssignedStaff =
    typeof assignedStaff === "string" && assignedStaff.trim()
      ? assignedStaff.trim()
      : String(
          (careIncident as any)?.assignedStaff ?? "Unassigned"
        ).trim() || "Unassigned";

  const snapshots = Array.isArray((careIncident as any)?.snapshots)
    ? (careIncident as any).snapshots
    : [];

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
          📂 Incident Evidence
        </Text>

        <Text style={{ color: "#93c5fd", fontSize: 20, marginTop: 8 }}>
          {currentRoom || "Unknown room"} • Incident evidence vault
        </Text>

        <View
          style={{
            marginTop: 24,
            backgroundColor: "#081826",
            borderRadius: 18,
            borderWidth: 1,
            borderColor: "#2563eb",
            padding: 16,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 26, fontWeight: "900" }}>
            Captured Snapshots
          </Text>

          {snapshots.map((item: any, index: number) => (
            <View
              key={index}
              style={{
                marginTop: 14,
                padding: 14,
                borderRadius: 14,
                backgroundColor: "#020617",
                borderWidth: 1,
                borderColor: "#22c55e",
              }}
            >
              <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900" }}>
                {item.icon} Snapshot #{index + 1}
              </Text>

              <Text style={{ color: "#93c5fd", fontSize: 16, marginTop: 6 }}>
                {item.time}
              </Text>

              <Text style={{ color: "#cfe2ff", fontSize: 16, marginTop: 4 }}>
                {item.label}
              </Text>
            </View>
          ))}
        </View>

        <Pressable
          onPress={() => {
            console.log("EVIDENCE → PACKAGE:", {
              incidentId: currentIncidentId,
              room: currentRoom,
              stage: currentStage,
            });

            router.push({
              pathname: "/care-incident-package",
              params: {
                incidentId: currentIncidentId,
                room: currentRoom,
                stage: currentStage,
                assignedStaff: currentAssignedStaff,
              },
            } as any);
          }}
          style={{
            backgroundColor: "#2563eb",
            padding: 14,
            borderRadius: 12,
            marginTop: 20,
          }}
        >
          <Text style={{ color: "#fff", textAlign: "center", fontWeight: "900" }}>
            📤 Export Evidence Package
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.back()}
          style={{
            backgroundColor: "#374151",
            padding: 14,
            borderRadius: 12,
            marginTop: 14,
          }}
        >
          <Text style={{ color: "#fff", textAlign: "center", fontWeight: "900" }}>
            ← Back
          </Text>
        </Pressable>
      </ScrollView>
    );
  }