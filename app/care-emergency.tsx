import { useLocalSearchParams, useRouter } from "expo-router";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";

import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useIncident } from "../context/IncidentContext";
import { db } from "../lib/firebase";
import { logTimeline } from "../utils/timeline";

export default function CareEmergency() {
  const router = useRouter();
  const { incident } = useIncident()

  const {
    residentId,
    room,
    residentName,
  } = useLocalSearchParams<{
    residentId?: string;
    room?: string;
    residentName?: string;
  }>();

  const selectedResidentId =
    typeof residentId === "string"
      ? residentId.trim()
      : "";

  const selectedRoom =
    typeof room === "string"
      ? room.trim()
      : "";

  const selectedResidentName =
    typeof residentName === "string"
      ? residentName.trim()
      : "Resident";

  const incidentMatchesSelectedResident =
    Boolean(incident) &&
    (
      (
        selectedResidentId &&
        String((incident as any)?.residentId ?? "") ===
          selectedResidentId
      ) ||
      (
        selectedRoom &&
        String(incident?.room ?? "").trim() === selectedRoom
      )
    );

  const incidentRoom =
    typeof incident?.room === "string"
      ? incident.room.trim()
      : "";

  const currentResidentId =
    typeof (incident as any)?.residentId === "string" &&
    (incident as any).residentId.trim()
      ? (incident as any).residentId.trim()
      : incidentRoom
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");

  const [currentResidentName, setCurrentResidentName] =
    useState("Resident");

  const [currentRoom, setCurrentRoom] =
    useState(incidentRoom);

  const [staffNotified, setStaffNotified] = useState(false);
  const [ambulanceRequested, setAmbulanceRequested] = useState(false);
  const [incidentAcknowledged, setIncidentAcknowledged] = useState(false);

  useEffect(() => {

    const hasActiveEmergency =
      Boolean(incidentRoom) &&
      incident?.id !== "NO-ACTIVE-INCIDENT" &&
      String(incident?.status ?? "")
        .trim()
        .toLowerCase() === "active";

    if (!hasActiveEmergency) {
      setCurrentResidentName("Resident");
      setCurrentRoom("");
      return;
    }

    if (!currentResidentId) {
      setCurrentResidentName("Resident");
      setCurrentRoom(incidentRoom);
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
          console.warn(
            "Emergency resident document not found:",
            currentResidentId
          );

          setCurrentResidentName("Resident");
          setCurrentRoom(incidentRoom);
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
          resolvedName || "Resident"
        );

        setCurrentRoom(
          resolvedRoom || incidentRoom
        );

        console.log("✅ EMERGENCY RESIDENT RESOLVED:", {
          residentId: snapshot.id,
          residentName: resolvedName || "Resident",
          room: resolvedRoom || incidentRoom,
        });
      },
      (error) => {
        console.warn(
          "Could not resolve emergency resident:",
          error
        );

        setCurrentResidentName("Resident");
        setCurrentRoom(incidentRoom);
      }
    );

      return unsubscribe;
  }, [
    incident?.id,
    incident?.status,
    incidentRoom,
    currentResidentId,
  ]);

  const markResidentSafe = async () => {
  const q = query(
    collection(db, "careEvents"),
    where("room", "==", currentRoom),
    where("status", "==", "active")
  );

  const snapshot = await getDocs(q);

  snapshot.forEach(async (eventDoc) => {
    await updateDoc(doc(db, "careEvents", eventDoc.id), {
      staffResponding: false,
      responseStatus: "RESOLVED",
      status: "resolved",
      resolvedAt: new Date(),
    });
  });

    await logTimeline(
    "care",
    currentRoom,
    "✅",
    "Resident marked safe",
    "resolved"
  );

    router.back();
  };

    if (!incidentMatchesSelectedResident) {
    return (
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          backgroundColor: "#031927",
          padding: 28,
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            color: "#ffffff",
            fontSize: 40,
            fontWeight: "900",
          }}
        >
          🏥 Care Emergency
        </Text>

        <View
          style={{
            marginTop: 32,
            backgroundColor: "#0d2942",
            borderRadius: 20,
            padding: 24,
            borderWidth: 1,
            borderColor: "#22c55e",
          }}
        >
          <Text
            style={{
              color: "#22c55e",
              fontSize: 27,
              fontWeight: "900",
            }}
          >
            ✅ No active emergency
          </Text>

          <Text
            style={{
              color: "#cfe2ff",
              fontSize: 19,
              lineHeight: 29,
              marginTop: 14,
            }}
          >
            No active emergency incident is currently linked to{" "}
            {selectedResidentName || selectedRoom}.
          </Text>
        </View>

        <Pressable
          onPress={() => router.back()}
          style={{
            marginTop: 28,
            backgroundColor: "#374151",
            borderRadius: 18,
            padding: 18,
          }}
        >
          <Text
            style={{
              color: "#ffffff",
              fontSize: 20,
              fontWeight: "900",
              textAlign: "center",
            }}
          >
            ← Back
          </Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#061826" }}
      contentContainerStyle={{ padding: 24, paddingTop: 70, paddingBottom: 80 }}
    >
      <Text
        style={{
          color: "#fff",
          fontSize: 46,
          fontWeight: "900",
        }}
      >
        🏥 Care Emergency
      </Text>

      <Text
        style={{
          color: "#ff6b6b",
          fontSize: 30,
          fontWeight: "800",
          marginTop: 20,
        }}
      >
        HIGH Priority Resident Alert
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
            fontWeight: "800",
          }}
        >
          {currentResidentName}
        </Text>

        <Text
          style={{
            color: "#93c5fd",
            fontSize: 20,
            marginTop: 6,
          }}
        >
          {currentRoom}
        </Text>

        <Text
          style={{
            color: "#9fc8ff",
            fontSize: 18,
            marginTop: 18,
          }}
        >
          AI Concern
        </Text>

        <Text
          style={{
            color: "#fff",
            fontSize: 28,
            fontWeight: "800",
          }}
        >
          Possible Fall Detected
        </Text>

        <Text
          style={{
            color: "#9fc8ff",
            marginTop: 22,
            fontSize: 18,
          }}
        >
          AI Confidence: 97%

          {"\n"}Threat Level: HIGH

          {"\n"}Immediate staff assessment recommended.
        </Text>
      </View>

      <Pressable
        onPress={async () => {
          if (incidentAcknowledged) return;

          setIncidentAcknowledged(true);

          const q = query(
            collection(db, "careEvents"),
            where("room", "==", currentRoom,),
            where("status", "==", "active")
          );

          const snapshot = await getDocs(q);

          snapshot.forEach(async (eventDoc) => {
            await updateDoc(doc(db, "careEvents", eventDoc.id), {
              acknowledged: true,
              acknowledgedBy: "Care Staff",
              acknowledgedAt: new Date(),
              responseStatus: "ACKNOWLEDGED",
            });
          });

          await logTimeline(
            "care",
            currentRoom,
            "👤",
            "Incident acknowledged by care staff",
            "incident_acknowledged"
          );

          alert("Incident acknowledged.");
        }}
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
            fontWeight: "800",
            fontSize: 22,
          }}
        >
          👤 Acknowledge Incident
        </Text>
      </Pressable>

     <Pressable
       onPress={async () => {
        if (staffNotified) return;

        setStaffNotified(true);

        await logTimeline(
          "care",
          currentRoom,
          "👩",
          "Care staff notified",
          "staff_notification"
        );
          const q = query(
            collection(db, "careEvents"),
            where("room", "==", currentRoom),
            where("status", "==", "active")
          );

          const snapshot = await getDocs(q);

          snapshot.forEach(async (eventDoc) => {
            await updateDoc(doc(db, "careEvents", eventDoc.id), {
              staffResponding: true,
              responseStatus: "IN_PROGRESS",
              status: "active",
            });
          });

          alert("Care staff notified.");
        }}
        style={{
          backgroundColor: "#2563eb",
          padding: 18,
          borderRadius: 16,
          marginTop: 24,
        }}
      >
        <Text
          style={{
            color: "#fff",
            textAlign: "center",
            fontWeight: "800",
            fontSize: 22,
          }}
        >
          👩🏿‍⚕️ Notify Care Staff
        </Text>
      </Pressable>

      <Pressable
          onPress={async () => {
            await logTimeline(
              "care",
              currentRoom,
              "📹",
              "Resident camera opened",
              "camera_view"
            );

            router.push("/camera-live" as any);
            alert("Camera view opened.");
          }}
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
            fontWeight: "800",
            fontSize: 22,
          }}
        >
          📹 View Resident Camera
        </Text>
      </Pressable>

      <Pressable
       onPress={async () => {
        if (ambulanceRequested) return;

        setAmbulanceRequested(true);

        await logTimeline(
          "care",
          currentRoom,
          "🚑",
          "Ambulance requested",
          "ambulance_request"
        );
        alert("Ambulance requested.");
      }}
        style={{
          backgroundColor: "#dc2626",
          padding: 18,
          borderRadius: 16,
          marginTop: 16,
        }}
      >
        <Text
          style={{
            color: "#fff",
            textAlign: "center",
            fontWeight: "800",
            fontSize: 22,
          }}
        >
          🚑 Request Ambulance
        </Text>
      </Pressable>

      <Pressable
        onPress={markResidentSafe}
        style={{
          backgroundColor: "#16a34a",
          padding: 18,
          borderRadius: 16,
          marginTop: 16,
          marginBottom: 40,
        }}
      >
        <Text
          style={{
            color: "#fff",
            textAlign: "center",
            fontWeight: "800",
            fontSize: 22,
          }}
        >
          ✅ Mark Resident Safe
        </Text>
      </Pressable>
    </ScrollView>
  );
}