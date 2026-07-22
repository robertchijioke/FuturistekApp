import { useLocalSearchParams, useRouter } from "expo-router";
import {
  collection,
  getDocs,
  onSnapshot, query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { db } from "../lib/firebase";

type AdministrationHistoryRecord = {
  id: string;
  residentId?: string;
  medicationId?: string;
  medicationName?: string;
  room?: string;
  residentName?: string;
  dose?: string;
  route?: string;
  status?: string;
  administeredAt?: any;
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

export default function MedicationAdministrationHistory() {
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

  const currentResidentName =
    typeof residentName === "string" &&
    residentName.trim()
      ? residentName.trim()
      : "Resident";

  const currentResidentId =
    typeof residentId === "string" &&
    residentId.trim()
      ? residentId.trim()
      : currentRoom
        ? currentRoom
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")
        : "";

  const [records, setRecords] = useState<
    AdministrationHistoryRecord[]
  >([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentResidentId) {
      console.warn(
        "Medication history opened without a valid resident ID.",
        {
          residentId,
          room: currentRoom,
        }
      );

      setRecords([]);
      setLoading(false);
      return;
    }

    const migrateLegacyMedicationHistory = async () => {

      if (!currentRoom) {
        console.log(
          "No valid room supplied. Skipping legacy medication-history migration.",
          {
            residentId: currentResidentId,
          }
        );

        return;
      }

      const legacyQuery = query(
        collection(
          db,
          "medicationAdministrationHistory"
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
          "✅ NO LEGACY MEDICATION HISTORY TO MIGRATE:",
          {
            residentId: currentResidentId,
            room: currentRoom,
          }
        );

        return;
      }

      const batch = writeBatch(db);

      legacyRecords.forEach((document) => {
        batch.update(document.ref, {
          residentId: currentResidentId,
          residentName:
            document.data().residentName ||
            currentResidentName,
          migratedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      await batch.commit();

      console.log(
        "✅ LEGACY MEDICATION HISTORY MIGRATED:",
        {
          residentId: currentResidentId,
          room: currentRoom,
          count: legacyRecords.length,
        }
      );
    };

    migrateLegacyMedicationHistory().catch(
      (error) => {
        console.error(
          "Could not migrate legacy medication history:",
          error
        );
      }
    );

    const historyQuery = query(
      collection(
        db,
        "medicationAdministrationHistory"
      ),
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
              AdministrationHistoryRecord,
              "id"
            >),
          }))
          .sort(
            (a, b) =>
              getTimestampMillis(b.administeredAt) -
              getTimestampMillis(a.administeredAt)
          );

        setRecords(history);
        setLoading(false);

        console.log(
          "💊 MEDICATION HISTORY LOADED:",
          {
            residentId: currentResidentId,
            room: currentRoom,
            count: history.length,
          }
        );
      },
      (error) => {
        console.error(
          "Could not load medication history:",
          error
        );

        setLoading(false);

        Alert.alert(
          "History unavailable",
          "The medication administration history could not be loaded."
        );
      }
    );

    return unsubscribe;
  }, [
    currentResidentId,
    currentRoom,
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
          fontSize: 40,
          fontWeight: "900",
        }}
      >
        📚 Medication History
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
          borderColor: "#7c3aed",
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 23,
            fontWeight: "900",
          }}
        >
          📊 Administration Summary
        </Text>

        <Text
          style={{
            color: "#cfe2ff",
            fontSize: 18,
            marginTop: 12,
          }}
        >
          Recorded administrations: {records.length}
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
            Loading medication history...
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
            ✅ No administrations recorded
          </Text>

          <Text
            style={{
              color: "#cfe2ff",
              fontSize: 17,
              marginTop: 10,
              lineHeight: 25,
            }}
          >
            Confirmed medication administrations
            will appear here automatically.
          </Text>
        </View>
      ) : (
        records.map((item, index) => (
          <View
            key={item.id}
            style={{
              marginTop: 20,
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
                fontSize: 25,
                fontWeight: "900",
              }}
            >
              💊 {item.medicationName ||
                "Medication"}
            </Text>

            <Text
              style={{
                color: "#22c55e",
                fontSize: 18,
                fontWeight: "900",
                marginTop: 10,
              }}
            >
              ✅ {item.status || "ADMINISTERED"}
            </Text>

            <Text
              style={{
                color: "#93c5fd",
                fontSize: 17,
                marginTop: 14,
              }}
            >
              Record #{records.length - index}
            </Text>

            <Text
              style={{
                color: "#cfe2ff",
                fontSize: 17,
                marginTop: 9,
              }}
            >
              Dose: {item.dose || "Not recorded"}
            </Text>

            <Text
              style={{
                color: "#cfe2ff",
                fontSize: 17,
                marginTop: 9,
              }}
            >
              Route: {item.route || "Not recorded"}
            </Text>

            <View
              style={{
                marginTop: 16,
                backgroundColor: "#0d2942",
                borderRadius: 12,
                padding: 14,
              }}
            >
              <Text
                style={{
                  color: "#cfe2ff",
                  fontSize: 16,
                }}
              >
                Administered at
              </Text>

              <Text
                style={{
                  color: "#fff",
                  fontSize: 18,
                  fontWeight: "900",
                  marginTop: 5,
                }}
              >
                {formatTimestamp(
                  item.administeredAt
                )}
              </Text>
            </View>

            <Text
              style={{
                color: "#9ca3af",
                fontSize: 15,
                marginTop: 14,
              }}
            >
              Medication ID:{" "}
              {item.medicationId || "Unavailable"}
            </Text>
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