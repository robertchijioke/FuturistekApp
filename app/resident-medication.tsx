import { useLocalSearchParams, useRouter } from "expo-router";
import {
  collection, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc,
  where
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { db } from "../lib/firebase";

type MedicationStatus =
  | "COMPLETED"
  | "DUE"
  | "PRN";

type MedicationRecord = {
  id: string;
  name: string;
  purpose: string;
  dose: string;
  schedule: string;
  route: string;
  status: MedicationStatus;
  lastAdministered: string;
  nextDue: string;
  instructions: string;
  room: string;
  residentName: string;
  order: number;
  administeredAt?: any;
};

const MEDICATION_TEMPLATES = [
  {
    id: "med-1",
    order: 1,
    name: "Blood pressure medication",
    purpose: "Blood pressure support",
    dose: "1 tablet",
    schedule: "Every morning",
    route: "Oral",
    status: "COMPLETED" as MedicationStatus,
    lastAdministered: "8:02 AM",
    nextDue: "Tomorrow at 8:00 AM",
    instructions:
      "Administer according to the resident's current MAR.",
  },
  {
    id: "med-2",
    order: 2,
    name: "Vitamin supplement",
    purpose: "Daily nutritional support",
    dose: "1 tablet",
    schedule: "Once daily",
    route: "Oral",
    status: "DUE" as MedicationStatus,
    lastAdministered: "Yesterday at 12:05 PM",
    nextDue: "12:00 PM today",
    instructions:
      "Administer with food as documented in the care plan.",
  },
  {
    id: "med-3",
    order: 3,
    name: "PRN pain relief",
    purpose: "Pain management when required",
    dose: "As prescribed",
    schedule: "When required",
    route: "Oral",
    status: "PRN" as MedicationStatus,
    lastAdministered: "Not administered today",
    nextDue: "Only when clinically required",
    instructions:
      "Check the MAR, minimum interval and authorisation before administration.",
  },
];

const getStatusPresentation = (
  status: MedicationStatus
) => {
  if (status === "COMPLETED") {
    return {
      label: "✅ Administered",
      color: "#22c55e",
      borderColor: "#22c55e",
    };
  }

  if (status === "DUE") {
    return {
      label: "⏰ Due",
      color: "#fbbf24",
      borderColor: "#fbbf24",
    };
  }

  return {
    label: "🩺 PRN",
    color: "#60a5fa",
    borderColor: "#2563eb",
  };
};

export default function ResidentMedication() {
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
          "Medication screen opened without a valid resident ID.",
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
              "Medication resident document not found:",
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

          console.log("✅ MEDICATION RESIDENT RESOLVED:", {
            residentId: snapshot.id,
            residentName:
              resolvedName || routeResidentName,
            room: resolvedRoom || routeRoom,
          });
        },
        (error) => {
          console.error(
            "Could not resolve Medication resident:",
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

  const [medications, setMedications] =
    useState<MedicationRecord[]>([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentResidentId) {
      console.warn(
        "Medication records cannot load without a valid resident ID.",
        {
          residentId,
          room: currentRoom,
        }
      );
      
      setLoading(false);
      return;
    }

  const initialiseMedicationRecords = async () => {

    if (!currentResidentId) {
      console.warn(
        "Medication records cannot be initialised without a valid resident ID."
      );
      return;
    }

    try {
      await Promise.all(
        MEDICATION_TEMPLATES.map(async (template) => {
          const medicationDocumentId =
            `${currentResidentId}-${template.id}`;

          await setDoc(
            doc(
              db,
              "residentMedications",
              medicationDocumentId
            ),
            {
              ...template,
              residentId: currentResidentId,
              room: currentRoom,
              residentName: currentResidentName,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            {
              merge: true,
            }
          );
        })
      );
    } catch (error) {
      console.error(
        "Could not initialise medication records:",
        error
      );
    }
  };

  initialiseMedicationRecords();

  const medicationsQuery = query(
    collection(db, "residentMedications"),
    where(
      "residentId",
      "==",
      currentResidentId
    )
  );

  const unsubscribe = onSnapshot(
    medicationsQuery,
    (snapshot) => {
      const records = snapshot.docs
        .map((document) => ({
          ...(document.data() as Omit<
            MedicationRecord,
            "id"
          >),
          id: document.id,
        }))
        .sort(
          (a, b) =>
            Number(a.order ?? 0) -
            Number(b.order ?? 0)
        );

      setMedications(records);
      setLoading(false);

      console.log("💊 MEDICATION RECORDS LOADED:", {
        residentId: currentResidentId,
        room: currentRoom,
        count: records.length,
      });
    },
    (error) => {
      console.error(
        "Could not load medication records:",
        error
      );

      setLoading(false);

      Alert.alert(
        "Medication records unavailable",
        "The resident's medication records could not be loaded."
      );
    }
  );

  return unsubscribe;
}, [
  currentResidentId,
  currentRoom,
  currentResidentName,
]);

  const completedCount = medications.filter(
    (item) => item.status === "COMPLETED"
  ).length;

  const dueCount = medications.filter(
    (item) => item.status === "DUE"
  ).length;

  const prnCount = medications.filter(
    (item) => item.status === "PRN"
  ).length;

  const markAsAdministered = (
    medication: MedicationRecord
  ) => {
    if (medication.status === "PRN") {
      Alert.alert(
        "PRN medication",
        "PRN administration requires the appropriate assessment and MAR authorisation."
      );
      return;
    }

    if (medication.status === "COMPLETED") {
      Alert.alert(
        "Already administered",
        `${medication.name} is already recorded as administered.`
      );
      return;
    }

    Alert.alert(
      "Confirm administration",
      `Record ${medication.name} as administered now?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Confirm",
          onPress: async () => {
            try {
              const administeredTime =
                new Date().toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                });

              await updateDoc(
                doc(
                  db,
                  "residentMedications",
                  medication.id
                ),
                {
                  residentId: currentResidentId,
                  room: currentRoom,
                  residentName: currentResidentName,
                  status: "COMPLETED",
                  lastAdministered:
                    `Today at ${administeredTime}`,
                  nextDue:
                    "Next scheduled administration",
                  administeredAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                }
              );

              await setDoc(
                doc(
                  collection(
                    db,
                    "medicationAdministrationHistory"
                  )
                ),
                {
                  residentId: currentResidentId,
                  medicationId: medication.id,
                  medicationName: medication.name,
                  room: currentRoom,
                  residentName: currentResidentName,
                  dose: medication.dose,
                  route: medication.route,
                  status: "ADMINISTERED",
                  administeredAt: serverTimestamp(),
                }
              );

              Alert.alert(
                "Administration recorded",
                `${medication.name} has been marked as administered.`
              );
            } catch (error) {
              console.error(
                "Could not record medication administration:",
                error
              );

              Alert.alert(
                "Recording failed",
                "The medication administration could not be saved."
              );
            }
           }
          },
      ]
    );
  };

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
        <Text
          style={{
            color: "#93c5fd",
            fontSize: 20,
            fontWeight: "800",
          }}
        >
          💊 Loading medication records...
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
    >
      <Text
        style={{
          color: "#fff",
          fontSize: 42,
          fontWeight: "900",
        }}
      >
        💊 Medication
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
          marginTop: 26,
          backgroundColor: "#0d2942",
          borderRadius: 18,
          padding: 20,
          borderWidth: 1,
          borderColor: "#16a34a",
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 25,
            fontWeight: "900",
          }}
        >
          📊 Administration Overview
        </Text>

        <Text
          style={{
            color: "#cfe2ff",
            fontSize: 18,
            marginTop: 14,
          }}
        >
          Prescribed records: {medications.length}
        </Text>

        <Text
          style={{
            color: "#22c55e",
            fontSize: 18,
            marginTop: 8,
            fontWeight: "800",
          }}
        >
          Completed today: {completedCount}
        </Text>

        <Text
          style={{
            color:
              dueCount > 0
                ? "#fbbf24"
                : "#22c55e",
            fontSize: 18,
            marginTop: 8,
            fontWeight: "800",
          }}
        >
          Due now: {dueCount}
        </Text>

        <Text
          style={{
            color: "#60a5fa",
            fontSize: 18,
            marginTop: 8,
            fontWeight: "800",
          }}
        >
          PRN available: {prnCount}
        </Text>
      </View>

      {dueCount > 0 && (
        <View
          style={{
            marginTop: 20,
            backgroundColor: "#3b2605",
            borderRadius: 16,
            padding: 18,
            borderWidth: 1,
            borderColor: "#fbbf24",
          }}
        >
          <Text
            style={{
              color: "#fbbf24",
              fontSize: 22,
              fontWeight: "900",
            }}
          >
            ⏰ Medication due
          </Text>

          <Text
            style={{
              color: "#fef3c7",
              fontSize: 17,
              marginTop: 8,
              lineHeight: 25,
            }}
          >
            {dueCount} scheduled medication
            {dueCount === 1 ? " is" : "s are"} awaiting
            administration.
          </Text>
        </View>
      )}

      <Text
        style={{
          color: "#fff",
          fontSize: 28,
          fontWeight: "900",
          marginTop: 30,
        }}
      >
        📋 Medication Records
      </Text>

      {medications.map((item) => {
        const presentation =
          getStatusPresentation(item.status);

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
                presentation.borderColor,
            }}
          >
            <Text
              style={{
                color: "#fff",
                fontSize: 25,
                fontWeight: "900",
              }}
            >
              💊 {item.name}
            </Text>

            <Text
              style={{
                color: presentation.color,
                fontSize: 18,
                fontWeight: "900",
                marginTop: 10,
              }}
            >
              {presentation.label}
            </Text>

            <Text
              style={{
                color: "#93c5fd",
                fontSize: 17,
                marginTop: 14,
              }}
            >
              Purpose: {item.purpose}
            </Text>

            <Text
              style={{
                color: "#cfe2ff",
                fontSize: 17,
                marginTop: 8,
              }}
            >
              Dose: {item.dose}
            </Text>

            <Text
              style={{
                color: "#cfe2ff",
                fontSize: 17,
                marginTop: 8,
              }}
            >
              Schedule: {item.schedule}
            </Text>

            <Text
              style={{
                color: "#cfe2ff",
                fontSize: 17,
                marginTop: 8,
              }}
            >
              Route: {item.route}
            </Text>

            <View
              style={{
                marginTop: 16,
                backgroundColor: "#0d2942",
                padding: 14,
                borderRadius: 12,
              }}
            >
              <Text
                style={{
                  color: "#cfe2ff",
                  fontSize: 16,
                }}
              >
                Last administered:
              </Text>

              <Text
                style={{
                  color: "#fff",
                  fontSize: 17,
                  fontWeight: "800",
                  marginTop: 4,
                }}
              >
                {item.lastAdministered}
              </Text>

              <Text
                style={{
                  color: "#cfe2ff",
                  fontSize: 16,
                  marginTop: 12,
                }}
              >
                Next due:
              </Text>

              <Text
                style={{
                  color:
                    item.status === "DUE"
                      ? "#fbbf24"
                      : "#fff",
                  fontSize: 17,
                  fontWeight: "800",
                  marginTop: 4,
                }}
              >
                {item.nextDue}
              </Text>
            </View>

            <Text
              style={{
                color: "#9ca3af",
                fontSize: 15,
                lineHeight: 22,
                marginTop: 14,
              }}
            >
              {item.instructions}
            </Text>

            {(item.status === "DUE" ||
              item.status === "PRN") && (
              <Pressable
                onPress={() =>
                  markAsAdministered(item)
                }
                style={{
                  backgroundColor:
                    item.status === "DUE"
                      ? "#16a34a"
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
                    fontWeight: "900",
                    fontSize: 17,
                  }}
                >
                  {item.status === "DUE"
                    ? "✅ Record Administration"
                    : "🩺 Review PRN Medication"}
                </Text>
              </Pressable>
            )}
          </View>
        );
      })}

      <Pressable
        onPress={() =>
          router.push({
            pathname: "/medication-administration-history",
            params: {
              room: currentRoom,
              residentName: currentResidentName,
            },
          } as any)
        }
        style={{
          backgroundColor: "#7c3aed",
          padding: 18,
          borderRadius: 16,
          marginTop: 24,
        }}
      >
        <Text
          style={{
            color: "#fff",
            textAlign: "center",
            fontWeight: "900",
            fontSize: 20,
          }}
        >
          📚 Administration History
        </Text>
      </Pressable>

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
          ⚠️ Medication safety
        </Text>

        <Text
          style={{
            color: "#fecaca",
            fontSize: 16,
            lineHeight: 24,
            marginTop: 8,
          }}
        >
          Confirm the resident, medicine, dose,
          route, time and current MAR before
          recording administration.
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
            fontWeight: "900",
            fontSize: 20,
          }}
        >
          ← Back
        </Text>
      </Pressable>
    </ScrollView>
  );
}