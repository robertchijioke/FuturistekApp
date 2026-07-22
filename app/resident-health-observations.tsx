import {
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  where
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

type HealthObservationRecord = {
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
  createdAt?: any;
  alertStatus?: "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
};

const CONSCIOUSNESS_OPTIONS = [
  "Alert",
  "Responds to voice",
  "Responds to pain",
  "Unresponsive",
];

const WELLBEING_OPTIONS = [
  "Comfortable",
  "Mild concern",
  "Unwell",
  "Significant concern",
];

const getTimestampMillis = (timestamp: any) => {
  if (
    typeof timestamp?.toMillis === "function"
  ) {
    return timestamp.toMillis();
  }

  if (
    typeof timestamp?.seconds === "number"
  ) {
    return timestamp.seconds * 1000;
  }

  return 0;
};

const formatTimestamp = (timestamp: any) => {
  if (
    typeof timestamp?.toDate === "function"
  ) {
    return timestamp
      .toDate()
      .toLocaleString();
  }

  if (
    typeof timestamp?.seconds === "number"
  ) {
    return new Date(
      timestamp.seconds * 1000
    ).toLocaleString();
  }

  return "Saving timestamp...";
};

const getStatusPresentation = (
  status?: ObservationStatus
) => {
  if (status === "URGENT") {
    return {
      label: "🚨 Urgent",
      color: "#ef4444",
      backgroundColor: "#3b1117",
    };
  }

  if (status === "REVIEW") {
    return {
      label: "⚠️ Needs Review",
      color: "#fbbf24",
      backgroundColor: "#3b2605",
    };
  }

  return {
    label: "✅ Routine",
    color: "#22c55e",
    backgroundColor: "#0d2c22",
  };
};

export default function ResidentHealthObservations() {
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
          "Health observations opened without a valid resident ID.",
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

            setCurrentRoom(routeRoom);
            setCurrentResidentName(routeResidentName);
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

          console.log(
            "✅ HEALTH OBSERVATION RESIDENT RESOLVED:",
            {
              residentId: snapshot.id,
              residentName:
                resolvedName || routeResidentName,
              room: resolvedRoom || routeRoom,
            }
          );
        },
        (error) => {
          console.error(
            "Could not resolve Health Observation resident:",
            error
          );

          setCurrentRoom(routeRoom);
          setCurrentResidentName(routeResidentName);
        }
      );

      return unsubscribe;
    }, [
      currentResidentId,
      routeResidentName,
      routeRoom,
    ]);

  const [records, setRecords] = useState<
    HealthObservationRecord[]
  >([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [temperature, setTemperature] =
    useState("");

  const [systolic, setSystolic] =
    useState("");

  const [diastolic, setDiastolic] =
    useState("");

  const [pulse, setPulse] =
    useState("");

  const [
    oxygenSaturation,
    setOxygenSaturation,
  ] = useState("");

  const [
    respiratoryRate,
    setRespiratoryRate,
  ] = useState("");

  const [painScore, setPainScore] =
    useState("");

  const [
    consciousness,
    setConsciousness,
  ] = useState("Alert");

  const [wellbeing, setWellbeing] =
    useState("Comfortable");

  const [staffName, setStaffName] =
    useState("James");

  const [status, setStatus] =
    useState<ObservationStatus>("ROUTINE");

  useEffect(() => {
    if (!currentResidentId) {
      console.warn(
        "Health observations cannot load without a valid resident ID.",
        {
          residentId,
          room: currentRoom,
        }
      );

      setRecords([]);
      setLoading(false);
      return;
    }

    const observationsQuery = query(
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
      observationsQuery,
      (snapshot) => {
        const observations =
          snapshot.docs
            .map((document) => ({
              ...(
                document.data() as Omit<
                  HealthObservationRecord,
                  "id"
                >
              ),
              id: document.id,
            }))
            .sort(
              (a, b) =>
                getTimestampMillis(
                  b.createdAt
                ) -
                getTimestampMillis(
                  a.createdAt
                )
            );

        setRecords(observations);
        setLoading(false);

        console.log(
          "🩺 HEALTH OBSERVATIONS LOADED:",
          {
            room: currentRoom,
            count:
              observations.length,
          }
        );
      },
      (error) => {
        console.error(
          "Could not load health observations:",
          error
        );

        setLoading(false);

        Alert.alert(
          "Observations unavailable",
          "The resident's health observations could not be loaded."
        );
      }
    );

    return unsubscribe;
  }, [
    currentResidentId,
    currentRoom,
    currentResidentName,
  ]);

  const clearForm = () => {
    setTemperature("");
    setSystolic("");
    setDiastolic("");
    setPulse("");
    setOxygenSaturation("");
    setRespiratoryRate("");
    setPainScore("");
    setConsciousness("Alert");
    setWellbeing("Comfortable");
    setStatus("ROUTINE");
  };

  const saveObservation = async () => {
    const cleanedStaffName =
      staffName.trim();

    const hasAtLeastOneReading =
      temperature.trim() ||
      systolic.trim() ||
      diastolic.trim() ||
      pulse.trim() ||
      oxygenSaturation.trim() ||
      respiratoryRate.trim() ||
      painScore.trim();

    if (!cleanedStaffName) {
      Alert.alert(
        "Staff name required",
        "Enter the staff member recording the observation."
      );
      return;
    }

    if (!hasAtLeastOneReading) {
      Alert.alert(
        "Observation required",
        "Enter at least one health observation before saving."
      );
      return;
    }

    if (
      Boolean(systolic.trim()) !==
      Boolean(diastolic.trim())
    ) {
      Alert.alert(
        "Blood pressure incomplete",
        "Enter both systolic and diastolic readings."
      );
      return;
    }

    try {
      setSaving(true);

      await addDoc(
        collection(
          db,
          "residentHealthObservations"
        ),
        {
          residentId: currentResidentId,
          residentName:
            currentResidentName,
          room: currentRoom,
          temperature:
            temperature.trim(),
          systolic: systolic.trim(),
          diastolic:
            diastolic.trim(),
          pulse: pulse.trim(),
          oxygenSaturation:
            oxygenSaturation.trim(),
          respiratoryRate:
            respiratoryRate.trim(),
          painScore:
            painScore.trim(),
          consciousness,
          wellbeing,
          staffName:
            cleanedStaffName,
          status,
          createdAt:
            serverTimestamp(),
          updatedAt:
            serverTimestamp(),
        }
      );

      console.log(
        "✅ HEALTH OBSERVATION SAVED:",
        {
          residentName:
            currentResidentName,
          room: currentRoom,
          status,
          staffName:
            cleanedStaffName,
        }
      );

      clearForm();

      Alert.alert(
        "Observation saved",
        "The health observation has been added to the resident's permanent record."
      );
    } catch (error) {
      console.error(
        "Could not save health observation:",
        error
      );

      Alert.alert(
        "Save failed",
        "The health observation could not be saved."
      );
    } finally {
      setSaving(false);
    }
  };

  const latestObservation =
    records[0];

  const urgentCount = records.filter(
    (item) =>
      item.status === "URGENT" &&
      item.alertStatus !== "RESOLVED"
  ).length;

  const reviewCount = records.filter(
    (item) =>
      item.status === "REVIEW" &&
      item.alertStatus !== "RESOLVED"
  ).length;

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
          fontSize: 41,
          fontWeight: "900",
        }}
      >
        🩺 Health Observations
      </Text>

      <Text
        style={{
          color: "#93c5fd",
          fontSize: 20,
          marginTop: 8,
        }}
      >
        {currentResidentName} •{" "}
        {currentRoom}
      </Text>

      <View
        style={{
          marginTop: 24,
          backgroundColor: "#0d2942",
          borderRadius: 18,
          padding: 20,
          borderWidth: 1,
          borderColor: "#0f766e",
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 25,
            fontWeight: "900",
          }}
        >
          📊 Observation Summary
        </Text>

        <Text
          style={{
            color: "#cfe2ff",
            fontSize: 18,
            marginTop: 14,
          }}
        >
          Recorded observations:{" "}
          {records.length}
        </Text>

        <Text
          style={{
            color: "#fbbf24",
            fontSize: 18,
            marginTop: 8,
            fontWeight: "800",
          }}
        >
          Awaiting review:{" "}
          {reviewCount}
        </Text>

        <Text
          style={{
            color: "#ef4444",
            fontSize: 18,
            marginTop: 8,
            fontWeight: "800",
          }}
        >
          Urgent records:{" "}
          {urgentCount}
        </Text>

        {latestObservation && (
          <Text
            style={{
              color: "#9ca3af",
              fontSize: 15,
              marginTop: 12,
            }}
          >
            Latest:{" "}
            {formatTimestamp(
              latestObservation.createdAt
            )}
          </Text>
        )}
      </View>

      <View
        style={{
          marginTop: 24,
          backgroundColor: "#081826",
          borderRadius: 18,
          padding: 20,
          borderWidth: 1,
          borderColor: "#22c55e",
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 27,
            fontWeight: "900",
          }}
        >
          ✍️ Record Observation
        </Text>

        <Text
          style={{
            color: "#93c5fd",
            fontSize: 17,
            fontWeight: "800",
            marginTop: 20,
          }}
        >
          Temperature (°C)
        </Text>

        <TextInput
          value={temperature}
          onChangeText={setTemperature}
          keyboardType="decimal-pad"
          placeholder="Example: 36.7"
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

        <Text
          style={{
            color: "#93c5fd",
            fontSize: 17,
            fontWeight: "800",
            marginTop: 20,
          }}
        >
          Blood pressure
        </Text>

        <View
          style={{
            flexDirection: "row",
            gap: 12,
            marginTop: 10,
          }}
        >
          <TextInput
            value={systolic}
            onChangeText={setSystolic}
            keyboardType="number-pad"
            placeholder="Systolic"
            placeholderTextColor="#64748b"
            style={{
              flex: 1,
              backgroundColor: "#0d2942",
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#374151",
              color: "#fff",
              fontSize: 17,
              padding: 15,
            }}
          />

          <TextInput
            value={diastolic}
            onChangeText={setDiastolic}
            keyboardType="number-pad"
            placeholder="Diastolic"
            placeholderTextColor="#64748b"
            style={{
              flex: 1,
              backgroundColor: "#0d2942",
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#374151",
              color: "#fff",
              fontSize: 17,
              padding: 15,
            }}
          />
        </View>

        <Text
          style={{
            color: "#93c5fd",
            fontSize: 17,
            fontWeight: "800",
            marginTop: 20,
          }}
        >
          Pulse (bpm)
        </Text>

        <TextInput
          value={pulse}
          onChangeText={setPulse}
          keyboardType="number-pad"
          placeholder="Enter pulse"
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

        <Text
          style={{
            color: "#93c5fd",
            fontSize: 17,
            fontWeight: "800",
            marginTop: 20,
          }}
        >
          Oxygen saturation (%)
        </Text>

        <TextInput
          value={oxygenSaturation}
          onChangeText={
            setOxygenSaturation
          }
          keyboardType="number-pad"
          placeholder="Enter oxygen saturation"
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

        <Text
          style={{
            color: "#93c5fd",
            fontSize: 17,
            fontWeight: "800",
            marginTop: 20,
          }}
        >
          Respiratory rate
        </Text>

        <TextInput
          value={respiratoryRate}
          onChangeText={
            setRespiratoryRate
          }
          keyboardType="number-pad"
          placeholder="Breaths per minute"
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

        <Text
          style={{
            color: "#93c5fd",
            fontSize: 17,
            fontWeight: "800",
            marginTop: 20,
          }}
        >
          Pain score (0–10)
        </Text>

        <TextInput
          value={painScore}
          onChangeText={setPainScore}
          keyboardType="number-pad"
          maxLength={2}
          placeholder="Enter pain score"
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

        <Text
          style={{
            color: "#93c5fd",
            fontSize: 17,
            fontWeight: "800",
            marginTop: 22,
          }}
        >
          Consciousness
        </Text>

        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 10,
            marginTop: 12,
          }}
        >
          {CONSCIOUSNESS_OPTIONS.map(
            (item) => {
              const selected =
                consciousness === item;

              return (
                <Pressable
                  key={item}
                  onPress={() =>
                    setConsciousness(
                      item
                    )
                  }
                  style={{
                    backgroundColor:
                      selected
                        ? "#2563eb"
                        : "#0d2942",
                    borderRadius: 20,
                    paddingHorizontal: 13,
                    paddingVertical: 9,
                    borderWidth: 1,
                    borderColor:
                      selected
                        ? "#60a5fa"
                        : "#374151",
                  }}
                >
                  <Text
                    style={{
                      color: "#fff",
                      fontSize: 14,
                      fontWeight: "800",
                    }}
                  >
                    {item}
                  </Text>
                </Pressable>
              );
            }
          )}
        </View>

        <Text
          style={{
            color: "#93c5fd",
            fontSize: 17,
            fontWeight: "800",
            marginTop: 22,
          }}
        >
          General wellbeing
        </Text>

        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 10,
            marginTop: 12,
          }}
        >
          {WELLBEING_OPTIONS.map(
            (item) => {
              const selected =
                wellbeing === item;

              return (
                <Pressable
                  key={item}
                  onPress={() =>
                    setWellbeing(item)
                  }
                  style={{
                    backgroundColor:
                      selected
                        ? "#0f766e"
                        : "#0d2942",
                    borderRadius: 20,
                    paddingHorizontal: 13,
                    paddingVertical: 9,
                    borderWidth: 1,
                    borderColor:
                      selected
                        ? "#2dd4bf"
                        : "#374151",
                  }}
                >
                  <Text
                    style={{
                      color: "#fff",
                      fontSize: 14,
                      fontWeight: "800",
                    }}
                  >
                    {item}
                  </Text>
                </Pressable>
              );
            }
          )}
        </View>

        <Text
          style={{
            color: "#93c5fd",
            fontSize: 17,
            fontWeight: "800",
            marginTop: 22,
          }}
        >
          Staff assessment
        </Text>

        <View
          style={{
            flexDirection: "row",
            gap: 10,
            marginTop: 12,
          }}
        >
          {(
            [
              "ROUTINE",
              "REVIEW",
              "URGENT",
            ] as ObservationStatus[]
          ).map((item) => {
            const presentation =
              getStatusPresentation(item);

            const selected =
              status === item;

            return (
              <Pressable
                key={item}
                onPress={() =>
                  setStatus(item)
                }
                style={{
                  flex: 1,
                  backgroundColor:
                    selected
                      ? presentation.backgroundColor
                      : "#0d2942",
                  borderRadius: 12,
                  paddingVertical: 13,
                  borderWidth:
                    selected ? 2 : 1,
                  borderColor:
                    selected
                      ? presentation.color
                      : "#374151",
                }}
              >
                <Text
                  style={{
                    color: selected
                      ? presentation.color
                      : "#cfe2ff",
                    textAlign: "center",
                    fontSize: 13,
                    fontWeight: "900",
                  }}
                >
                  {item}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text
          style={{
            color: "#93c5fd",
            fontSize: 17,
            fontWeight: "800",
            marginTop: 22,
          }}
        >
          Staff member
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

        <Pressable
          disabled={saving}
          onPress={saveObservation}
          style={{
            backgroundColor: saving
              ? "#475569"
              : "#16a34a",
            padding: 17,
            borderRadius: 14,
            marginTop: 22,
            opacity: saving
              ? 0.75
              : 1,
          }}
        >
          <Text
            style={{
              color: "#fff",
              textAlign: "center",
              fontSize: 19,
              fontWeight: "900",
            }}
          >
            {saving
              ? "⏳ Saving Observation..."
              : "✅ Save Health Observation"}
          </Text>
        </Pressable>
      </View>

      <Text
        style={{
          color: "#fff",
          fontSize: 29,
          fontWeight: "900",
          marginTop: 30,
        }}
      >
        📚 Observation History
      </Text>

      {loading ? (
        <View
          style={{
            alignItems: "center",
            marginTop: 40,
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
            Loading health observations...
          </Text>
        </View>
      ) : records.length === 0 ? (
        <View
          style={{
            marginTop: 20,
            backgroundColor: "#081826",
            borderRadius: 18,
            padding: 22,
            borderWidth: 1,
            borderColor: "#374151",
          }}
        >
          <Text
            style={{
              color: "#22c55e",
              fontSize: 23,
              fontWeight: "900",
            }}
          >
            ✅ No observations recorded
          </Text>

          <Text
            style={{
              color: "#cfe2ff",
              fontSize: 17,
              lineHeight: 25,
              marginTop: 10,
            }}
          >
            New health observations will appear here automatically.
          </Text>
        </View>
      ) : (
        records.map((item) => {
          const presentation =
            getStatusPresentation(
              item.status
            );

          return (
            <View
              key={item.id}
              style={{
                marginTop: 18,
                backgroundColor: "#081826",
                borderRadius: 18,
                padding: 20,
                borderWidth: 1,
                borderColor:
                  presentation.color,
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
                    alignSelf: "flex-start",
                    backgroundColor: presentation.backgroundColor,
                    borderRadius: 20,
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                  }}
                >
                  <Text
                    style={{
                      color: presentation.color,
                      fontSize: 15,
                      fontWeight: "900",
                    }}
                  >
                    {presentation.label}
                  </Text>
                </View>

                {item.alertStatus === "OPEN" && (
                  <View
                    style={{
                      backgroundColor: "#3b2605",
                      borderRadius: 20,
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                    }}
                  >
                    <Text
                      style={{
                        color: "#fbbf24",
                        fontSize: 15,
                        fontWeight: "900",
                      }}
                    >
                      🔔 Open
                    </Text>
                  </View>
                )}

                {item.alertStatus === "ACKNOWLEDGED" && (
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
                        color: "#60a5fa",
                        fontSize: 15,
                        fontWeight: "900",
                      }}
                    >
                      👁 Acknowledged
                    </Text>
                  </View>
                )}

                {item.alertStatus === "RESOLVED" && (
                  <View
                    style={{
                      backgroundColor: "#0d2c22",
                      borderRadius: 20,
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                    }}
                  >
                    <Text
                      style={{
                        color: "#22c55e",
                        fontSize: 15,
                        fontWeight: "900",
                      }}
                    >
                      ✅ Resolved
                    </Text>
                  </View>
                )}
              </View>

              <Text
                style={{
                  color: "#fff",
                  fontSize: 25,
                  fontWeight: "900",
                  marginTop: 14,
                }}
              >
                🩺 Health Observation
              </Text>

              <View
                style={{
                  marginTop: 16,
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                {item.temperature && (
                  <View
                    style={{
                      width: "48%",
                      backgroundColor: "#0d2942",
                      borderRadius: 12,
                      padding: 13,
                    }}
                  >
                    <Text
                      style={{
                        color: "#93c5fd",
                        fontSize: 14,
                      }}
                    >
                      Temperature
                    </Text>

                    <Text
                      style={{
                        color: "#fff",
                        fontSize: 18,
                        fontWeight: "900",
                        marginTop: 4,
                      }}
                    >
                      {item.temperature} °C
                    </Text>
                  </View>
                )}

                {(item.systolic ||
                  item.diastolic) && (
                  <View
                    style={{
                      width: "48%",
                      backgroundColor: "#0d2942",
                      borderRadius: 12,
                      padding: 13,
                    }}
                  >
                    <Text
                      style={{
                        color: "#93c5fd",
                        fontSize: 14,
                      }}
                    >
                      Blood pressure
                    </Text>

                    <Text
                      style={{
                        color: "#fff",
                        fontSize: 18,
                        fontWeight: "900",
                        marginTop: 4,
                      }}
                    >
                      {item.systolic}/
                      {item.diastolic}
                    </Text>
                  </View>
                )}

                {item.pulse && (
                  <View
                    style={{
                      width: "48%",
                      backgroundColor: "#0d2942",
                      borderRadius: 12,
                      padding: 13,
                    }}
                  >
                    <Text
                      style={{
                        color: "#93c5fd",
                        fontSize: 14,
                      }}
                    >
                      Pulse
                    </Text>

                    <Text
                      style={{
                        color: "#fff",
                        fontSize: 18,
                        fontWeight: "900",
                        marginTop: 4,
                      }}
                    >
                      {item.pulse} bpm
                    </Text>
                  </View>
                )}

                {item.oxygenSaturation && (
                  <View
                    style={{
                      width: "48%",
                      backgroundColor: "#0d2942",
                      borderRadius: 12,
                      padding: 13,
                    }}
                  >
                    <Text
                      style={{
                        color: "#93c5fd",
                        fontSize: 14,
                      }}
                    >
                      Oxygen saturation
                    </Text>

                    <Text
                      style={{
                        color: "#fff",
                        fontSize: 18,
                        fontWeight: "900",
                        marginTop: 4,
                      }}
                    >
                      {
                        item.oxygenSaturation
                      }
                      %
                    </Text>
                  </View>
                )}

                {item.respiratoryRate && (
                  <View
                    style={{
                      width: "48%",
                      backgroundColor: "#0d2942",
                      borderRadius: 12,
                      padding: 13,
                    }}
                  >
                    <Text
                      style={{
                        color: "#93c5fd",
                        fontSize: 14,
                      }}
                    >
                      Respiratory rate
                    </Text>

                    <Text
                      style={{
                        color: "#fff",
                        fontSize: 18,
                        fontWeight: "900",
                        marginTop: 4,
                      }}
                    >
                      {
                        item.respiratoryRate
                      }
                      /min
                    </Text>
                  </View>
                )}

                {item.painScore && (
                  <View
                    style={{
                      width: "48%",
                      backgroundColor: "#0d2942",
                      borderRadius: 12,
                      padding: 13,
                    }}
                  >
                    <Text
                      style={{
                        color: "#93c5fd",
                        fontSize: 14,
                      }}
                    >
                      Pain score
                    </Text>

                    <Text
                      style={{
                        color: "#fff",
                        fontSize: 18,
                        fontWeight: "900",
                        marginTop: 4,
                      }}
                    >
                      {item.painScore}/10
                    </Text>
                  </View>
                )}
              </View>

              <Text
                style={{
                  color: "#cfe2ff",
                  fontSize: 17,
                  marginTop: 16,
                }}
              >
                Consciousness:{" "}
                {item.consciousness ||
                  "Not recorded"}
              </Text>

              <Text
                style={{
                  color: "#cfe2ff",
                  fontSize: 17,
                  marginTop: 8,
                }}
              >
                Wellbeing:{" "}
                {item.wellbeing ||
                  "Not recorded"}
              </Text>

              <View
                style={{
                  backgroundColor: "#0d2942",
                  padding: 14,
                  borderRadius: 12,
                  marginTop: 16,
                }}
              >
                <Text
                  style={{
                    color: "#93c5fd",
                    fontSize: 15,
                  }}
                >
                  Recorded by
                </Text>

                <Text
                  style={{
                    color: "#fff",
                    fontSize: 17,
                    fontWeight: "900",
                    marginTop: 4,
                  }}
                >
                  {item.staffName ||
                    "Unknown staff"}
                </Text>

                <Text
                  style={{
                    color: "#9ca3af",
                    fontSize: 15,
                    marginTop: 9,
                  }}
                >
                  {formatTimestamp(
                    item.createdAt
                  )}
                </Text>
              </View>
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
          ⚠️ Clinical escalation
        </Text>

        <Text
          style={{
            color: "#fecaca",
            fontSize: 16,
            lineHeight: 24,
            marginTop: 8,
          }}
        >
          This screen records observations; it does
          not replace clinical judgement. Concerning
          readings or deterioration must follow the
          organisation’s escalation and emergency
          procedures.
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