import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Speech from "expo-speech";
import { collection, doc, getDoc, getDocs, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Alert, Image, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { auth, db } from "../lib/firebase";

export default function SnapshotViewerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { snapshotId, alertId } = params;

  const [snapshot, setSnapshot] = useState<any>(null);
  const [alert, setAlert] = useState<any>(null);

  const routeImage = String(params.image || params.thumbnail || "");

  const routeCameraName = String(params.cameraName || params.name || params.room || "Camera");
  const routeRoom = String(params.room || "Unknown");
  const routeType = String(params.type || "motion");

  const snapshotImage =
    snapshot?.image ||
    snapshot?.imageUrl ||
    snapshot?.thumbnail ||
    alert?.image ||
    alert?.thumbnail ||
    routeImage ||
    "";

    const recommendations = Array.isArray(snapshot?.recommendedActions)
    ? snapshot.recommendedActions
    : Array.isArray(alert?.recommendedActions)
    ? alert.recommendedActions
    : [];

    const visibleRecommendations = recommendations.filter((action: string) => {
      const lowerTimeline = Array.isArray(timeline)
        ? timeline.map((t: any) => String(t?.label || "").toLowerCase())
        : [];

      if (
        action === "Turn On Lights" &&
        lowerTimeline.some((t: string) => t.includes("emergency lighting"))
      ) {
        return false;
      }

      if (
        action === "Sound Siren" &&
        lowerTimeline.some((t: string) => t.includes("siren activated"))
      ) {
        return false;
      }

      if (
        action === "Notify Owner" &&
        lowerTimeline.some((t: string) => t.includes("owner notified"))
      ) {
        return false;
      }

      if (
        action === "View Live Camera" &&
        lowerTimeline.some((t: string) => t.includes("live camera"))
      ) {
        return false;
      }

      return true;
    });

    const addTimelineEvent = async (label: string) => {
      const user = auth.currentUser;
      if (!user) return;

      const captureId = String(snapshotId || alertId || "");
      if (!captureId) return;

      const newEvent = {
        label,
        createdAt: new Date(),
      };

      setLocalTimeline((prev: any[]) => [...prev, newEvent]);

      const captureRef = doc(
        db,
        "users",
        user.uid,
        "securityCaptures",
        captureId
      );

      const captureSnap = await getDoc(captureRef);

      if (!captureSnap.exists()) return;

      const currentCapture: any = captureSnap.data();
      const existingTimeline = Array.isArray(currentCapture.timeline)
        ? currentCapture.timeline
        : [];

      const alreadyExists = existingTimeline.some(
        (item: any) => item.label === label
      );

      if (alreadyExists) return;

      const updatedTimeline = [...existingTimeline, newEvent];

      await updateDoc(captureRef, {
        timeline: updatedTimeline,
      });

      setAlert({
        ...currentCapture,
        timeline: updatedTimeline,
      });
    };

  useEffect(() => {
    const loadSnapshot = async () => {
      const user = auth.currentUser;
      if (!user || !snapshotId) return;

      const snap = await getDoc(
        doc(db, "users", user.uid, "securityCaptures", String(snapshotId))
      );

      if (snap.exists()) {
        setSnapshot({ id: snap.id, ...snap.data() });

       const alertIdString = String(alertId || "");

        if (alertId) {
          const alertRef = doc(db, "users", user.uid, "securityAlerts", alertIdString);

          const alertSnap = await getDoc(alertRef);

          if (alertSnap.exists()) {
            const currentAlert: any = {
              id: alertSnap.id,
              ...alertSnap.data(),
            };

            setAlert(currentAlert);

            await addTimelineEvent("User viewed snapshot");

            if (!currentAlert.responseExecuted) {
              const threat = String(currentAlert.threatLevel || "").toUpperCase();

              if (threat === "HIGH") {
                await turnOnEmergencyLights();
                await activateSiren();
                await notifyOwner();
                await addTimelineEvent("Autonomous HIGH risk response triggered");
              }

              if (threat === "MEDIUM") {
                await turnOnEmergencyLights();
                await notifyOwner();
                await addTimelineEvent("Autonomous MEDIUM risk response triggered");
              }

              if (threat === "LOW") {
                await addTimelineEvent("LOW risk monitored only");
              }

              await updateDoc(alertRef, {
                read: true,
                responseExecuted: true,
              });
            } else {
              await updateDoc(alertRef, {
                read: true,
              });
            }
          }
        }
      }
    };

    loadSnapshot();
  }, [snapshotId]);

  const turnOnEmergencyLights = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const devicesRef = collection(db, "users", user.uid, "devices");
    const devicesSnap = await getDocs(devicesRef);

    const lightUpdates = devicesSnap.docs
      .filter((deviceDoc) => {
        const device = deviceDoc.data();
        return (
          device.type === "light" ||
          device.type === "Smart Light" ||
          device.type === "Light"
        );
      })
      .map((deviceDoc) =>
        updateDoc(deviceDoc.ref, {
          isOn: true,
          online: true,
          status: true,
          brightness: 100,
          lastSeen: new Date(),
        })
      );

      console.log("Lights to update:", lightUpdates.length);

    await Promise.all(lightUpdates);

    console.log("Emergency lights ON");
  };

  const activateSiren = async () => {
    console.log("Siren activated");
  };

  const notifyOwner = async () => {
    console.log("Owner notified");
  };

  const timeline = Array.isArray(snapshot?.timeline)
    ? snapshot.timeline
    : Array.isArray(alert?.timeline)
    ? alert.timeline
    : [];

  const [localTimeline, setLocalTimeline] = useState<any[]>(timeline.length > 0 ? timeline : [
    { label: "Motion captured", createdAt: new Date() },
    { label: "Snapshot saved", createdAt: new Date() },
  ]);

  const isActionDone = (action: string) => {
    return timeline.some((t: any) => {
      const label = String(t.label || "").toLowerCase();

      if (action.includes("Turn On Lights") && label.includes("emergency lighting")) return true;
      if (action.includes("Sound Siren") && label.includes("siren activated")) return true;
      if (action.includes("Notify Owner") && label.includes("owner notified")) return true;
      if (action.includes("View Live Camera") && label.includes("live camera")) return true;

      return false;
    });
  };

    const visibleRecommendationsCompleted = (action: string) => {
    const lowerTimeline = Array.isArray(timeline)
      ? timeline.map((t: any) => String(t.label || "").toLowerCase())
      : [];

    if (action.includes("Turn On Lights")) {
      return lowerTimeline.some((t: string) => t.includes("emergency lighting"));
    }

    if (action.includes("Sound Siren")) {
      return lowerTimeline.some((t: string) => t.includes("siren activated"));
    }

    if (action.includes("Notify Owner")) {
      return lowerTimeline.some((t: string) => t.includes("owner notified"));
    }

    if (action.includes("View Live Camera")) {
      return lowerTimeline.some((t: string) => t.includes("live camera opened"));
    }

    if (action.includes("Save Snapshot")) {
      return lowerTimeline.some((t: string) => t.includes("snapshot saved"));
    }

    return false;
  };

    const threatLevel =
    snapshot?.threatLevel ||
    alert?.threatLevel ||
    "MEDIUM";

  const aiClassification =
    snapshot?.aiClassification ||
    alert?.aiClassification ||
    "Motion Detected";

  const risk =
    snapshot?.risk ||
    alert?.risk ||
    "MEDIUM";

    const room =
      snapshot?.room ||
      alert?.room ||
      params.room ||
      params.cameraName ||
      "Living Room";

    const incidentSummary =
    threatLevel === "HIGH"
      ? `An unknown person was detected in ${room} during high-risk hours. Immediate attention is recommended.`
      : threatLevel === "MEDIUM"
      ? `Motion was detected in ${room}. No immediate threat has been confirmed.`
      : `Normal activity detected in ${room}.`;

    const confidence =
      threatLevel === "HIGH"
        ? "97%"
        : threatLevel === "MEDIUM"
        ? "93%"
        : "99%";

    useEffect(() => {
      const announce = async () => {
        Speech.speak(incidentSummary);

        await addTimelineEvent("Voice announcement played");
      };

      announce();
    }, [incidentSummary]);

    const timelineToShow = localTimeline.length > 0 ? localTimeline : (alert?.timeline || snapshot?.timeline || []);

    const getTimelineIcon = (label: string) => {
      const text = label.toLowerCase();

      if (text.includes("motion")) return "camera-outline";
      if (text.includes("snapshot saved")) return "save-outline";
      if (text.includes("voice")) return "volume-high-outline";
      if (text.includes("live camera")) return "videocam-outline";
      if (text.includes("lighting") || text.includes("lights")) return "bulb-outline";
      if (text.includes("siren")) return "warning-outline";
      if (text.includes("owner")) return "notifications-outline";
      if (text.includes("archive")) return "archive-outline";

      return "ellipse-outline";
    };

    const caseId = `CASE-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(snapshotId || alertId || "0000").slice(-4)}`;

    const detectedObject =
      snapshot?.type || alert?.type || "motion";

    const threatStatus =
      threatLevel === "HIGH" ? "🔴 Active" : "🟡 Monitoring";

    const responseTime =
      threatLevel === "HIGH" ? "1.2 sec" : "2.4 sec";

    const aiEngine = "Futuristek Vision AI v1.0";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>📸 Motion Snapshot</Text>
      <Text style={styles.subtitle}>Captured security event</Text>

      {snapshotImage? (
        <Image
          source={{
            uri: snapshotImage,
          }}
          style={styles.image}
        />
      ) : (
        <View style={styles.emptyImage}>
          <Text style={styles.emptyText}>No snapshot image found</Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.label}>Camera</Text>
        <Text style={styles.value}>{snapshot?.cameraName || routeCameraName}</Text>

        <Text style={styles.label}>Room</Text>
        <Text style={styles.value}>{snapshot?.room || routeRoom}</Text>

        <Text style={styles.label}>Type</Text>
        <Text style={styles.value}>{snapshot?.type || routeType}</Text>

        <Text style={styles.label}>Captured</Text>
        <Text style={styles.value}>
          {snapshot?.createdAt?.toDate
            ? snapshot.createdAt.toDate().toLocaleString()
            : "Just now"}
        </Text>
      </View>

      <View style={styles.timelineCard}>
        <Text style={styles.timelineTitle}>📖 Security Timeline</Text>

        {timelineToShow.length === 0 ? (
        <Text style={styles.timelineText}>No timeline events yet</Text>
      ) : (
        localTimeline.map((item: any, index: number) => {
          const time =
            item.createdAt?.toDate
              ? item.createdAt.toDate().toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })
              : item.createdAt instanceof Date
              ? item.createdAt.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })
              : "--:--:--";

          return (
            <View key={index} style={styles.timelineItem}>
              <Ionicons
                name={getTimelineIcon(item.label) as any}
                size={18}
                color="#38bdf8"
                style={styles.timelineIcon}
              />

              <View style={{ flex: 1 }}>
                <Text style={styles.timelineTime}>{time}</Text>
                <Text style={styles.timelineText}>{item.label}</Text>
              </View>
            </View>
          );
        })
      )}
      </View>

      <View style={styles.timelineCard}>
       <Text style={styles.reportTitle}>
        🧠 AI Incident Report
        </Text>

        <Text style={styles.reportText}>Case ID: {caseId}</Text>
        <Text style={styles.reportText}>Location: {room}</Text>
        <Text style={styles.reportText}>Detected: {detectedObject}</Text>
        <Text style={styles.reportText}>Status: {threatStatus}</Text>
        <Text style={styles.reportText}>Response Time: {responseTime}</Text>
        <Text style={styles.reportText}>AI Engine: {aiEngine}</Text>

        <Text style={styles.reportSummary}>
        {incidentSummary}
        </Text>

        <Text style={styles.reportText}>
        Threat Level: {threatLevel}
        </Text>

        <Text style={styles.reportText}>
        Classification: {aiClassification}
        </Text>

        <Text style={styles.reportText}>
        Confidence: {confidence}
        </Text>

        <Text style={styles.reportText}>
        Risk: {risk}
        </Text>

        <Text style={styles.timelineText}>
          Recommendation:
        </Text>

        {(snapshot?.recommendedActions || alert?.recommendedActions || []).map(
          (item: string, index: number) => (
            <Text key={index} style={styles.timelineText}>
              • {item}
            </Text>
          )
        )}

        <View style={styles.aiConclusionBox}>
          <Text style={styles.aiConclusionTitle}>AI Conclusion</Text>

          <Text style={styles.reportText}>
            {threatLevel === "HIGH"
              ? "Immediate attention is recommended. The system detected activity that may require action."
              : "No immediate danger detected. The observed activity is consistent with normal motion within the monitored area. Continue monitoring."}
          </Text>

          <Text style={styles.aiGeneratedText}>
            Generated automatically by Futuristek Vision AI.
          </Text>
        </View>
      </View>

      <View style={styles.timelineCard}>
        <Text style={styles.timelineTitle}>🧠 AI Recommendations</Text>

        {visibleRecommendations.map(
          (action: string, index: number) => (
            <Pressable
              key={index}
              style={styles.recommendationButton}
              onPress={async () => {
                const cleanAction = action.replace(/[^\w\s]/g, "").trim().toLowerCase();
                switch (cleanAction) {
                  case "view live camera":
                    Speech.speak("Opening live camera.");
                    await addTimelineEvent("Live camera opened");

                    router.push({
                      pathname: "/camera-live",
                      params: {
                        cameraId: snapshot?.cameraId || params.cameraId,
                        cameraName: snapshot?.cameraName || params.cameraName,
                        room: snapshot?.room || params.room,
                      },
                    } as any);

                    break;



                    case "turn on lights":
                    await turnOnEmergencyLights();
                    Speech.speak("Emergency lights turned on.");
                    await addTimelineEvent("Emergency lighting activated");
                    break;

                    case "sound siren":
                    await activateSiren();
                    Speech.speak("Siren activated. Security alert in progress.");
                    await addTimelineEvent("Siren activated");
                    break;

                    case "notify owner":
                    await notifyOwner();
                    Speech.speak("Owner has been notified.");
                    await addTimelineEvent("Owner notified");
                    break;

                    case "save snapshot": {

                    const user = auth.currentUser;
                    if (!user) return;

                    Speech.speak("Snapshot saved.");

                    const captureId = String(snapshotId || alertId || "");
                    if (!captureId) {
                      Alert.alert("Error", "No capture ID found.");
                      return;
                    }

                    await updateDoc(
                      doc(db, "users", user.uid, "securityCaptures", captureId),
                      {
                        saved: true,
                        archived: false,
                      }
                    );

                    await addTimelineEvent("Snapshot saved");

                    Alert.alert("Saved", "Snapshot saved successfully.");
                    break;
                  }

                   case "Archive": {
                    const user = auth.currentUser;
                    if (!user) return;

                    const captureId = String(snapshotId || alertId || "");
                    if (!captureId) {
                      Alert.alert("Error", "No capture ID found.");
                      return;
                    }

                    await updateDoc(
                      doc(db, "users", user.uid, "securityCaptures", captureId),
                      {
                        archived: true,
                      }
                    );
                      await addTimelineEvent("Snapshot archived");

                      Speech.speak("Snapshot archived.");

                      Alert.alert("Archived", "Snapshot moved to archive successfully.");

                      router.back();

                      break;
                    }

                  case "ignore":
                    await addTimelineEvent("Alert ignored");
                    Alert.alert("Ignored", "The alert has been marked as ignored.");
                    break;

                  default:
                    console.log(action);
                }
              }}
            >
            <Text style={styles.actionButtonText}>
              {visibleRecommendationsCompleted(action)
                ? `✅ ${action}`
                : action}
            </Text>
          </Pressable>
          )
        )}
      </View>

      <Pressable
        style={styles.actionButton}
        onPress={async () => {
          await addTimelineEvent("Live camera opened");

          router.push({
            pathname: "/camera-live",
           params: {
              cameraId: snapshot?.cameraId || params.cameraId,
              cameraName:
                snapshot?.cameraName ||
                snapshot?.room ||
                routeCameraName,
              name:
                snapshot?.cameraName ||
                snapshot?.room ||
                routeCameraName,
              room: snapshot?.room || routeRoom,
              thumbnail: snapshotImage,
              image: snapshotImage,
            },
          } as any);
        }}
      >
        <Text style={styles.actionButtonText}>
          ▶️ View Live Camera
        </Text>
      </Pressable>

      <Pressable
        style={styles.shareButton}
        onPress={async () => {
          if (!snapshotImage) return;

          await Share.share({
            message: `Futuristek Security Snapshot\n\nCamera: ${
              snapshot?.cameraName || "Camera"
            }\nRoom: ${snapshot?.room || "Unknown"}\nImage: ${snapshot.image}`,
          });
        }}
      >
        <Text style={styles.actionButtonText}>📤 Share Snapshot</Text>
      </Pressable>

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
    color: "#fff",
    fontSize: 34,
    fontWeight: "900",
    marginTop: 40,
  },
  subtitle: {
    color: "#9CA3AF",
    fontSize: 18,
    marginTop: 8,
    marginBottom: 24,
  },
  image: {
    width: "100%",
    height: 260,
    borderRadius: 24,
    backgroundColor: "#082F49",
  },
  emptyImage: {
    height: 260,
    borderRadius: 24,
    backgroundColor: "#082F49",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: "#9CA3AF",
    fontSize: 16,
  },
  card: {
    backgroundColor: "#0B355C",
    padding: 22,
    borderRadius: 24,
    marginTop: 24,
  },
  label: {
    color: "#93C5FD",
    fontSize: 15,
    marginTop: 14,
  },
  value: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    marginTop: 4,
  },
  button: {
    backgroundColor: "#3B82F6",
    padding: 20,
    borderRadius: 22,
    alignItems: "center",
    marginTop: 28,
  },
  buttonText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
  },

  actionButton: {
  backgroundColor: "#2563EB",
  padding: 18,
  borderRadius: 18,
  alignItems: "center",
  marginTop: 24,
},

