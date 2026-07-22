import { useLocalSearchParams, useRouter } from "expo-router";
import {
  collection,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { db } from "../lib/firebase";

type FallHistoryRecord = {
  id: string;
  residentId?: string;
  residentName?: string;
  incidentId?: string;
  room?: string;
  incidentType?: string;
  assignedStaff?: string;
  finalStage?: string;
  snapshotCount?: number;
  timelineCount?: number;
  status?: string;
  generatedAt?: any;
};

const formatDate = (timestamp: any) => {
  if (typeof timestamp?.toDate === "function") {
    return timestamp.toDate().toLocaleString();
  }

  return "Date unavailable";
};

export default function ResidentFallHistory() {
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
          "Fall history opened without a valid room.",
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

          console.log("👤 FALL HISTORY RESIDENT RESOLVED:", {
            room: currentRoom,
            residentId: matchingResident?.id ?? null,
            residentName: fullName || routeResidentName,
          });
        },
        (error) => {
          console.error(
            "Could not resolve Fall History resident:",
            error
          );

          setResolvedResidentName(routeResidentName);
        }
      );

      return unsubscribe;
    }, [currentRoom, routeResidentName]);

  const currentResidentId =
    typeof residentId === "string" && residentId.trim()
      ? residentId.trim()
      : currentRoom
        ? currentRoom
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")
        : "";

  const [records, setRecords] = useState<FallHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentResidentId) {
      console.warn(
        "Fall history cannot load without a valid resident ID.",
        {
          residentId,
          room: currentRoom,
        }
      );

      setRecords([]);
      setLoading(false);
      return;
    }

    const migrateLegacyFallHistory = async () => {

      if (!currentRoom) {
        console.log(
          "No valid room supplied. Skipping legacy fall-history migration.",
          {
            residentId: currentResidentId,
          }
        );

        return;
      }

      const legacyQuery = query(
        collection(db, "incidentPackages"),
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
          "✅ NO LEGACY FALL HISTORY TO MIGRATE:",
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
        "✅ LEGACY FALL HISTORY MIGRATED:",
        {
          residentId: currentResidentId,
          room: currentRoom,
          count: legacyRecords.length,
        }
      );
    };

    migrateLegacyFallHistory().catch(
      (error) => {
        console.error(
          "Could not migrate legacy fall history:",
          error
        );
      }
    );

    const historyQuery = query(
      collection(db, "incidentPackages"),
      where(
        "residentId",
        "==",
        currentResidentId
      )
    );

    const unsubscribe = onSnapshot(
      historyQuery,
      (snapshot) => {
        const history = snapshot.docs
          .map((document) => ({
            id: document.id,
            ...(document.data() as Omit<
              FallHistoryRecord,
              "id"
            >),
          }))
          .filter((item) =>
            String(item.incidentType ?? "")
              .toLowerCase()
              .includes("fall")
          )
          .sort((a, b) => {
            const getTime = (timestamp: any) => {
              if (typeof timestamp?.toMillis === "function") {
                return timestamp.toMillis();
              }

              if (typeof timestamp?.seconds === "number") {
                return timestamp.seconds * 1000;
              }

              return 0;
            };

            return getTime(b.generatedAt) - getTime(a.generatedAt);
          });

        setRecords(history);
        setLoading(false);
      },
      (error) => {
        console.error("Could not load fall history:", error);
        setLoading(false);

        Alert.alert(
          "Fall history unavailable",
          "The resident's fall history could not be loaded."
        );
      }
    );

    return unsubscribe;
  }, [
    currentResidentId,
    currentRoom,
    currentResidentName,
  ]);

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
        📜 Fall History
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
          padding: 18,
          borderWidth: 1,
          borderColor: "#2563eb",
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 22,
            fontWeight: "900",
          }}
        >
          📊 Fall Summary
        </Text>

        <Text
          style={{
            color: "#cfe2ff",
            fontSize: 18,
            marginTop: 10,
          }}
        >
          Recorded falls: {records.length}
        </Text>
      </View>

      {loading ? (
        <View
          style={{
            marginTop: 50,
            alignItems: "center",
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
            Loading fall history...
          </Text>
        </View>
      ) : records.length === 0 ? (
        <View
          style={{
            marginTop: 28,
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
              fontSize: 24,
              fontWeight: "900",
            }}
          >
            ✅ No recorded falls
          </Text>

          <Text
            style={{
              color: "#cfe2ff",
              fontSize: 17,
              marginTop: 10,
            }}
          >
            No archived fall incidents were found for {currentRoom}.
          </Text>
        </View>
      ) : (
        records.map((item, index) => (
          <View
            key={item.id}
            style={{
              marginTop: 22,
              backgroundColor: "#081826",
              borderRadius: 18,
              padding: 20,
              borderWidth: 1,
              borderColor: "#ef4444",
            }}
          >
            <Text
              style={{
                color: "#fff",
                fontSize: 26,
                fontWeight: "900",
              }}
            >
              🚨 Fall Incident #{records.length - index}
            </Text>

            <Text
              style={{
                color: "#93c5fd",
                fontSize: 18,
                marginTop: 8,
              }}
            >
              {item.incidentType || "Fall Detection"}
            </Text>

            <Text
              style={{
                color: "#cfe2ff",
                fontSize: 16,
                marginTop: 14,
              }}
            >
              Archived: {formatDate(item.generatedAt)}
            </Text>

            <Text
              style={{
                color: "#cfe2ff",
                fontSize: 16,
                marginTop: 8,
              }}
            >
              Assigned staff: {item.assignedStaff || "Unassigned"}
            </Text>

            <Text
              style={{
                color: "#cfe2ff",
                fontSize: 16,
                marginTop: 8,
              }}
            >
              Final stage: {item.finalStage || "Unknown"}
            </Text>

            <Text
              style={{
                color: "#cfe2ff",
                fontSize: 16,
                marginTop: 8,
              }}
            >
              📸 Snapshot evidence: {item.snapshotCount ?? 0}
            </Text>

            <Text
              style={{
                color: "#cfe2ff",
                fontSize: 16,
                marginTop: 8,
              }}
            >
              🕒 Timeline events: {item.timelineCount ?? 0}
            </Text>

            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/care-package-actions",
                  params: {
                    incidentId:
                      item.incidentId || item.id,
                  },
                } as any)
              }
              style={{
                backgroundColor: "#2563eb",
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
                📄 Open Incident Package
              </Text>
            </Pressable>
          </View>
        ))
      )}

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