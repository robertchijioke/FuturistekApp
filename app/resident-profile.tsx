import { useLocalSearchParams, useRouter } from "expo-router";
import { collection, doc, onSnapshot, query, where, } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useIncident } from "../context/IncidentContext";
import { db } from "../lib/firebase";

type ResidentRecord = {
  id: string;
  fullName: string;
  room: string;
  age?: number;
  dateOfBirth?: string;
  status?: "SAFE" | "ATTENTION" | "CRITICAL";
  activity?: string;
  fallRisk?: "LOW" | "MEDIUM" | "HIGH";
  mobilitySupport?: string;
  observationFrequency?: string;
  medicationAssistance?: boolean;
  emergencyContact?: string;
};

export default function ResidentProfile() {
  const router = useRouter();

  const [resident, setResident] =
    useState<ResidentRecord | null>(null);
  const [loadingResident, setLoadingResident] =
    useState(true);
  const [activeCareEvent, setActiveCareEvent] =
    useState<any | null>(null);

  const { incident } = useIncident()

  const {
  residentId,
  residentName,
  room,
  status,
  activity,
} = useLocalSearchParams<{
  residentId?: string;
  residentName?: string;
  room?: string;
  status?: string;
  activity?: string;
}>();

useEffect(() => {
  const currentResidentId =
    typeof residentId === "string" && residentId.trim()
      ? residentId.trim()
      : "";

  if (!currentResidentId) {
    console.warn(
      "Resident profile opened without a valid resident ID.",
      {
        residentId,
        room,
        residentName,
      }
    );

    setResident({
      id: "",
      fullName:
        typeof residentName === "string" && residentName.trim()
          ? residentName.trim()
          : "Resident",
      room:
        typeof room === "string" && room.trim()
          ? room.trim()
          : "",
      status:
        status === "ATTENTION" ||
        status === "CRITICAL"
          ? status
          : "SAFE",
      activity:
        typeof activity === "string"
          ? activity
          : "No activity",
      age: 0,
      fallRisk: "HIGH",
      mobilitySupport: "Not recorded",
      observationFrequency: "Not recorded",
      medicationAssistance: false,
    });

    setLoadingResident(false);
    return;
  }

  const unsubscribe = onSnapshot(
    doc(db, "residents", currentResidentId),
    (snapshot) => {
      if (!snapshot.exists()) {
        setResident(null);
        setLoadingResident(false);
        return;
      }

      setResident({
        ...(snapshot.data() as Omit<
          ResidentRecord,
          "id"
        >),
        id: snapshot.id,
      });

      setLoadingResident(false);
    },
    (error) => {
      console.error(
        "Could not load resident profile:",
        error
      );

      setLoadingResident(false);
    }
  );

  return unsubscribe;
}, [
  residentId,
  residentName,
  room,
  status,
  activity,
]);

useEffect(() => {
  if (typeof residentId !== "string" || !residentId.trim()) {
    setActiveCareEvent(null);
    return;
  }

  const activeIncidentQuery = query(
    collection(db, "careEvents"),
    where("residentId", "==", residentId.trim()),
    where("status", "==", "active")
  );

  const unsubscribe = onSnapshot(
    activeIncidentQuery,
    (snapshot) => {
      const activeEvents: any[] = snapshot.docs
        .map((document) => ({
          id: document.id,
          ...document.data(),
        }))
        .sort((a, b) => {
          const getTime = (item: any) => {
            if (
              typeof item.createdAt?.toMillis ===
              "function"
            ) {
              return item.createdAt.toMillis();
            }

            return Number(
              item.createdAt?.seconds ?? 0
            ) * 1000;
          };

          return getTime(b) - getTime(a);
        });

      setActiveCareEvent(activeEvents[0] ?? null);
    },
    (error) => {
      console.error(
        "Could not load resident emergency status:",
        error
      );
      setActiveCareEvent(null);
    }
  );

  return unsubscribe;
}, [residentId]);

const activeSeverity = String(
  activeCareEvent?.severity ?? ""
)
  .trim()
  .toUpperCase();

const liveResidentStatus = activeCareEvent
  ? activeSeverity === "HIGH" ||
    activeSeverity === "CRITICAL"
    ? "CRITICAL"
    : "ATTENTION"
  : resident?.status ?? "SAFE";

if (loadingResident) {
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
        👤 Loading resident profile...
      </Text>
    </View>
  );
}

