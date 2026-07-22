import { useRouter } from "expo-router";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc, where,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { useIncident } from "../context/IncidentContext";
import { db } from "../lib/firebase";

type ResidentStatus =
  | "SAFE"
  | "ATTENTION"
  | "CRITICAL";

type ResidentRecord = {
  id: string;
  fullName: string;
  room: string;
  age?: number;
  dateOfBirth?: string;
  status: ResidentStatus;
  activity?: string;
  fallRisk?: "LOW" | "MEDIUM" | "HIGH";
  mobilitySupport?: string;
  observationFrequency?: string;
  medicationAssistance?: boolean;
  emergencyContact?: string;
  createdAt?: any;
  updatedAt?: any;
};

const INITIAL_RESIDENTS: Omit<
  ResidentRecord,
  "id"
>[] = [
  {
    fullName: "Mrs. Elizabeth Smith",
    room: "Room 1",
    age: 84,
    status: "SAFE",
    activity: "No activity",
    fallRisk: "HIGH",
    mobilitySupport: "Uses walking frame",
    observationFrequency: "Every 2 hours",
    medicationAssistance: true,
    emergencyContact: "Not yet added",
  },
  {
    fullName: "Mr. David Johnson",
    room: "Room 2",
    age: 79,
    status: "SAFE",
    activity: "Resting",
    fallRisk: "MEDIUM",
    mobilitySupport: "Independent with supervision",
    observationFrequency: "Every 4 hours",
    medicationAssistance: true,
    emergencyContact: "Not yet added",
  },
  {
    fullName: "Mr. Steve Brown",
    room: "Room 3",
    age: 76,
    status: "SAFE",
    activity: "No activity",
    fallRisk: "MEDIUM",
    mobilitySupport: "Walking stick",
    observationFrequency: "Every 4 hours",
    medicationAssistance: true,
    emergencyContact: "Not yet added",
  },
  {
    fullName: "Mrs. Mary Wilson",
    room: "Room 5",
    age: 82,
    status: "ATTENTION",
    activity: "Wandering",
    fallRisk: "HIGH",
    mobilitySupport: "Requires staff supervision",
    observationFrequency: "Every hour",
    medicationAssistance: true,
    emergencyContact: "Not yet added",
  },
  {
    fullName: "Mr. Michael Taylor",
    room: "Room 12",
    age: 81,
    status: "SAFE",
    activity: "No activity",
    fallRisk: "HIGH",
    mobilitySupport: "Walking frame",
    observationFrequency: "Every 2 hours",
    medicationAssistance: true,
    emergencyContact: "Not yet added",
  },
  {
    fullName: "Mrs. Sarah Thompson",
    room: "Room 18",
    age: 87,
    status: "SAFE",
    activity: "Resting",
    fallRisk: "MEDIUM",
    mobilitySupport: "Wheelchair support",
    observationFrequency: "Every 2 hours",
    medicationAssistance: true,
    emergencyContact: "Not yet added",
  },
];

const createResidentDocumentId = (room: string) =>
  room
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const getRoomNumber = (room?: string) => {
  const match = String(room ?? "").match(/\d+/);
  return match ? Number(match[0]) : 9999;
};

const getStatusPresentation = (
  status: ResidentStatus
) => {
  if (status === "CRITICAL") {
    return {
      label: "🔴 Critical",
      color: "#ef4444",
      borderColor: "#ef4444",
      backgroundColor: "#3b1117",
    };
  }

  if (status === "ATTENTION") {
    return {
      label: "🟡 Needs Attention",
      color: "#fbbf24",
      borderColor: "#fbbf24",
      backgroundColor: "#3b2605",
    };
  }

  return {
    label: "🟢 Safe",
    color: "#22c55e",
    borderColor: "#22c55e",
    backgroundColor: "#0d2c22",
  };
};

