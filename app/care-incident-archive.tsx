import { useRouter } from "expo-router";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { db } from "../lib/firebase";

type IncidentPackageRecord = {
  id: string;
  incidentId: string;
  room: string;
  incidentType: string;
  assignedStaff: string;
  finalStage: string;
  snapshotCount: number;
  timelineCount: number;
  pdfDownloadUrl: string;
  storagePath: string;
  status: string;
  generatedAt?: any;
  updatedAt?: any;
};

const formatTimestamp = (timestamp: any) => {
  if (typeof timestamp?.toDate === "function") {
    return timestamp.toDate().toLocaleString();
  }

  return "Date unavailable";
};

export default function CareIncidentArchive() {
  const router = useRouter();

  const [packages, setPackages] = useState<IncidentPackageRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const packagesQuery = query(
      collection(db, "incidentPackages"),
      orderBy("generatedAt", "desc")
    );

    const unsubscribe = onSnapshot(
      packagesQuery,
      (snapshot) => {
        const records = snapshot.docs.map((document) => ({
          id: document.id,
          ...(document.data() as Omit<IncidentPackageRecord, "id">),
        }));

        const validRecords = records.filter((item) => {
          const recordId = String(item?.id ?? "").trim();
          const incidentId = String(item?.incidentId ?? "").trim();
          const room = String(item?.room ?? "").trim();

          return Boolean(recordId && incidentId && room);
        });

        setPackages(validRecords);
        setLoading(false);
      },
      (error) => {
        console.error("Could not load incident archive:", error);
        setLoading(false);

        Alert.alert(
          "Archive unavailable",
          "The incident archive could not be loaded."
        );
      }
    );

    return unsubscribe;
  }, []);

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
        🗄️ Incident Archive
      </Text>

      <Text
        style={{
          color: "#93c5fd",
          fontSize: 20,
          marginTop: 8,
        }}
      >
        Permanent care incident records
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
          📊 Archive Summary
        </Text>

        <Text
          style={{
            color: "#cfe2ff",
            fontSize: 18,
            marginTop: 10,
          }}
        >
          Total incident packages: {packages.length}
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
            Loading incident archive...
          </Text>
        </View>
      ) : packages.length === 0 ? (
        <View
          style={{
            marginTop: 30,
            backgroundColor: "#081826",
            borderRadius: 18,
            padding: 22,
            borderWidth: 1,
            borderColor: "#374151",
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontSize: 22,
              fontWeight: "900",
            }}
          >
            No archived packages yet
          </Text>

          <Text
            style={{
              color: "#cfe2ff",
              fontSize: 17,
              marginTop: 8,
            }}
          >
            Generated incident packages will appear here automatically.
          </Text>
        </View>
      ) : (
        packages.map((item) => (
          <View
            key={item.id}
            style={{
              marginTop: 22,
              backgroundColor: "#081826",
              borderRadius: 18,
              padding: 20,
              borderWidth: 1,
              borderColor:
                item.status === "READY" ? "#22c55e" : "#fbbf24",
            }}
          >
            <Text
              style={{
                color: "#fff",
                fontSize: 28,
                fontWeight: "900",
              }}
            >
              📁 {String(item.room).trim()}
            </Text>

            <Text
              style={{
                color: "#93c5fd",
                fontSize: 18,
                marginTop: 6,
              }}
            >
              {item.incidentType || "Incident"}
            </Text>

            <Text
              style={{
                color: "#22c55e",
                fontSize: 17,
                fontWeight: "800",
                marginTop: 12,
              }}
            >
              ✅ {item.status || "READY"}
            </Text>

            <Text
              style={{
                color: "#cfe2ff",
                fontSize: 16,
                marginTop: 12,
              }}
            >
              Incident ID: {item.incidentId}
            </Text>

            <Text
              style={{
                color: "#cfe2ff",
                fontSize: 16,
                marginTop: 7,
              }}
            >
              Assigned staff: {item.assignedStaff || "Unassigned"}
            </Text>

            <Text
              style={{
                color: "#cfe2ff",
                fontSize: 16,
                marginTop: 7,
              }}
            >
              Final stage: {item.finalStage || "Unknown"}
            </Text>

            <Text
              style={{
                color: "#cfe2ff",
                fontSize: 16,
                marginTop: 7,
              }}
            >
              📸 Snapshot evidence: {item.snapshotCount ?? 0}
            </Text>

            <Text
              style={{
                color: "#cfe2ff",
                fontSize: 16,
                marginTop: 7,
              }}
            >
              🕒 Timeline events: {item.timelineCount ?? 0}
            </Text>

            <Text
              style={{
                color: "#9ca3af",
                fontSize: 15,
                marginTop: 10,
              }}
            >
              Archived: {formatTimestamp(item.generatedAt)}
            </Text>

            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/care-package-actions",
                  params: {
                    incidentId: item.incidentId,
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
          padding: 15,
          borderRadius: 12,
          marginTop: 28,
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
          ← Back
        </Text>
      </Pressable>
    </ScrollView>
  );
  }