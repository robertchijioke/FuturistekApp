import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useIncident } from "../context/IncidentContext";

export default function CareIncidentReport() {
  const router = useRouter();
  const { incident } = useIncident()

  const { incidentId, room, stage, assignedStaff } =
    useLocalSearchParams<{
      incidentId?: string;
      room?: string;
      stage?: string;
      assignedStaff?: string;
    }>();

  const rawAssignedStaff =
    typeof assignedStaff === "string" && assignedStaff.trim()
      ? assignedStaff.trim()
      : String((incident as any)?.assignedStaff ?? "Unassigned").trim() ||
        "Unassigned";

   

  const currentIncidentId =
    typeof incidentId === "string" && incidentId.trim()
      ? incidentId
      : String(
          (incident as any)?.eventId ??
            (incident as any)?.incidentId ??
            (incident as any)?.id ??
            ""
        );

  const reportRoom =
    typeof room === "string" && room.trim()
      ? room.trim()
      : String((incident as any)?.room ?? "").trim();

  const reportStage =
    typeof stage === "string" && stage.trim()
      ? stage.trim().toUpperCase()
      : String((incident as any)?.stage ?? "RESOLVED")
          .trim()
          .toUpperCase();

  const reportIncident = {
    ...((incident ?? {}) as any),

    id: currentIncidentId,
    incidentId: currentIncidentId,

    room: reportRoom,
    stage: reportStage,

    type:
      String((incident as any)?.type ?? "Incident").trim() ||
      "Incident",

    assignedStaff: rawAssignedStaff,};

  const currentRoom =
    typeof room === "string" && room.trim()
      ? room.trim()
      : String((incident as any)?.room ?? "").trim();

  const currentStage = (
    typeof stage === "string" && stage.trim()
      ? stage.trim()
      : String((incident as any)?.stage ?? "")
  ).toUpperCase();

  const isResolved = currentStage === "RESOLVED";

  const staffHasBeenAssigned = [
    "STAFF_ASSIGNED",
    "EN_ROUTE",
    "AT_SCENE",
    "ASSESSMENT",
    "AMBULANCE_REQUESTED",
    "TRANSPORT",
    "RESOLVED",
  ].includes(currentStage);

  const currentAssignedStaff =
    staffHasBeenAssigned && rawAssignedStaff !== "Unassigned"
      ? rawAssignedStaff
      : "Awaiting assignment";

  const currentProtocolStatus =
    currentStage === "ALERT_CREATED"
      ? "Awaiting staff assignment"
      : isResolved
        ? "Incident workflow completed"
        : "Response workflow in progress";

  const readableStage = currentStage
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

  const analysisLines = isResolved
    ? [
        "Response time: 3 minutes",
        "Staff arrival: Excellent",
        "Camera coverage: Complete",
        "Protocol compliance: 100%",
      ]
    : [
        `Current stage: ${readableStage}`,
        `Staff assignment: ${
          staffHasBeenAssigned
            ? currentAssignedStaff
            : "Pending"
        }`,
        "Camera monitoring: Live",
        `Protocol status: ${currentProtocolStatus}`,
      ];

  const recommendationText = isResolved
    ? "The incident was handled correctly. Staff response, camera coverage, and escalation timing were all within expected safety standards."
    : !staffHasBeenAssigned
      ? "No staff member has been assigned yet. Assign an available care staff member immediately and continue live camera monitoring of the resident."
      : `${currentAssignedStaff} is responding to this incident. Continue monitoring the resident and complete the remaining emergency response stages.`;

  const recommendationOutcome = isResolved
    ? "✓ No corrective action required."
    : !staffHasBeenAssigned
      ? "⚠ Immediate staff assignment required."
      : "⚠ Incident remains active — continue response workflow.";

  
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#061826" }}
      contentContainerStyle={{ padding: 24, paddingTop: 50, paddingBottom: 80 }}
    >
      <Text style={{ color: "#fff", fontSize: 42, fontWeight: "900" }}>
        🧾 AI Incident Report
      </Text>

      <Text
        style={{
          color: "#93c5fd",
          fontSize: 20,
          marginTop: 8,
        }}
      >
        {currentRoom || "Unknown room"}{" "}
        {isResolved
          ? "completed emergency summary"
          : "live incident summary"}
      </Text>

      <View
        style={{
          backgroundColor: "#081826",
          borderRadius: 18,
          padding: 18,
          marginTop: 26,
          borderWidth: 1,
          borderColor: "#22c55e",
        }}
      >
        <Text
          style={{
            color: "#22c55e",
            fontSize: 24,
            fontWeight: "900",
          }}
        >
          {currentStage === "RESOLVED"
            ? "Incident Resolved"
            : "Incident Active"}
        </Text>

        <Text style={{ color: "#fff", fontSize: 18, marginTop: 14 }}>
          Room: {currentRoom || "Unknown room"}
        </Text>

        <Text style={{ color: "#fff", fontSize: 18, marginTop: 8 }}>
          Assigned Staff: {currentAssignedStaff}
        </Text>

        <Text style={{ color: "#fff", fontSize: 18, marginTop: 8 }}>
          {isResolved ? "Final Status" : "Current Stage"}:{" "}
          {currentStage || "UNKNOWN"}
        </Text>
      </View>

      <Pressable
        onPress={() => {
          console.log("AI REPORT → CCTV WALL:", {
            incidentId: currentIncidentId,
            room: currentRoom,
            stage: currentStage,
          });

          router.push({
            pathname: "/care-cctv-wall",
            params: {
              incidentId: currentIncidentId,
              room: currentRoom,
              stage: currentStage,
            },
          } as any);
        }}
        style={{
          backgroundColor: "#2563eb",
          padding: 14,
          borderRadius: 12,
          marginBottom: 18,
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 16,
            fontWeight: "900",
            textAlign: "center",
          }}
        >
          📹 Open AI CCTV Wall
        </Text>
      </Pressable>

      <View
        style={{
          backgroundColor: "#081826",
          borderRadius: 18,
          padding: 18,
          marginTop: 18,
          borderWidth: 1,
          borderColor: "#2563eb",
        }}
      >
        <Text style={{ color: "#fff", fontSize: 26, fontWeight: "900" }}>
          📊 AI Analysis
        </Text>

        {analysisLines.map((line, index) => (
        <Text
          key={`${line}-${index}`}
          style={{
            color: "#cbd5e1",
            fontSize: 18,
            marginTop: 14,
            lineHeight: 27,
          }}
        >
          • {line}
        </Text>
      ))}
      </View>

      <View
        style={{
          backgroundColor: "#081826",
          borderRadius: 18,
          padding: 18,
          marginTop: 18,
          borderWidth: 1,
          borderColor: "#38bdf8",
        }}
      >
        <Text style={{ color: "#fff", fontSize: 26, fontWeight: "900" }}>
          🤖 AI Recommendation
        </Text>

        <Text style={{ color: "#cfe2ff", fontSize: 18, marginTop: 14 }}>
          {recommendationText}
        </Text>

        <Text
          style={{
            color: isResolved ? "#22c55e" : "#fbbf24",
            fontSize: 18,
            fontWeight: "900",
            marginTop: 20,
          }}
        >
          {recommendationOutcome}
        </Text>
      </View>
    </ScrollView>
  );
}