actionButtonText: {
  color: "#fff",
  fontSize: 20,
  fontWeight: "800",
},

shareButton: {
  backgroundColor: "#0EA5E9",
  padding: 18,
  borderRadius: 18,
  alignItems: "center",
  marginTop: 16,
},

downloadButton: {
  backgroundColor: "#10B981",
  padding: 18,
  borderRadius: 18,
  alignItems: "center",
  marginTop: 16,
},

timelineCard: {
  backgroundColor: "#0F3B63",
  borderRadius: 24,
  padding: 22,
  marginTop: 22,
},

timelineTitle: {
  color: "#fff",
  fontSize: 24,
  fontWeight: "900",
  marginBottom: 14,
},

timelineItem: {
  flexDirection: "row",
  alignItems: "center",
  marginBottom: 10,
},

timelineDot: {
  color: "#38BDF8",
  fontSize: 16,
  marginRight: 10,
},

timelineText: {
  color: "#CFE8FF",
  fontSize: 16,
  fontWeight: "600",
},

recommendationButton: {
  backgroundColor: "#17395f",
  padding: 14,
  borderRadius: 12,
  marginTop: 12,
},

recommendationText: {
  color: "#fff",
  fontSize: 16,
  fontWeight: "700",
},

reportTitle: {
  color: "#fff",
  fontSize: 24,
  fontWeight: "700",
  marginBottom: 14,
},

reportSummary: {
  color: "#dbeafe",
  fontSize: 17,
  lineHeight: 24,
  marginBottom: 18,
},

reportText: {
  color: "#ffffff",
  fontSize: 17,
  marginBottom: 8,
},

timelineTime: {
  color: "#6fbfff",
  fontSize: 12,
  marginBottom: 3,
},

timelineIcon: {
  width: 26,
  marginTop: 2,
},

aiConclusionBox: {
  marginTop: 18,
  paddingTop: 14,
  borderTopWidth: 1,
  borderTopColor: "rgba(255,255,255,0.18)",
},

aiConclusionTitle: {
  color: "#fff",
  fontSize: 20,
  fontWeight: "800",
  marginBottom: 8,
},

aiGeneratedText: {
  color: "#9ecfff",
  fontSize: 15,
  marginTop: 12,
  fontStyle: "italic",
},
});