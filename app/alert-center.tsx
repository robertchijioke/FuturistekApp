  import { useRouter } from "expo-router";
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { auth, db } from "../lib/firebase";

  export default function AlertCenterScreen() {
    const router = useRouter();

    const [alerts, setAlerts] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
    const user = auth.currentUser;

    if (!user) {
      console.log("No user found for Alert Center");
      return;
    }

    const q = query(
      collection(db, "users", user.uid, "securityAlerts"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setUnreadCount(
        snapshot.docs.filter(doc => !doc.data().read).length
      );

      setAlerts(list);
    });

    return unsubscribe;
  }, []);

  const markAllAsRead = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      await Promise.all(
        alerts
          .filter((alert) => !alert.read)
          .map((alert) =>
            updateDoc(
              doc(
                db,
                "users",
                user.uid,
                "securityAlerts",
                alert.id
              ),
              {
                read: true,
              }
            )
          )
      );
    } catch (err) {
      console.log(err);
    }
  };

  const deleteAlert = async (alertId: string) => {
  const user = auth.currentUser;
    if (!user) return;

    await deleteDoc(
      doc(db, "users", user.uid, "securityAlerts", alertId)
    );
  };

  const getThreatLabel = (level?: string, type?: string) => {
    if (level === "HIGH") return "🔴 HIGH RISK";
    if (level === "MEDIUM") return "🟠 MEDIUM RISK";
    if (level === "LOW") return "🟢 LOW RISK";

    if (type === "Unknown Motion") return "🔴 HIGH RISK";
    if (type === "Person Detected") return "🟠 MEDIUM RISK";
    if (type === "Pet Detected") return "🟢 LOW RISK";

    return "⚪ UNKNOWN RISK";
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>🚨 Alert Center</Text>
      <Text style={styles.subtitle}>Monitor alerts, cameras and security events</Text>

      <Pressable
        style={styles.markAllButton}
        onPress={markAllAsRead}
      >
        <Text style={styles.markAllButtonText}>
          ✓ Mark All as Read
        </Text>
      </Pressable>

      <View style={styles.summaryCard}>
        <Text style={styles.cardTitle}>🟢 System Status</Text>
        <Text style={styles.cardText}>All security services are running</Text>
        <Text style={styles.cardText}>Active Cameras: 9</Text>
        <Text style={styles.cardText}>Unread Alerts: {unreadCount}</Text>
      </View>

     <View style={styles.card}>
        <Text style={styles.cardTitle}>🚨 Recent Alerts</Text>

        {alerts.length === 0 ? (
          <Text style={styles.emptyText}>No active alerts.</Text>
        ) : (
          alerts.map((alert: any) => (
           <View
              key={alert.id}
              style={[
                styles.alertItem,
                alert.read && { opacity: 1 },
              ]}
            >

              {!alert.read && (
                <View style={styles.newBadge}>
                  <Text style={styles.newBadgeText}>NEW</Text>
                </View>
              )}

              <Text style={styles.threatBadge}>
                {getThreatLabel(alert.threatLevel, alert.type)}
              </Text>

             <Text
                style={[
                  styles.alertTitle,
                  alert.read && { opacity: 0.45 },
                ]}
              >
                {alert.message?.split(" ")[0] || "🤖"} {alert.type || "Alert"}
              </Text>

              {alert.confidence && (
                <Text
                  style={{
                    color: "#22C55E",
                    fontWeight: "700",
                    fontSize: 13,
                    marginTop: 4,
                    marginBottom: 4,
                  }}
                >
                  🧠 AI Confidence: {alert.confidence}%
                </Text>
              )}

              <Text style={[styles.alertMessage, alert.read && { opacity: 0.45 }]}>
                {alert.type === "Person Detected"
                  ? `A person was detected in ${alert.room || alert.cameraName || "Camera"}.`
                  : alert.type === "Package Delivered"
                  ? `A package was detected at ${alert.room || alert.cameraName || "Camera"}.`
                  : alert.type === "Pet Detected"
                  ? `A pet was detected in ${alert.room || alert.cameraName || "Camera"}.`
                  : alert.type === "Unknown Motion"
                  ? `Motion was detected in ${alert.room || alert.cameraName || "Camera"}.`
                  : alert.message || "No message"}
              </Text>

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: 8,
                }}
              >
                <Text style={[styles.alertMeta, alert.read && { opacity: 0.45 }]}>
                  📹 {alert.cameraName || alert.room || "Camera"}
                </Text>

                <Pressable
                  onPress={() => {
                    if (alert.snapshotId) {
                      router.push(
                        `/snapshot-viewer?snapshotId=${alert.snapshotId}&alertId=${alert.id}` as any
                      );
                    }
                  }}
                  hitSlop={12}
                >
                  <Text
                    style={{
                      color: "#8FD3FF",
                      fontSize: 28,
                      fontWeight: "700",
                    }}
                  >
                    ›
                  </Text>
                </Pressable>
              </View>

              <Pressable
                style={styles.deleteButton}
                onPress={(e) => {
                  e.stopPropagation();

                  Alert.alert(
                    "Delete Alert?",
                    "This alert will be removed permanently.",
                    [
                      {
                        text: "Cancel",
                        style: "cancel",
                      },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: () => deleteAlert(alert.id),
                      },
                    ]
                  );
                }}
              >
                <Text style={styles.deleteButtonText}>🗑 Delete Alert</Text>
              </Pressable>
            </View>
          ))
        )}
      </View>

      <Pressable style={styles.button} onPress={() => router.back()}>
        <Text style={styles.buttonText}>← Back</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#001A2E",
  },
  content: {
    padding: 24,
    paddingBottom: 60,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 44,
    fontWeight: "900",
    marginTop: 40,
  },
  subtitle: {
    color: "#B7C6D8",
    fontSize: 19,
    marginTop: 8,
    marginBottom: 30,
  },
  summaryCard: {
    backgroundColor: "#0B3158",
    padding: 24,
    borderRadius: 24,
    marginBottom: 22,
  },
  card: {
    backgroundColor: "#0B3158",
    padding: 24,
    borderRadius: 24,
    marginBottom: 22,
  },
  cardTitle: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "900",
    marginBottom: 14,
  },
  cardText: {
    color: "#C8D3E0",
    fontSize: 20,
    marginBottom: 8,
  },
  emptyText: {
    color: "#8FE3FF",
    fontSize: 20,
  },
  button: {
    backgroundColor: "#3B82F6",
    padding: 18,
    borderRadius: 18,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
  },

  alertItem: {
  backgroundColor: "#082A4A",
  padding: 16,
  borderRadius: 16,
  marginTop: 14,
},

