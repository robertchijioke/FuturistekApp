import { useLocalSearchParams, useRouter } from "expo-router";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, Alert, Pressable, ScrollView, Text, View,
} from "react-native";
import { db } from "../lib/firebase";

type MedicationRecord = {
  id: string;
  name?: string;
  status?: "COMPLETED" | "DUE" | "PRN";
  room?: string;
  lastAdministered?: string;
  nextDue?: string;
};

type CareTaskRecord = {
  id: string;
  title?: string;
  status?: "PENDING" | "DUE" | "COMPLETED";
  room?: string;
  taskDate?: string;
  completedBy?: string;
  completedAt?: any;
};

type CareNoteRecord = {
  id: string;
  category?: string;
  note?: string;
  priority?: "ROUTINE" | "IMPORTANT" | "URGENT";
  staffName?: string;
  room?: string;
  createdAt?: any;
};

type IncidentPackageRecord = {
  id: string;
  incidentId?: string;
  room?: string;
  incidentType?: string;
  assignedStaff?: string;
  finalStage?: string;
  status?: string;
  generatedAt?: any;
};

type HealthObservationRecord = {
  id: string;
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
  status?: "ROUTINE" | "REVIEW" | "URGENT";

  alertStatus?: "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
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

const getLocalDateKey = () => {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(
    2,
    "0"
  );
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

export default function ResidentOverview() {
  const router = useRouter();

  const { room, residentName } =
    useLocalSearchParams<{
      room?: string;
      residentName?: string;
    }>();

  const currentRoom =
    typeof room === "string" && room.trim()
      ? room.trim()
      : "";

  const routeResidentName =
    typeof residentName === "string" && residentName.trim()
      ? residentName.trim()
      : "Resident";

  const [resolvedResidentName, setResolvedResidentName] =
    useState(routeResidentName);

  const currentResidentName =
    resolvedResidentName || routeResidentName;

  useEffect(() => {
    if (!currentRoom) {
      console.warn(
        "Resident overview opened without a valid room.",
        {
          room,
          residentName,
        }
      );

      setResolvedResidentName(routeResidentName);
      return;
    }

    const residentQuery = query(
      collection(db, "residents"),
      where("room", "==", currentRoom)
    );

    const unsubscribe = onSnapshot(
      residentQuery,
      (snapshot) => {
        const matchingResident = snapshot.docs[0];

        const fullName = String(
          matchingResident?.data()?.fullName ?? ""
        ).trim();

        setResolvedResidentName(
          fullName || routeResidentName
        );
      },
      (error) => {
        console.error(
          "Could not resolve resident identity:",
          error
        );

        setResolvedResidentName(routeResidentName);
      }
    );

    return unsubscribe;
  }, [currentRoom, routeResidentName]);

  const todayKey = useMemo(
    () => getLocalDateKey(),
    []
  );

  const [medications, setMedications] = useState<
    MedicationRecord[]
  >([]);

  const [tasks, setTasks] = useState<
    CareTaskRecord[]
  >([]);

  const [notes, setNotes] = useState<
    CareNoteRecord[]
  >([]);

  const [incidents, setIncidents] = useState<
    IncidentPackageRecord[]
  >([]);

  const [loadedSections, setLoadedSections] = useState({
    medications: false,
    tasks: false,
    notes: false,
    incidents: false,
    health: false,
  });

  const [healthObservations, setHealthObservations] = useState<
    HealthObservationRecord[]
  >([]);

  useEffect(() => {
    if (!currentRoom) {
      console.warn(
        "Resident overview data cannot load without a valid room.",
        {
          room,
          residentName,
        }
      );

      setMedications([]);
      setTasks([]);
      setNotes([]);
      setIncidents([]);
      setHealthObservations([]);

      setLoadedSections({
        medications: true,
        tasks: true,
        notes: true,
        incidents: true,
        health: true,
      });

      return;
    }

    setLoadedSections({
      medications: false,
      tasks: false,
      notes: false,
      incidents: false,
      health: false,
    });

    const medicationQuery = query(
      collection(db, "residentMedications"),
      where("room", "==", currentRoom)
    );

    const unsubscribeMedications = onSnapshot(
      medicationQuery,
      (snapshot) => {
        const records = snapshot.docs.map((document) => ({
          ...(document.data() as Omit<MedicationRecord, "id">),
          id: document.id,
        }));

        setMedications(records);

        setLoadedSections((current) => ({
          ...current,
          medications: true,
        }));
      },
      (error) => {
        console.error(
          "Could not load overview medications:",
          error
        );

        setMedications([]);

        setLoadedSections((current) => ({
          ...current,
          medications: true,
        }));
      }
    );

    const taskQuery = query(
      collection(db, "residentCareTasks"),
      where("room", "==", currentRoom)
    );

    const unsubscribeTasks = onSnapshot(
      taskQuery,
      (snapshot) => {
        const records = snapshot.docs
          .map((document) => ({
            ...(document.data() as Omit<
              CareTaskRecord,
              "id"
            >),
            id: document.id,
          }))
          .filter(
            (task) => task.taskDate === todayKey
          );

        setTasks(records);

        setLoadedSections((current) => ({
          ...current,
          tasks: true,
        }));
      },
      (error) => {
        console.error(
          "Could not load overview tasks:",
          error
        );

        setTasks([]);

        setLoadedSections((current) => ({
          ...current,
          tasks: true,
        }));
      }
    );

    const notesQuery = query(
      collection(db, "residentCareNotes"),
      where("room", "==", currentRoom)
    );

    const unsubscribeNotes = onSnapshot(
      notesQuery,
      (snapshot) => {
        const records = snapshot.docs
          .map((document) => ({
            ...(document.data() as Omit<
              CareNoteRecord,
              "id"
            >),
            id: document.id,
          }))
          .sort(
            (a, b) =>
              getTimestampMillis(b.createdAt) -
              getTimestampMillis(a.createdAt)
          );

        setNotes(records);

        setLoadedSections((current) => ({
          ...current,
          notes: true,
        }));
      },
      (error) => {
        console.error(
          "Could not load overview notes:",
          error
        );

        setNotes([]);

        setLoadedSections((current) => ({
          ...current,
          notes: true,
        }));
      }
    );

    const incidentsQuery = query(
      collection(db, "incidentPackages"),
      where("room", "==", currentRoom)
    );

    const unsubscribeIncidents = onSnapshot(
      incidentsQuery,
      (snapshot) => {
        const records = snapshot.docs
          .map((document) => ({
            ...(document.data() as Omit<
              IncidentPackageRecord,
              "id"
            >),
            id: document.id,
          }))
          .sort(
            (a, b) =>
              getTimestampMillis(b.generatedAt) -
              getTimestampMillis(a.generatedAt)
          );

        setIncidents(records);

        setLoadedSections((current) => ({
          ...current,
          incidents: true,
        }));
      },
      (error) => {
        console.error(
          "Could not load overview incidents:",
          error
        );

        setIncidents([]);

        setLoadedSections((current) => ({
          ...current,
          incidents: true,
        }));
      }
    );
    
    const healthQuery = query(
      collection(db, "residentHealthObservations"),
      where("room", "==", currentRoom)
    );

    const unsubscribeHealth = onSnapshot(
      healthQuery,
      (snapshot) => {
        const records = snapshot.docs
          .map((document) => ({
            ...(document.data() as Omit<
              HealthObservationRecord,
              "id"
            >),
            id: document.id,
          }))
          .sort(
            (a, b) =>
              getTimestampMillis(b.createdAt) -
              getTimestampMillis(a.createdAt)
          );

        setHealthObservations(records);

        setLoadedSections((current) => ({
          ...current,
          health: true,
        }));
      },
      (error) => {
        console.error(
          "Could not load overview health observations:",
          error
        );

        setHealthObservations([]);

        setLoadedSections((current) => ({
          ...current,
          health: true,
        }));
      }
    );

    return () => {
      unsubscribeMedications();
      unsubscribeTasks();
      unsubscribeNotes();
      unsubscribeIncidents();
      unsubscribeHealth();
    };
  }, [currentRoom, todayKey]);

  const loading = !Object.values(
    loadedSections
  ).every(Boolean);

  const medicationDueCount = medications.filter(
    (item) => item.status === "DUE"
  ).length;

  const medicationCompletedCount =
    medications.filter(
      (item) => item.status === "COMPLETED"
    ).length;

  const prnCount = medications.filter(
    (item) => item.status === "PRN"
  ).length;

  const completedTaskCount = tasks.filter(
    (item) => item.status === "COMPLETED"
  ).length;

  const dueTaskCount = tasks.filter(
    (item) => item.status === "DUE"
  ).length;

  const pendingTaskCount = tasks.filter(
    (item) => item.status === "PENDING"
  ).length;

  const latestNote = notes[0];

  const importantNoteCount = notes.filter(
    (item) =>
      item.priority === "IMPORTANT" ||
      item.priority === "URGENT"
  ).length;

  const urgentNoteCount = notes.filter(
    (item) => item.priority === "URGENT"
  ).length;

  const fallIncidentCount = incidents.filter(
    (item) =>
      String(item.incidentType ?? "")
        .toLowerCase()
        .includes("fall")
  ).length;

  const latestIncident = incidents[0];

  const lastCompletedTask = [...tasks]
    .filter(
      (item) =>
        item.status === "COMPLETED" &&
        item.completedAt
    )
    .sort(
      (a, b) =>
        getTimestampMillis(b.completedAt) -
        getTimestampMillis(a.completedAt)
    )[0];

  const latestHealthObservation = healthObservations[0];

  const healthReviewCount = healthObservations.filter(
    (item) =>
      item.status === "REVIEW" &&
      item.alertStatus !== "RESOLVED"
  ).length;

  const urgentHealthCount = healthObservations.filter(
    (item) =>
      item.status === "URGENT" &&
      item.alertStatus !== "RESOLVED"
  ).length;

  const healthAlertRecords = healthObservations.filter(
    (item: any) =>
      item.status === "REVIEW" ||
      item.status === "URGENT"
  );

  const openHealthAlertCount = healthAlertRecords.filter(
    (item: any) =>
      !item.alertStatus ||
      item.alertStatus === "OPEN"
    ).length;

  const acknowledgedHealthAlertCount =
    healthAlertRecords.filter(
    (item: any) =>
      item.alertStatus === "ACKNOWLEDGED"
    ).length;

  const resolvedHealthAlertCount =
    healthAlertRecords.filter(
      (item: any) =>
        item.alertStatus === "RESOLVED"
    ).length;

  const activeUrgentHealthAlertCount =
    healthAlertRecords.filter(
      (item: any) =>
        item.status === "URGENT" &&
        item.alertStatus !== "RESOLVED"
    ).length;

  const latestHealthAlert = healthAlertRecords[0];

  const attentionRequired =
    medicationDueCount > 0 ||
    dueTaskCount > 0 ||
    urgentNoteCount > 0 ||
    openHealthAlertCount > 0 ||
    acknowledgedHealthAlertCount > 0;

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
          Loading resident overview...
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
        🧭 Resident Overview
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
          backgroundColor: attentionRequired
            ? "#3b2605"
            : "#0d2c22",
          borderRadius: 18,
          padding: 20,
          borderWidth: 1,
          borderColor: attentionRequired
            ? "#fbbf24"
            : "#22c55e",
        }}
      >
        <Text
          style={{
            color: attentionRequired
              ? "#fbbf24"
              : "#22c55e",
            fontSize: 28,
            fontWeight: "900",
          }}
        >
          {attentionRequired
            ? "⚠️ Attention Required"
            : "✅ Resident Overview Clear"}
        </Text>

        <Text
          style={{
            color: "#cfe2ff",
            fontSize: 17,
            lineHeight: 25,
            marginTop: 10,
          }}
        >
          {attentionRequired
            ? "One or more resident-care items require staff review."
            : "No urgent medication, task or care-note alerts are currently active."}
        </Text>
      </View>

      <Text
        style={{
          color: "#fff",
          fontSize: 29,
          fontWeight: "900",
          marginTop: 30,
        }}
      >
        📊 Live Care Summary
      </Text>

      <Pressable
        onPress={() =>
          router.push({
            pathname: "/resident-medication",
            params: {
              room: currentRoom,
              residentName:
                currentResidentName,
            },
          } as any)
        }
        style={{
          marginTop: 18,
          backgroundColor: "#081826",
          borderRadius: 18,
          padding: 20,
          borderWidth: 1,
          borderColor:
            medicationDueCount > 0
              ? "#fbbf24"
              : "#22c55e",
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 25,
            fontWeight: "900",
          }}
        >
          💊 Medication
        </Text>

        <Text
          style={{
            color:
              medicationDueCount > 0
                ? "#fbbf24"
                : "#22c55e",
            fontSize: 18,
            fontWeight: "900",
            marginTop: 12,
          }}
        >
          Due now: {medicationDueCount}
        </Text>

        <Text
          style={{
            color: "#cfe2ff",
            fontSize: 17,
            marginTop: 8,
          }}
        >
          Completed: {medicationCompletedCount}
        </Text>

        <Text
          style={{
            color: "#60a5fa",
            fontSize: 17,
            marginTop: 8,
          }}
        >
          PRN available: {prnCount}
        </Text>

        <Text
          style={{
            position: "absolute",
            right: 18,
            top: 18,
            color: "#93c5fd",
            fontSize: 28,
            fontWeight: "900",
          }}
        >
          ›
        </Text>
      </Pressable>

      <Pressable
        onPress={() =>
          router.push({
            pathname: "/resident-care-tasks",
            params: {
              room: currentRoom,
              residentName:
                currentResidentName,
            },
          } as any)
        }
        style={{
          marginTop: 18,
          backgroundColor: "#081826",
          borderRadius: 18,
          padding: 20,
          borderWidth: 1,
          borderColor:
            dueTaskCount > 0
              ? "#fbbf24"
              : "#0891b2",
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 25,
            fontWeight: "900",
          }}
        >
          ✅ Daily Care Tasks
        </Text>

        <Text
          style={{
            color: "#22c55e",
            fontSize: 18,
            fontWeight: "900",
            marginTop: 12,
          }}
        >
          Completed: {completedTaskCount}
        </Text>

        <Text
          style={{
            color: "#fbbf24",
            fontSize: 17,
            marginTop: 8,
          }}
        >
          Due: {dueTaskCount}
        </Text>

        <Text
          style={{
            color: "#60a5fa",
            fontSize: 17,
            marginTop: 8,
          }}
        >
          Pending: {pendingTaskCount}
        </Text>

        <Text
          style={{
            position: "absolute",
            right: 18,
            top: 18,
            color: "#93c5fd",
            fontSize: 28,
            fontWeight: "900",
          }}
        >
          ›
        </Text>
      </Pressable>

      <Pressable
        onPress={() =>
          router.push({
            pathname: "/resident-health-observations",
            params: {
              room: currentRoom,
              residentName: currentResidentName,
            },
          } as any)
        }
        style={{
          marginTop: 18,
          backgroundColor: "#081826",
          borderRadius: 18,
          padding: 20,
          borderWidth: 1,
          borderColor:
            urgentHealthCount > 0
              ? "#ef4444"
              : healthReviewCount > 0
              ? "#fbbf24"
              : "#0f766e",
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 25,
            fontWeight: "900",
          }}
        >
          🩺 Health Observations
        </Text>

        <Text
          style={{
            color:
              urgentHealthCount > 0
                ? "#ef4444"
                : healthReviewCount > 0
                ? "#fbbf24"
                : "#22c55e",
            fontSize: 18,
            fontWeight: "900",
            marginTop: 12,
          }}
        >
          {urgentHealthCount > 0
            ? `Urgent records: ${urgentHealthCount}`
            : healthReviewCount > 0
            ? `Awaiting review: ${healthReviewCount}`
            : "No active health alerts"}
        </Text>

        {latestHealthObservation ? (
          <>
            <Text
              style={{
                color: "#93c5fd",
                fontSize: 17,
                marginTop: 14,
              }}
            >
              Latest readings
            </Text>

            <Text
              style={{
                color: "#cfe2ff",
                fontSize: 17,
                lineHeight: 26,
                marginTop: 8,
              }}
            >
              {latestHealthObservation.temperature
                ? `Temperature: ${latestHealthObservation.temperature} °C\n`
                : ""}
              {latestHealthObservation.systolic &&
              latestHealthObservation.diastolic
                ? `Blood pressure: ${latestHealthObservation.systolic}/${latestHealthObservation.diastolic}\n`
                : ""}
              {latestHealthObservation.pulse
                ? `Pulse: ${latestHealthObservation.pulse} bpm\n`
                : ""}
              {latestHealthObservation.oxygenSaturation
                ? `Oxygen saturation: ${latestHealthObservation.oxygenSaturation}%`
                : ""}
            </Text>

            <Text
              style={{
                color: "#9ca3af",
                fontSize: 15,
                marginTop: 12,
              }}
            >
              {latestHealthObservation.staffName || "Unknown staff"} •{" "}
              {formatTimestamp(latestHealthObservation.createdAt)}
            </Text>
          </>
        ) : (
          <Text
            style={{
              color: "#cfe2ff",
              fontSize: 17,
              marginTop: 12,
            }}
          >
            No health observations recorded yet.
          </Text>
        )}

        <Text
          style={{
            position: "absolute",
            right: 18,
            top: 18,
            color: "#93c5fd",
            fontSize: 28,
            fontWeight: "900",
          }}
        >
          ›
        </Text>
      </Pressable>

      <Pressable
        onPress={() =>
          router.push({
            pathname: "/resident-health-alerts",
            params: {
              room: currentRoom,
              residentName: currentResidentName,
            },
          } as any)
        }
        style={{
          marginTop: 18,
          backgroundColor: "#081826",
          borderRadius: 18,
          padding: 20,
          borderWidth: 1,
          borderColor:
            activeUrgentHealthAlertCount > 0
              ? "#ef4444"
              : openHealthAlertCount > 0
              ? "#fbbf24"
              : acknowledgedHealthAlertCount > 0
              ? "#60a5fa"
              : "#22c55e",
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 25,
            fontWeight: "900",
          }}
        >
          🚨 Health Alerts
        </Text>

        <Text
          style={{
            color:
              activeUrgentHealthAlertCount > 0
                ? "#ef4444"
                : openHealthAlertCount > 0
                ? "#fbbf24"
                : acknowledgedHealthAlertCount > 0
                ? "#60a5fa"
                : "#22c55e",
            fontSize: 18,
            fontWeight: "900",
            marginTop: 12,
          }}
        >
          {activeUrgentHealthAlertCount > 0
            ? `Urgent active: ${activeUrgentHealthAlertCount}`
            : openHealthAlertCount > 0
            ? `Open alerts: ${openHealthAlertCount}`
            : acknowledgedHealthAlertCount > 0
            ? `Acknowledged: ${acknowledgedHealthAlertCount}`
            : "No active health alerts"}
        </Text>

        <Text
          style={{
            color: "#cfe2ff",
            fontSize: 17,
            marginTop: 8,
          }}
        >
          Open: {openHealthAlertCount}
        </Text>

        <Text
          style={{
            color: "#60a5fa",
            fontSize: 17,
            marginTop: 8,
          }}
        >
          Acknowledged: {acknowledgedHealthAlertCount}
        </Text>

        <Text
          style={{
            color: "#22c55e",
            fontSize: 17,
            marginTop: 8,
          }}
        >
          Resolved: {resolvedHealthAlertCount}
        </Text>

        {latestHealthAlert && (
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
                color:
                  latestHealthAlert.status === "URGENT"
                    ? "#ef4444"
                    : "#fbbf24",
                fontSize: 16,
                fontWeight: "900",
              }}
            >
              Latest severity:{" "}
              {latestHealthAlert.status === "URGENT"
                ? "URGENT"
                : "NEEDS REVIEW"}
            </Text>

            <Text
              style={{
                color: "#cfe2ff",
                fontSize: 16,
                marginTop: 8,
              }}
            >
              Workflow:{" "}
              {latestHealthAlert.alertStatus ?? "OPEN"}
            </Text>

            <Text
              style={{
                color: "#9ca3af",
                fontSize: 15,
                marginTop: 8,
              }}
            >
              {latestHealthAlert.staffName ||
                "Unknown staff"}{" "}
              •{" "}
              {formatTimestamp(
                latestHealthAlert.createdAt
              )}
            </Text>
          </View>
        )}

        <Text
          style={{
            position: "absolute",
            right: 18,
            top: 18,
            color: "#93c5fd",
            fontSize: 28,
            fontWeight: "900",
          }}
        >
          ›
        </Text>
      </Pressable>

      <Pressable
        onPress={() =>
          router.push({
            pathname: "/resident-care-notes",
            params: {
              room: currentRoom,
              residentName:
                currentResidentName,
            },
          } as any)
        }
        style={{
          marginTop: 18,
          backgroundColor: "#081826",
          borderRadius: 18,
          padding: 20,
          borderWidth: 1,
          borderColor:
            urgentNoteCount > 0
              ? "#ef4444"
              : importantNoteCount > 0
              ? "#fbbf24"
              : "#2563eb",
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 25,
            fontWeight: "900",
          }}
        >
          📝 Latest Care Observation
        </Text>

        {latestNote ? (
          <>
            <Text
              style={{
                color:
                  latestNote.priority === "URGENT"
                    ? "#ef4444"
                    : latestNote.priority ===
                      "IMPORTANT"
                    ? "#fbbf24"
                    : "#22c55e",
                fontSize: 17,
                fontWeight: "900",
                marginTop: 12,
              }}
            >
              {latestNote.priority ||
                "ROUTINE"}
            </Text>

            <Text
              style={{
                color: "#fff",
                fontSize: 20,
                fontWeight: "800",
                marginTop: 10,
              }}
            >
              {latestNote.category ||
                "General observation"}
            </Text>

            <Text
              style={{
                color: "#cfe2ff",
                fontSize: 17,
                lineHeight: 25,
                marginTop: 8,
              }}
              numberOfLines={4}
            >
              {latestNote.note ||
                "No observation text recorded."}
            </Text>

            <Text
              style={{
                color: "#9ca3af",
                fontSize: 15,
                marginTop: 12,
              }}
            >
              {latestNote.staffName ||
                "Unknown staff"}{" "}
              •{" "}
              {formatTimestamp(
                latestNote.createdAt
              )}
            </Text>
          </>
        ) : (
          <Text
            style={{
              color: "#cfe2ff",
              fontSize: 17,
              marginTop: 12,
            }}
          >
            No care observations recorded.
          </Text>
        )}

        <Text
          style={{
            position: "absolute",
            right: 18,
            top: 18,
            color: "#93c5fd",
            fontSize: 28,
            fontWeight: "900",
          }}
        >
          ›
        </Text>
      </Pressable>

      <Pressable
        onPress={() =>
          router.push({
            pathname: "/resident-fall-history",
            params: {
              room: currentRoom,
              residentName:
                currentResidentName,
            },
          } as any)
        }
        style={{
          marginTop: 18,
          backgroundColor: "#081826",
          borderRadius: 18,
          padding: 20,
          borderWidth: 1,
          borderColor:
            fallIncidentCount > 0
              ? "#ef4444"
              : "#22c55e",
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 25,
            fontWeight: "900",
          }}
        >
          📜 Fall and Incident Summary
        </Text>

        <Text
          style={{
            color:
              fallIncidentCount > 0
                ? "#ef4444"
                : "#22c55e",
            fontSize: 18,
            fontWeight: "900",
            marginTop: 12,
          }}
        >
          Recorded falls: {fallIncidentCount}
        </Text>

        <Text
          style={{
            color: "#cfe2ff",
            fontSize: 17,
            marginTop: 8,
          }}
        >
          Archived incidents: {incidents.length}
        </Text>

        {latestIncident && (
          <>
            <Text
              style={{
                color: "#93c5fd",
                fontSize: 17,
                marginTop: 12,
              }}
            >
              Latest incident
            </Text>

            <Text
              style={{
                color: "#fff",
                fontSize: 19,
                fontWeight: "900",
                marginTop: 5,
              }}
            >
              {latestIncident.incidentType ||
                "Incident"}
            </Text>

            <Text
              style={{
                color: "#9ca3af",
                fontSize: 15,
                marginTop: 8,
              }}
            >
              {formatTimestamp(
                latestIncident.generatedAt
              )}
            </Text>
          </>
        )}

        <Text
          style={{
            position: "absolute",
            right: 18,
            top: 18,
            color: "#93c5fd",
            fontSize: 28,
            fontWeight: "900",
          }}
        >
          ›
        </Text>
      </Pressable>

      <View
        style={{
          marginTop: 18,
          backgroundColor: "#081826",
          borderRadius: 18,
          padding: 20,
          borderWidth: 1,
          borderColor: "#374151",
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 25,
            fontWeight: "900",
          }}
        >
          👤 Last Staff Activity
        </Text>

        {lastCompletedTask ? (
          <>
            <Text
              style={{
                color: "#22c55e",
                fontSize: 19,
                fontWeight: "900",
                marginTop: 12,
              }}
            >
              {lastCompletedTask.title ||
                "Completed care task"}
            </Text>

            <Text
              style={{
                color: "#cfe2ff",
                fontSize: 17,
                marginTop: 8,
              }}
            >
              Staff:{" "}
              {lastCompletedTask.completedBy ||
                "Unknown staff"}
            </Text>

            <Text
              style={{
                color: "#9ca3af",
                fontSize: 15,
                marginTop: 8,
              }}
            >
              {formatTimestamp(
                lastCompletedTask.completedAt
              )}
            </Text>
          </>
        ) : latestNote ? (
          <>
            <Text
              style={{
                color: "#93c5fd",
                fontSize: 19,
                fontWeight: "900",
                marginTop: 12,
              }}
            >
              Care observation recorded
            </Text>

            <Text
              style={{
                color: "#cfe2ff",
                fontSize: 17,
                marginTop: 8,
              }}
            >
              Staff:{" "}
              {latestNote.staffName ||
                "Unknown staff"}
            </Text>

            <Text
              style={{
                color: "#9ca3af",
                fontSize: 15,
                marginTop: 8,
              }}
            >
              {formatTimestamp(
                latestNote.createdAt
              )}
            </Text>
          </>
        ) : (
          <Text
            style={{
              color: "#cfe2ff",
              fontSize: 17,
              marginTop: 12,
            }}
          >
            No recent staff activity recorded.
          </Text>
        )}
      </View>

      <Pressable
        onPress={() =>
          Alert.alert(
            "Resident risk summary",
            "High fall risk. Uses a walking frame. Night observations are required every two hours. Medication assistance is required."
          )
        }
        style={{
          marginTop: 22,
          backgroundColor: "#3b2605",
          borderRadius: 18,
          padding: 20,
          borderWidth: 1,
          borderColor: "#fbbf24",
        }}
      >
        <Text
          style={{
            color: "#fbbf24",
            fontSize: 24,
            fontWeight: "900",
          }}
        >
          ⚠️ Risk Summary
        </Text>

        <Text
          style={{
            color: "#fef3c7",
            fontSize: 17,
            lineHeight: 25,
            marginTop: 10,
          }}
        >
          High fall risk • Walking frame •
          Two-hour observations • Medication
          assistance
        </Text>
      </Pressable>

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