export default function CareResidents() {
  const router = useRouter();

  const [residents, setResidents] = useState<
    ResidentRecord[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [activeCareEvents, setActiveCareEvents] =
  useState<any[]>([]);

  useEffect(() => {
    const initialiseResidents = async () => {
      try {
        const residentsReference = collection(
          db,
          "residents"
        );

        const existingResidents = await getDocs(
          residentsReference
        );

        if (!existingResidents.empty) {
          return;
        }

        await Promise.all(
          INITIAL_RESIDENTS.map(async (resident) => {
            const residentId =
              createResidentDocumentId(resident.room);

            await setDoc(
              doc(db, "residents", residentId),
              {
                ...resident,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              }
            );
          })
        );

        console.log(
          "✅ INITIAL RESIDENT DIRECTORY CREATED"
        );
      } catch (error) {
        console.error(
          "Could not initialise residents:",
          error
        );

        Alert.alert(
          "Resident setup unavailable",
          "The initial resident directory could not be prepared."
        );
      }
    };

    initialiseResidents();

    const unsubscribe = onSnapshot(
      collection(db, "residents"),
      (snapshot) => {
        const records = snapshot.docs
          .map((document) => ({
            ...(document.data() as Omit<
              ResidentRecord,
              "id"
            >),
            id: document.id,
          }))
          .sort(
            (a, b) =>
              getRoomNumber(a.room) -
              getRoomNumber(b.room)
          );

        setResidents(records);
        setLoading(false);

        console.log("👥 RESIDENTS LOADED:", {
          count: records.length,
        });
      },
      (error) => {
        console.error(
          "Could not load residents:",
          error
        );

        setLoading(false);

        Alert.alert(
          "Residents unavailable",
          "The resident directory could not be loaded."
        );
      }
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    const activeEventsQuery = query(
      collection(db, "careEvents"),
      where("status", "==", "active")
    );

    const unsubscribe = onSnapshot(
      activeEventsQuery,
      (snapshot) => {
        const events: any[] = snapshot.docs.map(
          (document) => ({
            id: document.id,
            ...document.data(),
          })
        );

        setActiveCareEvents(events);
      },
      (error) => {
        console.error(
          "Could not load live resident statuses:",
          error
        );
        setActiveCareEvents([]);
      }
    );

    return unsubscribe;
  }, []);

  const filteredResidents = useMemo(() => {
    const queryText = searchText
      .trim()
      .toLowerCase();

    if (!queryText) {
      return residents;
    }

    return residents.filter((resident) => {
      return (
        resident.fullName
          .toLowerCase()
          .includes(queryText) ||
        resident.room
          .toLowerCase()
          .includes(queryText) ||
        resident.status
          .toLowerCase()
          .includes(queryText) ||
        String(resident.activity ?? "")
          .toLowerCase()
          .includes(queryText)
      );
    });
  }, [residents, searchText]);

  const { incident } = useIncident();

  const incidentRoom = String(
    incident?.room ?? ""
  ).trim();

  const incidentStage = String(
    incident?.stage ?? ""
  )
    .trim()
    .toUpperCase();

  const incidentStatus = String(
    incident?.status ?? ""
  )
    .trim()
    .toLowerCase();

  const isResolved =
    !incident ||
    incidentStage === "RESOLVED" ||
    incidentStatus === "resolved";

  const getEffectiveResidentStatus = (resident: any) => {
  const residentRoom = String(resident?.room ?? "").trim();

  const hasActiveIncident =
    Boolean(incidentRoom) &&
    residentRoom === incidentRoom &&
    !isResolved;

    if (hasActiveIncident) {
      return "CRITICAL";
    }

    return String(resident?.status ?? "SAFE")
      .trim()
      .toUpperCase();
  };

  const safeCount = residents.filter(
    (resident) =>
      getEffectiveResidentStatus(resident) === "SAFE"
  ).length;

  const attentionCount = residents.filter(
    (resident) =>
      getEffectiveResidentStatus(resident) === "ATTENTION"
  ).length;

  const criticalCount = residents.filter(
    (resident) =>
      getEffectiveResidentStatus(resident) === "CRITICAL"
  ).length;

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#061826",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" />

        <Text
          style={{
            color: "#93c5fd",
            fontSize: 19,
            fontWeight: "800",
            marginTop: 14,
          }}
        >
          Loading residents...
        </Text>
      </View>
    );
  }

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
          fontSize: 43,
          fontWeight: "900",
        }}
      >
        👥 Residents
      </Text>

      <Text
        style={{
          color: "#93c5fd",
          fontSize: 20,
          marginTop: 8,
        }}
      >
        Live resident directory
      </Text>

      <View
        style={{
          marginTop: 24,
          backgroundColor: "#0d2942",
          borderRadius: 18,
          padding: 20,
          borderWidth: 1,
          borderColor: "#2563eb",
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 25,
            fontWeight: "900",
          }}
        >
          📊 Resident Summary
        </Text>

        <Text
          style={{
            color: "#cfe2ff",
            fontSize: 18,
            marginTop: 14,
          }}
        >
          Total residents: {residents.length}
        </Text>

        <Text
          style={{
            color: "#22c55e",
            fontSize: 18,
            fontWeight: "800",
            marginTop: 8,
          }}
        >
          Safe: {safeCount}
        </Text>

        <Text
          style={{
            color: "#fbbf24",
            fontSize: 18,
            fontWeight: "800",
            marginTop: 8,
          }}
        >
          Needs attention: {attentionCount}
        </Text>

        <Text
          style={{
            color: "#ef4444",
            fontSize: 18,
            fontWeight: "800",
            marginTop: 8,
          }}
        >
          Critical: {criticalCount}
        </Text>
      </View>

      <Pressable
        onPress={() =>
          router.push({
            pathname: "/care-resident-form",
            params: {
              mode: "create",
            },
          } as any)
        }
        style={{
          backgroundColor: "#16a34a",
          padding: 18,
          borderRadius: 16,
          marginTop: 22,
        }}
      >
        <Text
          style={{
            color: "#fff",
            textAlign: "center",
            fontSize: 21,
            fontWeight: "900",
          }}
        >
          ➕ Add Resident
        </Text>
      </Pressable>

      <TextInput
        value={searchText}
        onChangeText={setSearchText}
        placeholder="Search by resident, room or status..."
        placeholderTextColor="#64748b"
        style={{
          marginTop: 22,
          backgroundColor: "#0d2942",
          borderRadius: 14,
          borderWidth: 1,
          borderColor: "#374151",
          color: "#fff",
          fontSize: 17,
          padding: 16,
        }}
      />

      <Text
        style={{
          color: "#fff",
          fontSize: 29,
          fontWeight: "900",
          marginTop: 30,
        }}
      >
        🏠 Resident Rooms
      </Text>

      {filteredResidents.length === 0 ? (
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
              color: "#fbbf24",
              fontSize: 23,
              fontWeight: "900",
            }}
          >
            No matching residents
          </Text>

          <Text
            style={{
              color: "#cfe2ff",
              fontSize: 17,
              marginTop: 10,
            }}
          >
            Try a different name, room or status.
          </Text>
        </View>
      ) : (
        filteredResidents.map((resident) => {
          const residentActiveEvent =
            activeCareEvents.find(
              (event: any) =>
                String(event.residentId ?? "") ===
                  String(resident.id ?? "") ||
                String(event.room ?? "") ===
                  String(resident.room ?? "")
            ) ?? null;

          const activeSeverity = String(
            residentActiveEvent?.severity ?? ""
          )
            .trim()
            .toUpperCase();

          const liveStatus = residentActiveEvent
            ? activeSeverity === "HIGH" ||
              activeSeverity === "CRITICAL"
              ? "CRITICAL"
              : "ATTENTION"
            : resident.status;

          const presentation =
            getStatusPresentation(liveStatus);

          return (
            <View
              key={resident.id}
              style={{
                marginTop: 18,
                backgroundColor: "#081826",
                borderRadius: 18,
                borderWidth: 1,
                borderColor: presentation.borderColor,
                overflow: "hidden",
              }}
            >
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/resident-profile",
                    params: {
                      residentId: resident.id,
                      residentName: resident.fullName,
                      room: resident.room,
                      status: liveStatus,
                      activity: resident.activity ?? "No activity",
                    },
                  } as any)
                }
                style={{
                  padding: 20,
                }}
              >
              <View
                style={{
                  alignSelf: "flex-start",
                  backgroundColor:
                    presentation.backgroundColor,
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

              <Text
                style={{
                  color: "#fff",
                  fontSize: 28,
                  fontWeight: "900",
                  marginTop: 15,
                  paddingRight: 35,
                }}
              >
                {resident.fullName}
              </Text>

              <Text
                style={{
                  color: "#93c5fd",
                  fontSize: 20,
                  fontWeight: "800",
                  marginTop: 8,
                }}
              >
                🛏️ {resident.room}
              </Text>

              {resident.age ? (
                <Text
                  style={{
                    color: "#cfe2ff",
                    fontSize: 17,
                    marginTop: 10,
                  }}
                >
                  Age: {resident.age} years
                </Text>
              ) : null}

              <Text
                style={{
                  color: "#cfe2ff",
                  fontSize: 17,
                  marginTop: 8,
                }}
              >
                Current activity:{" "}
                {resident.activity ||
                  "No activity"}
              </Text>

              <Text
                style={{
                  color:
                    resident.fallRisk === "HIGH"
                      ? "#fbbf24"
                      : "#cfe2ff",
                  fontSize: 17,
                  fontWeight:
                    resident.fallRisk === "HIGH"
                      ? "900"
                      : "500",
                  marginTop: 8,
                }}
              >
                Fall risk:{" "}
                {resident.fallRisk ||
                  "Not recorded"}
              </Text>

              <Text
                style={{
                  position: "absolute",
                  right: 18,
                  top: 18,
                  color: "#93c5fd",
                  fontSize: 30,
                  fontWeight: "900",
                }}
              >
                ›
              </Text>
            </Pressable>

              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/care-resident-form",
                    params: {
                      mode: "edit",
                      residentId: resident.id,
                    },
                  } as any)
                }
                style={{
                  backgroundColor: "#2563eb",
                  padding: 14,
                  marginHorizontal: 20,
                  marginBottom: 20,
                  borderRadius: 12,
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
                  ✏️ Edit Resident
                </Text>
              </Pressable>
            </View>
          );
        })
      )}

      <Pressable
        onPress={() => router.back()}
        style={{
          backgroundColor: "#374151",
          padding: 18,
          borderRadius: 16,
          marginTop: 30,
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