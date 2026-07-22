import { useRouter } from "expo-router";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { db } from "../lib/firebase";


  export default function AICommandCenter() {
    const router = useRouter();

    const [latestSnapshots, setLatestSnapshots] = useState<Record<string, string>>({});
    const [latestCapture, setLatestCapture] = useState<any>(null);
    const [activeIncidentCount, setActiveIncidentCount] = useState(0);
    const [activeIncidents, setActiveIncidents] = useState<any[]>([]);
    const [residentRooms, setResidentRooms] = useState<string[]>([]);

    useEffect(() => {
      const q = query(
        collection(db, "securityCaptures"),
        orderBy("createdAt", "desc")
      );

      const unsub = onSnapshot(q, (snapshot) => {
        const latestByRoom: Record<string, string> = {};

        snapshot.docs.forEach((doc) => {
          const data = doc.data();

          const room = data.room;
          const image = data.image || data.thumbnail;

          if (room && image && !latestByRoom[room]) {
            latestByRoom[room] = image;
          }
        });

        setLatestSnapshots(latestByRoom);

        const newestDoc = snapshot.docs[0];

        if (newestDoc) {
          setLatestCapture({
            id: newestDoc.id,
            ...newestDoc.data(),
          });

      const activeCount = snapshot.docs.filter((doc) => {
        const data = doc.data();
        return data.status !== "CLEARED" && data.status !== "cleared";
      }).length;

      setActiveIncidentCount(activeCount);
        }
      });

      return unsub;
    }, []);


    useEffect(() => {
      const unsubscribe = onSnapshot(
        collection(db, "residents"),
        (snapshot) => {
          const rooms = snapshot.docs
            .map((document) =>
              String(document.data()?.room ?? "").trim()
            )
            .filter(Boolean)
            .filter(
              (room, index, allRooms) =>
                allRooms.indexOf(room) === index
            )
            .sort((a, b) =>
              a.localeCompare(b, undefined, { numeric: true })
            );

          setResidentRooms(rooms);
        },
        (error) => {
          console.error(
            "Could not load AI Command Center rooms:",
            error
          );
          setResidentRooms([]);
        }
      );

      return unsubscribe;
    }, []);

    const latestActiveIncident = activeIncidents[0] ?? null;

    const commandCams = residentRooms.map((room) => {
      const isActiveRoom =
        Boolean(latestActiveIncident) &&
        String(latestActiveIncident?.room ?? "").trim() === room;

      return {
        room,
        status: isActiveRoom ? "ALERT" : "LIVE",
        color: isActiveRoom ? "#ef4444" : "#22c55e",
      };
    });

    useEffect(() => {
      const q = query(collection(db, "activeIncidents"), orderBy("createdAt", "desc"));

      const unsub = onSnapshot(q, (snapshot) => {
        const incidents = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setActiveIncidents(incidents);
      });

      return unsub;
    }, []);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#061826" }}
      contentContainerStyle={{ padding: 24, paddingBottom: 70, paddingTop: 40 }}
    >
      <Text style={{ color: "#fff", fontSize: 42, fontWeight: "800", marginBottom: 8 }}>
        🧠 AI Command Center
      </Text>

      <Text style={{ color: "#9fb7d8", fontSize: 20, marginBottom: 24 }}>
        Futuristek security intelligence
      </Text>

      <View
        style={{
          backgroundColor: "#0f2d49",
          borderRadius: 20,
          padding: 20,
          marginBottom: 18,
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 28,
            fontWeight: "700",
            marginBottom: 16,
          }}
        >
          📹 Live Command Wall
        </Text>

        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "space-between",
          }}
        >
          {commandCams.map((cam) => (
            <Pressable
              key={cam.room}
             onPress={() =>
                cam.room === "Living Room"
                  ? router.push("/incident-playback" as any)
                  : router.push({
                      pathname: "/room-dashboard",
                      params: { room: cam.room },
                    } as any)
              }
              style={{
                width: "48%",
                backgroundColor: "#081826",
                borderRadius: 16,
                borderWidth: 1,
                borderColor: cam.color,
                padding: 8,
                marginBottom: 14,
                minHeight: 145,
                justifyContent: "space-between",
              }}
            >
              <View
                style={{
                  height: 58,
                  borderRadius: 12,
                  backgroundColor: "#020f1c",
                  borderWidth: 1,
                  borderColor: cam.color,
                  justifyContent: "center",
                  alignItems: "center",
                  marginBottom: 10,
                  overflow: "hidden",
                }}
              >
                {latestSnapshots[cam.room] ? (
                  <Image
                    source={{ uri: latestSnapshots[cam.room] }}
                    style={{
                      width: "100%",
                      height: "100%",
                    }}
                    resizeMode="cover"
                  />
                ) : (
                  <>
                    <Text style={{ fontSize: 32 }}>📷</Text>
                    <Text style={{ color: "#6b93c4", fontSize: 11, marginTop: 2 }}>
                      {latestSnapshots[cam.room] ? "" : "No snapshot yet"}
                    </Text>
                  </>
                )}
              </View>

              <Text
                style={{
                  color: "#fff",
                  fontSize: 18,
                  fontWeight: "800",
                  textAlign: "center",
                }}
              >
                {cam.room}
              </Text>

              <Text
                style={{
                  color: "#9fb7d8",
                  textAlign: "center",
                  fontSize: 14,
                  marginTop: 6,
                }}
              >
                {latestActiveIncident &&
                String(latestActiveIncident?.room ?? "").trim() === cam.room
                  ? latestActiveIncident?.aiClassification || "Motion detected"
                  : "No activity"}
              </Text>

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "center",
                  alignItems: "center",
                  marginTop: 8,
                }}
              >
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: cam.color,
                    marginRight: 6,
                  }}
                />

                <Text
                  style={{
                    color: cam.color,
                    fontWeight: "800",
                    fontSize: 16,
                  }}
                >
                  {cam.status}
                </Text>
              </View>

               <Text
                  style={{
                    color: "#6b93c4",
                    textAlign: "center",
                    fontSize: 12,
                    marginTop: 10,
                  }}
                >
                  {latestActiveIncident &&
                  String(latestActiveIncident?.room ?? "").trim() === cam.room
                    ? "Updated now"
                    : "Standing by"}
                </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={{ backgroundColor: "#0f2d49", borderRadius: 20, padding: 20, marginBottom: 18 }}>
        <Text style={{ color: "#fff", fontSize: 28, fontWeight: "700", marginBottom: 14 }}>
          🏠 Property Status
        </Text>

        <Text style={{ color: "#22c55e", fontSize: 24, fontWeight: "800" }}>
          {activeIncidents.length > 0 ? "🔴 Property Under Investigation" : "🟢 Property Secure"}
        </Text>

        <Text style={{ color: "#cfe2ff", fontSize: 18, marginTop: 8 }}>
          {activeIncidents.length} Active Incident{activeIncidents.length === 1 ? "" : "s"}
        </Text>

        <Text style={{ color: "#cfe2ff", fontSize: 18, marginTop: 10 }}>
          AI is watching cameras, sensors, lights, doors, and recent activity.
        </Text>
      </View>

      <View style={{ backgroundColor: "#0f2d49", borderRadius: 20, padding: 20, marginBottom: 18 }}>
        <Text style={{ color: "#fff", fontSize: 28, fontWeight: "700", marginBottom: 14 }}>
          🚨 Priority Alert
        </Text>
        <Text style={{ color: "#ff4d4d", fontSize: 22, fontWeight: "800" }}>
          {latestActiveIncident?.room
            ? `${latestActiveIncident.room} requires review`
            : "No active priority alert"}
        </Text>
        <Text style={{ color: "#cfe2ff", fontSize: 18, marginTop: 10 }}>
          Unknown movement was detected. Incident playback and evidence are available.
        </Text>

       <Pressable
          onPress={() => router.push("/incident-playback" as any)}
          style={{
            backgroundColor: "#2563eb",
            padding: 16,
            borderRadius: 14,
            marginTop: 16,
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontSize: 18,
              fontWeight: "800",
              textAlign: "center",
            }}
          >
            🎬 Open Incident Playback
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {
            const emergencyRoom = String(
              latestActiveIncident?.room ?? ""
            ).trim();

            if (!latestActiveIncident || !emergencyRoom) {
              alert("No active incident is available.");
              return;
            }

            router.push({
              pathname: "/emergency-alert",
              params: {
                room: emergencyRoom,
                type:
                  String(latestActiveIncident?.type ?? "").trim() ||
                  "Incident",
                severity:
                  String(latestActiveIncident?.severity ?? "").trim() ||
                  "CRITICAL",
              },
            } as any);
          }}
          style={{
            backgroundColor: "#dc2626",
            padding: 16,
            borderRadius: 14,
            marginTop: 12,
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontSize: 18,
              fontWeight: "800",
              textAlign: "center",
            }}
          >
            🚨 Emergency Escalation
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.push("/care-command-center" as any)}
          style={{
            backgroundColor: "#7c3aed",
            padding: 16,
            borderRadius: 14,
            marginTop: 12,
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontSize: 18,
              fontWeight: "800",
              textAlign: "center",
            }}
          >
            🏥 Care Command Center
          </Text>
        </Pressable>
      </View>

      <View style={{ backgroundColor: "#0f2d49", borderRadius: 20, padding: 20, marginBottom: 18 }}>
        <Text style={{ color: "#fff", fontSize: 28, fontWeight: "700", marginBottom: 14 }}>
          🤖 Latest AI Decision
        </Text>
        <Text style={{ color: "#cfe2ff", fontSize: 18 }}>
          {latestActiveIncident?.aiClassification
            ? latestActiveIncident.aiClassification
            : latestCapture?.aiClassification
              ? latestCapture.aiClassification
              : "Motion was detected in the Living Room. AI classified the event as MEDIUM risk because no immediate danger was confirmed."}
        </Text>
      </View>

      <View style={{ backgroundColor: "#0f2d49", borderRadius: 20, padding: 20, marginBottom: 18 }}>
        <Text style={{ color: "#fff", fontSize: 28, fontWeight: "700", marginBottom: 14 }}>
          📊 24h Security Trends
        </Text>
        <Text style={{ color: "#cfe2ff", fontSize: 18 }}>Motion events: 6</Text>
        <Text style={{ color: "#cfe2ff", fontSize: 18 }}>Snapshots captured: 12</Text>
        <Text style={{ color: "#cfe2ff", fontSize: 18 }}>High risk events: 1</Text>
        <Text style={{ color: "#cfe2ff", fontSize: 18 }}>AI confidence average: 94%</Text>
      </View>

      <Pressable
        onPress={() => router.back()}
        style={{
          backgroundColor: "#2563eb",
          padding: 18,
          borderRadius: 16,
          marginTop: 8,
        }}
      >
        <Text style={{ color: "#fff", fontSize: 22, fontWeight: "800", textAlign: "center" }}>
          ← Back
        </Text>
      </Pressable>
    </ScrollView>
  );
}