if (!resident) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#061826",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <Text
        style={{
          color: "#ef4444",
          fontSize: 25,
          fontWeight: "900",
          textAlign: "center",
        }}
      >
        Resident record unavailable
      </Text>

      <Pressable
        onPress={() => router.back()}
        style={{
          backgroundColor: "#374151",
          padding: 16,
          borderRadius: 14,
          marginTop: 24,
          width: "100%",
        }}
      >
        <Text
          style={{
            color: "#fff",
            textAlign: "center",
            fontSize: 18,
            fontWeight: "900",
          }}
        >
          ← Back
        </Text>
      </Pressable>
    </View>
  );
}

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#061826" }}
      contentContainerStyle={{
        padding: 24,
        paddingTop: 70,
        paddingBottom: 80,
      }}
    >
      <Text
        style={{
          color: "#fff",
          fontSize: 46,
          fontWeight: "900",
        }}
      >
        👤 Resident Profile
      </Text>

      <View
        style={{
          backgroundColor: "#0f2d49",
          borderRadius: 20,
          padding: 20,
          marginTop: 24,
        }}
      >
        <Text style={{ color: "#9fc8ff", fontSize: 18 }}>
          Resident
        </Text>

        <Text
          style={{
            color: "#fff",
            fontSize: 32,
            fontWeight: "900",
          }}
        >
          {resident.fullName}
        </Text>

        <Text
          style={{
            color: "#9fc8ff",
            fontSize: 18,
            marginTop: 16,
          }}
        >
          Room
        </Text>

        <Text
          style={{
            color: "#fff",
            fontSize: 26,
            fontWeight: "800",
          }}
        >
          {resident.room}
        </Text>

        <Text
          style={{
            color: "#9fc8ff",
            fontSize: 18,
            marginTop: 16,
          }}
        >
          Age
        </Text>

        <Text
          style={{
            color: "#fff",
            fontSize: 24,
            fontWeight: "700",
          }}
        >
          {resident.age
            ? `${resident.age} years`
            : "Age not recorded"}
        </Text>

        <Text
          style={{
            color:
              liveResidentStatus === "CRITICAL"
                ? "#ef4444"
                : liveResidentStatus === "ATTENTION"
                  ? "#f59e0b"
                  : "#22c55e",
            fontSize: 22,
            fontWeight: "800",
            marginTop: 18,
          }}
        >
          {liveResidentStatus === "CRITICAL"
            ? "🔴 Current Status: Critical"
            : liveResidentStatus === "ATTENTION"
              ? "🟡 Current Status: Needs Attention"
              : "🟢 Current Status: Safe"}
        </Text>

        <Text style={{ color: "#cfe2ff", fontSize: 20, marginTop: 12 }}>
          Current Activity:{" "}
          {resident.activity || "No activity"}
        </Text>
      </View>

      <Pressable
        onPress={() =>
          router.push({
            pathname: "/resident-care-notes",
            params: {
              residentId: resident.id,
              room: resident.room,
              residentName: resident.fullName,
            },
          } as any)
        }
        style={{
          backgroundColor: "#0f2d49",
          borderRadius: 20,
          padding: 20,
          marginTop: 20,
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 26,
            fontWeight: "900",
          }}
        >
          📝 Care Notes
        </Text>

        <Text
          style={{
            color: "#cfe2ff",
            fontSize: 18,
            marginTop: 14,
            lineHeight: 28,
          }}
        >
          • Fall risk: {resident.fallRisk || "Not recorded"}
          {"\n"}•{" "}
          {resident.mobilitySupport || "Mobility support not recorded"}
          {"\n"}• Observations:{" "}
          {resident.observationFrequency || "Not recorded"}
          {"\n"}• Medication assistance:{" "}
          {resident.medicationAssistance ? "Required" : "Not required"}
        </Text>

        <Text
          style={{
            position: "absolute",
            right: 18,
            top: 20,
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
            pathname: "/resident-overview",
            params: {
              residentId: resident.id,
              residentName: resident.fullName,
              room: resident.room,
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
            fontSize: 22,
            fontWeight: "900",
          }}
        >
          🧭 Resident Overview
        </Text>
      </Pressable>

      <Pressable
        onPress={() =>
          router.push({
            pathname: "/resident-health-observations",
            params: {
              room:
                typeof room === "string"
                  ? room
                  : incident.room,
              residentName: "Mrs. Elizabeth Smith",
            },
          } as any)
        }
        style={{
          backgroundColor: "#0f766e",
          padding: 18,
          borderRadius: 16,
          marginTop: 16,
        }}
      >
        <Text
          style={{
            color: "#fff",
            textAlign: "center",
            fontSize: 22,
            fontWeight: "900",
          }}
        >
          🩺 Health Observations
        </Text>
      </Pressable>

      <Pressable
        onPress={() =>
          router.push({
            pathname: "/resident-health-alerts",
            params: {
              room:
                typeof room === "string"
                  ? room
                  : incident.room,
              residentName: "Mrs. Elizabeth Smith",
            },
          } as any)
        }
        style={{
          backgroundColor: "#b45309",
          padding: 18,
          borderRadius: 16,
          marginTop: 16,
        }}
      >
        <Text
          style={{
            color: "#fff",
            textAlign: "center",
            fontSize: 22,
            fontWeight: "900",
          }}
        >
          🚨 Health Alerts
        </Text>
      </Pressable>

      <Pressable
        onPress={() =>
          router.push({
            pathname: "/care-emergency",
            params: {
              residentId: resident.id,
              room: resident.room,
              residentName: resident.fullName,
            },
          } as any)
        }
        style={{
          backgroundColor: "#dc2626",
          padding: 18,
          borderRadius: 16,
          marginTop: 24,
        }}
      >
        <Text
          style={{
            color: "#fff",
            textAlign: "center",
            fontSize: 22,
            fontWeight: "800",
          }}
        >
          🚨 Open Care Emergency
        </Text>
      </Pressable>

      <Pressable
        onPress={() =>
          router.push({
            pathname: "/resident-fall-history",
            params: {
              room:
                typeof room === "string"
                  ? room
                  : incident.room,
              residentName: "Mrs. Elizabeth Smith",
            },
          } as any)
        }
        style={{
          backgroundColor: "#2563eb",
          padding: 18,
          borderRadius: 16,
          marginTop: 16,
        }}
      >
        <Text
          style={{
            color: "#fff",
            textAlign: "center",
            fontSize: 22,
            fontWeight: "800",
          }}
        >
          📜 Fall History
        </Text>
      </Pressable>

      <Pressable
        onPress={() =>
          router.push({
            pathname: "/resident-medication",
            params: {
              room:
                typeof room === "string"
                  ? room
                  : incident.room,
              residentName: "Mrs. Elizabeth Smith",
            },
          } as any)
        }
        style={{
          backgroundColor: "#16a34a",
          padding: 18,
          borderRadius: 16,
          marginTop: 16,
        }}
      >
        <Text
          style={{
            color: "#fff",
            textAlign: "center",
            fontSize: 22,
            fontWeight: "800",
          }}
        >
          💊 Medication
        </Text>
      </Pressable>

      <Pressable
        onPress={() =>
          router.push({
            pathname: "/resident-care-tasks",
            params: {
              room:
                typeof room === "string"
                  ? room
                  : incident.room,
              residentName: "Mrs. Elizabeth Smith",
            },
          } as any)
        }
        style={{
          backgroundColor: "#0891b2",
          padding: 18,
          borderRadius: 16,
          marginTop: 16,
        }}
      >
        <Text
          style={{
            color: "#fff",
            textAlign: "center",
            fontSize: 22,
            fontWeight: "800",
          }}
        >
          ✅ Daily Care Tasks
        </Text>
      </Pressable>

      <Pressable
        onPress={() => router.back()}
        style={{
          backgroundColor: "#374151",
          padding: 18,
          borderRadius: 16,
          marginTop: 16,
        }}
      >
        <Text
          style={{
            color: "#fff",
            textAlign: "center",
            fontSize: 22,
            fontWeight: "800",
          }}
        >
          ← Back
        </Text>
      </Pressable>
    </ScrollView>
  );
}