alertTitle: {
  color: "#FFFFFF",
  fontSize: 20,
  fontWeight: "800",
},

alertMessage: {
  color: "#C8D6E5",
  fontSize: 17,
  marginTop: 6,
},

alertMeta: {
  color: "#8FB3D9",
  fontSize: 15,
  marginTop: 8,
},

newBadge: {
  alignSelf: "flex-start",
  backgroundColor: "#EF4444",
  paddingHorizontal: 8,
  paddingVertical: 4,
  borderRadius: 12,
  marginBottom: 8,
},

newBadgeText: {
  color: "#fff",
  fontSize: 11,
  fontWeight: "800",
},

markAllButton: {
  backgroundColor: "#10B981",
  padding: 14,
  borderRadius: 14,
  alignItems: "center",
  marginBottom: 20,
},

markAllButtonText: {
  color: "#fff",
  fontWeight: "800",
  fontSize: 16,
},

deleteButton: {
  marginTop: 14,
  backgroundColor: "#7F1D1D",
  paddingVertical: 10,
  paddingHorizontal: 14,
  borderRadius: 12,
  alignSelf: "flex-start",
},

deleteButtonText: {
  color: "#FCA5A5",
  fontWeight: "800",
  fontSize: 13,
},

threatBadge: {
  color: "#ffffff",
  fontSize: 14,
  fontWeight: "900",
  marginBottom: 10,
},
});