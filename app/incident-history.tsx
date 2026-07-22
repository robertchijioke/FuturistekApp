import { useRouter } from "expo-router";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text } from "react-native";
import { auth, db } from "../lib/firebase";

export default function IncidentHistoryScreen() {
  const router = useRouter();
  const [captures, setCaptures] = useState<any[]>([]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const q = query(
      collection(db, "users", user.uid, "securityCaptures"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setCaptures(data);
    });

    return unsub;
  }, []);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#001b2e", padding: 24 }}>
      <Text style={{ color: "#fff", fontSize: 38, fontWeight: "900", marginBottom: 20 }}>
        📁 Incident History
      </Text>

      {captures.map((item) => (
        <Pressable
          key={item.id}
          onPress={() =>
            router.push({
              pathname: "/snapshot-viewer",
              params: {
                snapshotId: item.id,
                alertId: item.id,
              },
            })
          }
          style={{
            backgroundColor: "#0f4168",
            padding: 20,
            borderRadius: 22,
            marginBottom: 16,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 24, fontWeight: "800" }}>
            {item.threatLevel === "HIGH" ? "🔴" : item.threatLevel === "LOW" ? "🟢" : "🟡"}{" "}
            {item.cameraName || item.room || "Unknown Camera"}
          </Text>

          <Text style={{ color: "#c7e6ff", fontSize: 18, marginTop: 8 }}>
            {item.aiClassification || item.type || "Motion Detected"}
          </Text>

          <Text style={{ color: "#9ecfff", fontSize: 16, marginTop: 8 }}>
            {item.createdAt?.toDate
              ? item.createdAt.toDate().toLocaleString()
              : "Just now"}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}