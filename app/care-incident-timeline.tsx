import { useLocalSearchParams, useRouter } from "expo-router";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useIncident } from "../context/IncidentContext";
import { db } from "../lib/firebase";

export default function CareIncidentTimeline() {
  const router = useRouter();
  const { incident } = useIncident();

  const [timeline, setTimeline] = useState<any[]>([]);

  const { stage, room, incidentId } = useLocalSearchParams<{
    stage?: string;
    room?: string;
    incidentId?: string;
  }>();
  const currentStage =
    typeof stage === "string" ? stage : "ALERT_CREATED";

  const timelineRoom =
    typeof room === "string" && room.trim().length > 0
      ? room.trim()
      : String(incident?.room ?? "").trim();

    const currentIncidentId =
      typeof incidentId === "string"
        ? incidentId.trim()
        : "";

    useEffect(() => {
      console.log("TIMELINE PARAMS:", {
        incidentId: currentIncidentId || null,
        room: timelineRoom || null,
        stage,
      });

      if (!currentIncidentId || !timelineRoom) {
        console.warn(
          "Timeline cannot load without a valid incident ID and room.",
          {
            incidentId: currentIncidentId || null,
            room: timelineRoom || null,
          }
        );

        setTimeline([]);
        return;
      }

      const timelineQuery = query(
        collection(db, "careTimeline"),
        where("incidentId", "==", currentIncidentId)
      );

      const unsubscribe = onSnapshot(
        timelineQuery,
        (snapshot) => {
          const events = snapshot.docs
            .map((eventDocument) => {
              const data = eventDocument.data();

              const createdAtDate =
                typeof data.createdAt?.toDate === "function"
                  ? data.createdAt.toDate()
                  : new Date(0);

              return {
                id: eventDocument.id,
                room: String(data.room ?? timelineRoom).trim(),
                icon: data.icon ?? "📍",
                title: data.message ?? "Care event",
                note: data.note ?? "",
                status: data.type ?? "",
                createdAtDate,
                time:
                  createdAtDate.getTime() > 0
                    ? createdAtDate.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Just now",
              };
            })
            .sort(
              (a, b) =>
                b.createdAtDate.getTime() -
                a.createdAtDate.getTime()
            );

          setTimeline(events);
        },
        (error) => {
          console.error("Could not load care timeline:", error);
          setTimeline([]);
        }
      );

      return unsubscribe;
    }, [currentIncidentId, timelineRoom]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#061826" }}
      contentContainerStyle={{ padding: 24, paddingTop: 40, paddingBottom: 80 }}
    >
      <Text style={{ color: "#fff", fontSize: 42, fontWeight: "900", marginTop: 30 }}>
        🕒 Incident Timeline
      </Text>

      <Text style={{ color: "#93c5fd", fontSize: 20, marginTop: 8 }}>
        {timelineRoom} emergency event log
      </Text>

      <Pressable
        onPress={() => {
          if (!currentIncidentId || !timelineRoom) {
            console.warn(
              "Camera playback cannot open without a valid incident ID and room.",
              {
                incidentId: currentIncidentId || null,
                room: timelineRoom || null,
                stage: currentStage,
              }
            );

            return;
          }

          console.log("TIMELINE → CAMERA:", {
            incidentId: currentIncidentId,
            room: timelineRoom,
            stage: currentStage,
          });

          router.push({
            pathname: "/care-camera-playback",
            params: {
              incidentId: currentIncidentId,
              room: timelineRoom,
              stage: currentStage,
            },
          } as any);
        }}
        style={{
          backgroundColor: "#0891b2",
          padding: 14,
          borderRadius: 12,
          marginTop: 18,
        }}
      >
        <Text
          style={{
            color: "#fff",
            textAlign: "center",
            fontSize: 16,
            fontWeight: "800",
          }}
        >
          ▶ Review Camera Playback
        </Text>
      </Pressable>

      <View style={{ marginTop: 24 }}>
        {timeline
          .filter((item: any) => {
            const order = [
              "critical",
              "assigned",
              "enroute",
              "scene",
              "assessment",
              "ambulance",
              "transport",
              "resolved",
            ];

            const stageMap: Record<string, string> = {
              ALERT_CREATED: "critical",
              STAFF_ASSIGNED: "assigned",
              EN_ROUTE: "enroute",
              AT_SCENE: "scene",
              ASSESSMENT: "assessment",
              AMBULANCE_REQUESTED: "ambulance",
              TRANSPORT: "transport",
              RESOLVED: "resolved",
            };

            const currentOrder = order.indexOf(stageMap[currentStage]);
            const itemOrder = order.indexOf(item.status);

            return itemOrder <= currentOrder;
          })
          .map((item: any, index: number) => (
          <View
            key={index}
            style={{
              backgroundColor: "#081826",
              borderRadius: 16,
              padding: 16,
              marginBottom: 14,
              borderWidth: 1,
              borderColor: "#2563eb",
            }}
          >
            <Text style={{ color: "#fbbf24", fontSize: 16, fontWeight: "800" }}>
              {item.time}
            </Text>

            <Text style={{ color: "#fff", fontSize: 22, fontWeight: "900", marginTop: 6 }}>
              {item.icon} {item.title}
            </Text>

            {item.note &&
            item.note.trim() !== "" &&
            item.note !== item.title ? (
              <Text
                style={{
                  color: "#cfe2ff",
                  fontSize: 16,
                  marginTop: 6,
                }}
              >
                {item.note}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}