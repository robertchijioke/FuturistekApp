import { Text, View } from "react-native";

const responseStages = [
  "ALERT_CREATED",
  "STAFF_ASSIGNED",
  "EN_ROUTE",
  "AT_SCENE",
  "ASSESSMENT",
  "AMBULANCE_REQUESTED",
  "TRANSPORT",
  "RESOLVED",
];

const stageDetails: Record<string, { title: string; icon: string; color: string }> = {
  ALERT_CREATED: { title: "Alert Created", icon: "🚨", color: "#a855f7" },
  STAFF_ASSIGNED: { title: "Staff Assigned", icon: "👩", color: "#60a5fa" },
  EN_ROUTE: { title: "En Route", icon: "🚶", color: "#f59e0b" },
  AT_SCENE: { title: "At Scene", icon: "📍", color: "#22c55e" },
  ASSESSMENT: { title: "Assessment", icon: "🩺", color: "#0ea5e9" },
  AMBULANCE_REQUESTED: { title: "Ambulance Requested", icon: "🚑", color: "#ef4444" },
  TRANSPORT: { title: "Resident Transport", icon: "🏥", color: "#ec4899" },
  RESOLVED: { title: "Incident Resolved", icon: "✅", color: "#22c55e" },
};

export default function ResponseProgress({ currentStage }: { currentStage: string }) {
  const currentIndex = responseStages.indexOf(currentStage);

  return (
    <View
      style={{
        backgroundColor: "#081826",
        borderRadius: 14,
        padding: 12,
        marginTop: 12,
        borderWidth: 1,
        borderColor: "#7c3aed",
      }}
    >
      <Text style={{ color: "#fff", fontSize: 17, fontWeight: "900", marginBottom: 10 }}>
        📍 Response Progress
      </Text>

      {responseStages.map((stage, index) => {
        const detail = stageDetails[stage];
        const completed = index < currentIndex;
        const current = index === currentIndex;

        return (
         <Text
            key={stage}
            style={{
              color: completed
                ? detail.color
                : current
                ? "#ffffff"
                : "#94a3b8",
              fontSize: 14,
              fontWeight: "800",
              marginTop: 6,
            }}
          >
            {detail.icon} {detail.title}{" "}
            {completed ? "✅" : current ? "⏳" : "○"}
          </Text>
        );
      })}
    </View>
  );
}