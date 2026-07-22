import {
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { db } from "../lib/firebase";

type ObservationStatus =
  | "ROUTINE"
  | "REVIEW"
  | "URGENT";

type AlertWorkflowStatus =
  | "OPEN"
  | "ACKNOWLEDGED"
  | "RESOLVED";

type HealthAlertRecord = {
  id: string;
  residentId?: string;
  residentName?: string;
  room?: string;

  temperature?: string;
  systolic?: string;
  diastolic?: string;
  pulse?: string;
  oxygenSaturation?: string;
  respiratoryRate?: string;
  painScore?: string;

  consciousness?: string;
  wellbeing?: string;

  staffName?: string;
  status?: ObservationStatus;

  alertStatus?: AlertWorkflowStatus;
  acknowledgedBy?: string;
  acknowledgedAt?: any;
  resolvedBy?: string;
  resolvedAt?: any;
  resolutionNote?: string;

  createdAt?: any;
};

const getTimestampMillis = (timestamp: any) => {
  if (typeof timestamp?.toMillis === "function") {
    return timestamp.toMillis();
  }

  if (typeof timestamp?.seconds === "number") {
    return timestamp.seconds * 1000;
  }

  return 0;
};

const formatTimestamp = (timestamp: any) => {
  if (typeof timestamp?.toDate === "function") {
    return timestamp.toDate().toLocaleString();
  }

  if (typeof timestamp?.seconds === "number") {
    return new Date(
      timestamp.seconds * 1000
    ).toLocaleString();
  }

  return "Time unavailable";
};

const getSeverityPresentation = (
  status?: ObservationStatus
) => {
  if (status === "URGENT") {
    return {
      label: "🚨 Urgent",
      color: "#ef4444",
      backgroundColor: "#3b1117",
    };
  }

  return {
    label: "⚠️ Needs Review",
    color: "#fbbf24",
    backgroundColor: "#3b2605",
  };
};

const getWorkflowPresentation = (
  alertStatus?: AlertWorkflowStatus
) => {
  if (alertStatus === "RESOLVED") {
    return {
      label: "✅ Resolved",
      color: "#22c55e",
    };
  }

  if (alertStatus === "ACKNOWLEDGED") {
    return {
      label: "👁 Acknowledged",
      color: "#60a5fa",
    };
  }

  return {
    label: "🔔 Open",
    color: "#fbbf24",
  };
};

export default function ResidentHealthAlerts() {
  const router = useRouter();

  const {
    residentId,
    room,
    residentName,
  } = useLocalSearchParams<{
    residentId?: string;
    room?: string;
    residentName?: string;
  }>();

  const routeRoom =
    typeof room === "string" && room.trim()
      ? room.trim()
      : "";

  const routeResidentName =
    typeof residentName === "string" && residentName.trim()
      ? residentName.trim()
      : "Resident";

  const currentResidentId =
    typeof residentId === "string" && residentId.trim()
      ? residentId.trim()
      : routeRoom
        ? routeRoom
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")
        : "";

  const [currentRoom, setCurrentRoom] =
    useState(routeRoom);

  const [currentResidentName, setCurrentResidentName] =
    useState(routeResidentName);

    useEffect(() => {
      if (!currentResidentId) {
        console.warn(
          "Health alerts opened without a valid resident ID.",
          {
            residentId,
            room: routeRoom,
          }
        );

        setCurrentRoom("");
        setCurrentResidentName("Resident");
        return;
      }

      const residentReference = doc(
        db,
        "residents",
        currentResidentId
      );

      const unsubscribe = onSnapshot(
        residentReference,
        (snapshot) => {
          if (!snapshot.exists()) {
            console.error(
              "Resident document not found:",
              currentResidentId
            );
            return;
          }

          const data = snapshot.data();

          const resolvedName = String(
            data.fullName ?? ""
          ).trim();

          const resolvedRoom = String(
            data.room ?? ""
          ).trim();

          setCurrentResidentName(
            resolvedName || routeResidentName
          );

          setCurrentRoom(
            resolvedRoom || routeRoom
          );

          console.log("✅ HEALTH ALERT RESIDENT RESOLVED:", {
            residentId: snapshot.id,
            residentName: resolvedName,
            room: resolvedRoom,
          });
        },
        (error) => {
          console.error(
            "Could not resolve resident identity:",
            error
          );
        }
      );

      return unsubscribe;
    }, [
      currentResidentId,
      routeResidentName,
      routeRoom,
    ]);

  const [records, setRecords] = useState<
    HealthAlertRecord[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] =
    useState<string | null>(null);

  const [staffName, setStaffName] =
    useState("James");

  const [resolutionNotes, setResolutionNotes] =
    useState<Record<string, string>>({});

  useEffect(() => {
    if (!currentResidentId) {
      console.warn(
        "Health-alert records cannot load without a valid resident ID.",
        {
          residentId,
          room: currentRoom,
        }
      );

      setRecords([]);
      setLoading(false);
      return;
    }

    const migrateLegacyHealthObservations =
      async () => {

        if (!currentRoom) {
          console.log(
            "No valid room supplied. Skipping legacy health-observation migration.",
            {
              residentId: currentResidentId,
            }
          );

          return;
        }

        const legacyQuery = query(
          collection(
            db,
            "residentHealthObservations"
          ),
          where("room", "==", currentRoom)
        );

        const legacySnapshot =
          await getDocs(legacyQuery);

        const legacyRecords =
          legacySnapshot.docs.filter(
            (document) =>
              !document.data().residentId
          );

        if (legacyRecords.length === 0) {
          console.log(
            "✅ NO LEGACY HEALTH OBSERVATIONS TO MIGRATE:",
            {
              residentId: currentResidentId,
              room: currentRoom,
            }
          );

          return;
        }

        const batch = writeBatch(db);

        legacyRecords.forEach((document) => {
          const data = document.data();

          batch.update(document.ref, {
            residentId: currentResidentId,
            residentName:
              data.residentName ||
              currentResidentName,
            migratedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        });

        await batch.commit();

        console.log(
          "✅ LEGACY HEALTH OBSERVATIONS MIGRATED:",
          {
            residentId: currentResidentId,
            room: currentRoom,
            count: legacyRecords.length,
          }
        );
      };

    migrateLegacyHealthObservations().catch(
      (error) => {
        console.error(
          "Could not migrate legacy health observations:",
          error
        );
      }
    );

    const alertsQuery = query(
      collection(
        db,
        "residentHealthObservations"
      ),
      where(
        "residentId",
        "==",
        currentResidentId
      )
    );

    const unsubscribe = onSnapshot(
      alertsQuery,
      (snapshot) => {
        const alerts = snapshot.docs
          .map((document) => ({
            ...(document.data() as Omit<
              HealthAlertRecord,
              "id"
            >),
            id: document.id,
          }))
          .filter(
            (item) =>
              item.status === "REVIEW" ||
              item.status === "URGENT"
          )
          .sort(
            (a, b) =>
              getTimestampMillis(b.createdAt) -
              getTimestampMillis(a.createdAt)
          );

        setRecords(alerts);
        setLoading(false);

        console.log("🚨 HEALTH ALERTS LOADED:", {
          room: currentRoom,
          count: alerts.length,
        });
      },
      (error) => {
        console.error(
          "Could not load health alerts:",
          error
        );

        setLoading(false);

        Alert.alert(
          "Health alerts unavailable",
          "The resident's health alerts could not be loaded."
        );
      }
    );

    return unsubscribe;
  }, [
    currentResidentId,
    currentRoom,
    currentResidentName,
  ]);

  const openCount = records.filter(
    (item) =>
      !item.alertStatus ||
      item.alertStatus === "OPEN"
  ).length;

  const acknowledgedCount = records.filter(
    (item) =>
      item.alertStatus === "ACKNOWLEDGED"
  ).length;

  const resolvedCount = records.filter(
    (item) =>
      item.alertStatus === "RESOLVED"
  ).length;

  const acknowledgeAlert = async (
    item: HealthAlertRecord
  ) => {
    const cleanedStaffName = staffName.trim();

    if (!cleanedStaffName) {
      Alert.alert(
        "Staff name required",
        "Enter the staff member acknowledging this alert."
      );
      return;
    }

    try {
      setSavingId(item.id);

      await updateDoc(
        doc(
          db,
          "residentHealthObservations",
          item.id
        ),
        {
          alertStatus: "ACKNOWLEDGED",
          acknowledgedBy: cleanedStaffName,
          acknowledgedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );

      Alert.alert(
        "Alert acknowledged",
        "The health alert has been acknowledged."
      );
    } catch (error) {
      console.error(
        "Could not acknowledge health alert:",
        error
      );

      Alert.alert(
        "Update failed",
        "The health alert could not be acknowledged."
      );
    } finally {
      setSavingId(null);
    }
  };

  const resolveAlert = async (
    item: HealthAlertRecord
  ) => {
    const cleanedStaffName = staffName.trim();
    const resolutionNote =
      resolutionNotes[item.id]?.trim() ?? "";

    if (!cleanedStaffName) {
      Alert.alert(
        "Staff name required",
        "Enter the staff member resolving this alert."
      );
      return;
    }

    if (!resolutionNote) {
      Alert.alert(
        "Resolution note required",
        "Record the action taken and outcome before resolving the alert."
      );
      return;
    }

    Alert.alert(
      "Resolve health alert",
      "Confirm that the required review, escalation or follow-up has been completed.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Resolve",
          onPress: async () => {
            try {
              setSavingId(item.id);

              await updateDoc(
                doc(
                  db,
                  "residentHealthObservations",
                  item.id
                ),
                {
                  alertStatus: "RESOLVED",
                  resolvedBy: cleanedStaffName,
                  resolvedAt: serverTimestamp(),
                  resolutionNote,
                  updatedAt: serverTimestamp(),
                }
              );

              setResolutionNotes((current) => ({
                ...current,
                [item.id]: "",
              }));

              Alert.alert(
                "Alert resolved",
                "The health alert has been added to the resolved audit record."
              );
            } catch (error) {
              console.error(
                "Could not resolve health alert:",
                error
              );

              Alert.alert(
                "Resolution failed",
                "The health alert could not be resolved."
              );
            } finally {
              setSavingId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={{
        flex: 1,
        backgroundColor: "#061826",
      }}
      contentContainerStyle={{
        padding: 24,
        paddingTop: 50,
        paddingBottom: 100,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <Text
        style={{
          color: "#fff",
          fontSize: 42,
          fontWeight: "900",
        }}
      >
        🚨 Health Alerts
      </Text>

      <Text
        style={{
          color: "#93c5fd",
          fontSize: 20,
          marginTop: 8,
        }}
      >
        {currentResidentName} • {currentRoom}
      </Text>

      <View
        style={{
          marginTop: 24,
          backgroundColor: "#0d2942",
          borderRadius: 18,
          padding: 20,
          borderWidth: 1,
          borderColor: "#b45309",
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 25,
            fontWeight: "900",
          }}
        >
          📊 Alert Summary
        </Text>

        <Text
          style={{
            color: "#fbbf24",
            fontSize: 18,
            fontWeight: "800",
            marginTop: 14,
          }}
        >
          Open: {openCount}
        </Text>

        <Text
          style={{
            color: "#60a5fa",
            fontSize: 18,
            fontWeight: "800",
            marginTop: 8,
          }}
        >
          Acknowledged: {acknowledgedCount}
        </Text>

        <Text
          style={{
            color: "#22c55e",
            fontSize: 18,
            fontWeight: "800",
            marginTop: 8,
          }}
        >
          Resolved: {resolvedCount}
        </Text>
      </View>

      <View
        style={{
          marginTop: 20,
          backgroundColor: "#081826",
          borderRadius: 16,
          padding: 18,
          borderWidth: 1,
          borderColor: "#374151",
        }}
      >
        <Text
          style={{
            color: "#93c5fd",
            fontSize: 17,
            fontWeight: "800",
          }}
        >
          Reviewing staff member
        </Text>

        <TextInput
          value={staffName}
          onChangeText={setStaffName}
          placeholder="Enter staff name"
          placeholderTextColor="#64748b"
          style={{
            backgroundColor: "#0d2942",
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#374151",
            color: "#fff",
            fontSize: 17,
            padding: 15,
            marginTop: 10,
          }}
        />
      </View>

      <Text
        style={{
          color: "#fff",
          fontSize: 29,
          fontWeight: "900",
          marginTop: 30,
        }}
      >
        📋 Health Alert Records
      </Text>

      {loading ? (
        <View
          style={{
            alignItems: "center",
            marginTop: 45,
          }}
        >
          <ActivityIndicator size="large" />

          <Text
            style={{
              color: "#93c5fd",
              fontSize: 18,
              marginTop: 14,
            }}
          >
            Loading health alerts...
          </Text>
        </View>
      ) : records.length === 0 ? (
        <View
          style={{
            marginTop: 22,
            backgroundColor: "#081826",
            borderRadius: 18,
            padding: 22,
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
            ✅ No health alerts
          </Text>

          <Text
            style={{
              color: "#cfe2ff",
              fontSize: 17,
              lineHeight: 25,
              marginTop: 10,
            }}
          >
            Health observations marked for review or
            urgent action will appear here.
          </Text>
        </View>
      ) : (
        records.map((item) => {
          const severity =
            getSeverityPresentation(item.status);

          const workflow =
            getWorkflowPresentation(
              item.alertStatus ?? "OPEN"
            );

          const isSaving = savingId === item.id;

          return (
            <View
              key={item.id}
              style={{
                marginTop: 18,
                backgroundColor: "#081826",
                borderRadius: 18,
                padding: 20,
                borderWidth: 1,
                borderColor: severity.color,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                <View
                  style={{
                    backgroundColor:
                      severity.backgroundColor,
                    borderRadius: 20,
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                  }}
                >
                  <Text
                    style={{
                      color: severity.color,
                      fontSize: 15,
                      fontWeight: "900",
                    }}
                  >
                    {severity.label}
                  </Text>
                </View>

                <View
                  style={{
                    backgroundColor: "#0d2942",
                    borderRadius: 20,
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                  }}
                >
                  <Text
                    style={{
                      color: workflow.color,
                      fontSize: 15,
                      fontWeight: "900",
                    }}
                  >
                    {workflow.label}
                  </Text>
                </View>
              </View>

              <Text
                style={{
                  color: "#fff",
                  fontSize: 25,
                  fontWeight: "900",
                  marginTop: 16,
                }}
              >
                🩺 Health Observation Alert
              </Text>

              <Text
                style={{
                  color: "#9ca3af",
                  fontSize: 15,
                  marginTop: 9,
                }}
              >
                Recorded by{" "}
                {item.staffName || "Unknown staff"} •{" "}
                {formatTimestamp(item.createdAt)}
              </Text>

              <View
                style={{
                  backgroundColor: "#0d2942",
                  borderRadius: 12,
                  padding: 14,
                  marginTop: 16,
                }}
              >
                {item.temperature ? (
                  <Text
                    style={{
                      color: "#cfe2ff",
                      fontSize: 17,
                    }}
                  >
                    Temperature: {item.temperature} °C
                  </Text>
                ) : null}

                {item.systolic && item.diastolic ? (
                  <Text
                    style={{
                      color: "#cfe2ff",
                      fontSize: 17,
                      marginTop: 7,
                    }}
                  >
                    Blood pressure: {item.systolic}/
                    {item.diastolic}
                  </Text>
                ) : null}

                {item.pulse ? (
                  <Text
                    style={{
                      color: "#cfe2ff",
                      fontSize: 17,
                      marginTop: 7,
                    }}
                  >
                    Pulse: {item.pulse} bpm
                  </Text>
                ) : null}

                {item.oxygenSaturation ? (
                  <Text
                    style={{
                      color: "#cfe2ff",
                      fontSize: 17,
                      marginTop: 7,
                    }}
                  >
                    Oxygen saturation:{" "}
                    {item.oxygenSaturation}%
                  </Text>
                ) : null}

                {item.respiratoryRate ? (
                  <Text
                    style={{
                      color: "#cfe2ff",
                      fontSize: 17,
                      marginTop: 7,
                    }}
                  >
                    Respiratory rate:{" "}
                    {item.respiratoryRate}/min
                  </Text>
                ) : null}

                {item.painScore ? (
                  <Text
                    style={{
                      color: "#cfe2ff",
                      fontSize: 17,
                      marginTop: 7,
                    }}
                  >
                    Pain score: {item.painScore}/10
                  </Text>
                ) : null}
              </View>

              <Text
                style={{
                  color: "#cfe2ff",
                  fontSize: 17,
                  marginTop: 14,
                }}
              >
                Consciousness:{" "}
                {item.consciousness || "Not recorded"}
              </Text>

              <Text
                style={{
                  color: "#cfe2ff",
                  fontSize: 17,
                  marginTop: 8,
                }}
              >
                Wellbeing:{" "}
                {item.wellbeing || "Not recorded"}
              </Text>

              {item.alertStatus === "ACKNOWLEDGED" && (
                <View
                  style={{
                    backgroundColor: "#0d2942",
                    borderRadius: 12,
                    padding: 14,
                    marginTop: 16,
                  }}
                >
                  <Text
                    style={{
                      color: "#60a5fa",
                      fontSize: 16,
                      fontWeight: "900",
                    }}
                  >
                    Acknowledged by{" "}
                    {item.acknowledgedBy ||
                      "Unknown staff"}
                  </Text>

                  <Text
                    style={{
                      color: "#9ca3af",
                      fontSize: 15,
                      marginTop: 7,
                    }}
                  >
                    {formatTimestamp(
                      item.acknowledgedAt
                    )}
                  </Text>
                </View>
              )}

              {item.alertStatus === "RESOLVED" && (
                <View
                  style={{
                    backgroundColor: "#0d2c22",
                    borderRadius: 12,
                    padding: 14,
                    marginTop: 16,
                  }}
                >
                  <Text
                    style={{
                      color: "#22c55e",
                      fontSize: 16,
                      fontWeight: "900",
                    }}
                  >
                    Resolved by{" "}
                    {item.resolvedBy ||
                      "Unknown staff"}
                  </Text>

                  <Text
                    style={{
                      color: "#cfe2ff",
                      fontSize: 16,
                      lineHeight: 24,
                      marginTop: 8,
                    }}
                  >
                    {item.resolutionNote ||
                      "No resolution note recorded."}
                  </Text>

                  <Text
                    style={{
                      color: "#9ca3af",
                      fontSize: 15,
                      marginTop: 8,
                    }}
                  >
                    {formatTimestamp(item.resolvedAt)}
                  </Text>
                </View>
              )}

              {(!item.alertStatus ||
                item.alertStatus === "OPEN") && (
                <Pressable
                  disabled={isSaving}
                  onPress={() =>
                    acknowledgeAlert(item)
                  }
                  style={{
                    backgroundColor: isSaving
                      ? "#475569"
                      : "#2563eb",
                    padding: 15,
                    borderRadius: 12,
                    marginTop: 18,
                  }}
                >
                  <Text
                    style={{
                      color: "#fff",
                      textAlign: "center",
                      fontSize: 17,
                      fontWeight: "900",
                    }}
                  >
                    👁 Acknowledge Alert
                  </Text>
                </Pressable>
              )}

              {item.alertStatus !== "RESOLVED" && (
                <>
                  <Text
                    style={{
                      color: "#93c5fd",
                      fontSize: 16,
                      fontWeight: "800",
                      marginTop: 18,
                    }}
                  >
                    Resolution and follow-up note
                  </Text>

                  <TextInput
                    value={
                      resolutionNotes[item.id] ?? ""
                    }
                    onChangeText={(value) =>
                      setResolutionNotes(
                        (current) => ({
                          ...current,
                          [item.id]: value,
                        })
                      )
                    }
                    placeholder="Record the review, action taken, escalation and outcome..."
                    placeholderTextColor="#64748b"
                    multiline
                    textAlignVertical="top"
                    style={{
                      minHeight: 120,
                      backgroundColor: "#0d2942",
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: "#374151",
                      color: "#fff",
                      fontSize: 16,
                      lineHeight: 24,
                      padding: 14,
                      marginTop: 10,
                    }}
                  />

                  <Pressable
                    disabled={isSaving}
                    onPress={() => resolveAlert(item)}
                    style={{
                      backgroundColor: isSaving
                        ? "#475569"
                        : "#16a34a",
                      padding: 15,
                      borderRadius: 12,
                      marginTop: 14,
                    }}
                  >
                    <Text
                      style={{
                        color: "#fff",
                        textAlign: "center",
                        fontSize: 17,
                        fontWeight: "900",
                      }}
                    >
                      ✅ Resolve Health Alert
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
          );
        })
      )}

      <View
        style={{
          marginTop: 24,
          backgroundColor: "#2b1720",
          borderRadius: 16,
          padding: 18,
          borderWidth: 1,
          borderColor: "#ef4444",
        }}
      >
        <Text
          style={{
            color: "#fca5a5",
            fontSize: 19,
            fontWeight: "900",
          }}
        >
          ⚠️ Escalation reminder
        </Text>

        <Text
          style={{
            color: "#fecaca",
            fontSize: 16,
            lineHeight: 24,
            marginTop: 8,
          }}
        >
          Acknowledging an alert does not resolve the
          underlying concern. Follow the organisation’s
          clinical review, escalation and emergency
          procedures before marking it resolved.
        </Text>
      </View>

      <Pressable
        onPress={() => router.back()}
        style={{
          backgroundColor: "#374151",
          padding: 18,
          borderRadius: 16,
          marginTop: 28,
        }}
      >
        <Text
          style={{
            color: "#fff",
            textAlign: "center",
            fontSize: 20,
            fontWeight: "900",
          }}
        >
          ← Back
        </Text>
      </Pressable>
    </ScrollView>
  );
}