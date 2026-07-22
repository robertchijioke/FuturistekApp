import { useLocalSearchParams, useRouter } from "expo-router";
import {
  collection, getDocs,
  onSnapshot, query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, Pressable, ScrollView, Text, View,
} from "react-native";
import { db } from "../lib/firebase";

type TaskHistoryRecord = {
  id: string;
  residentId?: string;
  taskId?: string;
  templateId?: string;
  taskTitle?: string;
  category?: string;
  residentName?: string;
  room?: string;
  taskDate?: string;
  completedBy?: string;
  status?: string;
  completedAt?: any;
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

const formatTaskDate = (taskDate?: string) => {
  if (!taskDate) {
    return "Date unavailable";
  }

  const parsed = new Date(`${taskDate}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return taskDate;
  }

  return parsed.toLocaleDateString([], {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

export default function ResidentCareTaskHistory() {
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
    TaskHistoryRecord[]
  >([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentResidentId) {
      console.warn(
        "Care task history opened without a valid resident ID.",
        {
          residentId,
          room: currentRoom,
        }
      );

      setRecords([]);
      setLoading(false);
      return;
    }

    const migrateLegacyTaskHistory = async () => {

      if (!currentRoom) {
        console.log(
          "No valid room supplied. Skipping legacy care-task migration.",
          {
            residentId: currentResidentId,
          }
        );

        return;
      }

      const legacyQuery = query(
        collection(
          db,
          "residentCareTaskHistory"
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
          "✅ NO LEGACY CARE TASK HISTORY TO MIGRATE:",
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
        "✅ LEGACY CARE TASK HISTORY MIGRATED:",
        {
          residentId: currentResidentId,
          room: currentRoom,
          count: legacyRecords.length,
        }
      );
    };

    migrateLegacyTaskHistory().catch(
      (error) => {
        console.error(
          "Could not migrate legacy care task history:",
          error
        );
      }
    );

    const historyQuery = query(
      collection(
        db,
        "residentCareTaskHistory"
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
              TaskHistoryRecord,
              "id"
            >),
          }))
          .sort(
            (a, b) =>
              getTimestampMillis(b.completedAt) -
              getTimestampMillis(a.completedAt)
          );

        setRecords(history);
        setLoading(false);

        console.log(
          "📚 CARE TASK HISTORY LOADED:",
          {
            room: currentRoom,
            count: history.length,
          }
        );
      },
      (error) => {
        console.error(
          "Could not load care task history:",
          error
        );

        setLoading(false);

        Alert.alert(
          "Task history unavailable",
          "The resident's completed care tasks could not be loaded."
        );
      }
    );

    return unsubscribe;
  }, [
    currentResidentId,
    currentRoom,
    currentResidentName,
  ]);

  const todayKey = (() => {
    const today = new Date();

    const year = today.getFullYear();
    const month = String(
      today.getMonth() + 1
    ).padStart(2, "0");
    const day = String(
      today.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  })();

  const completedToday = records.filter(
    (record) => record.taskDate === todayKey
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
    >
      <Text
        style={{
          color: "#fff",
          fontSize: 40,
          fontWeight: "900",
        }}
      >
        📚 Care Task History
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
            fontSize: 24,
            fontWeight: "900",
          }}
        >
          📊 Completion Summary
        </Text>

        <Text
          style={{
            color: "#cfe2ff",
            fontSize: 18,
            marginTop: 14,
          }}
        >
          Total completed tasks: {records.length}
        </Text>

        <Text
          style={{
            color: "#22c55e",
            fontSize: 18,
            marginTop: 8,
            fontWeight: "800",
          }}
        >
          Completed today: {completedToday}
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
            Loading care task history...
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
            ✅ No completed tasks yet
          </Text>

          <Text
            style={{
              color: "#cfe2ff",
              fontSize: 17,
              lineHeight: 25,
              marginTop: 10,
            }}
          >
            Completed daily care tasks will appear
            here automatically.
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
            <View
              style={{
                alignSelf: "flex-start",
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
                ✅ Completed
              </Text>
            </View>

            <Text
              style={{
                color: "#fff",
                fontSize: 25,
                fontWeight: "900",
                marginTop: 14,
              }}
            >
              {item.taskTitle ||
                "Completed care task"}
            </Text>

            <Text
              style={{
                color: "#93c5fd",
                fontSize: 17,
                marginTop: 8,
              }}
            >
              {item.category || "Care task"}
            </Text>

            <Text
              style={{
                color: "#cfe2ff",
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
                marginTop: 8,
              }}
            >
              Task date:{" "}
              {formatTaskDate(item.taskDate)}
            </Text>

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
                  color: "#93c5fd",
                  fontSize: 15,
                }}
              >
                Completed by
              </Text>

              <Text
                style={{
                  color: "#fff",
                  fontSize: 18,
                  fontWeight: "900",
                  marginTop: 5,
                }}
              >
                {item.completedBy ||
                  "Unknown staff"}
              </Text>

              <Text
                style={{
                  color: "#93c5fd",
                  fontSize: 15,
                  marginTop: 14,
                }}
              >
                Completion time
              </Text>

              <Text
                style={{
                  color: "#22c55e",
                  fontSize: 18,
                  fontWeight: "900",
                  marginTop: 5,
                }}
              >
                {formatTimestamp(
                  item.completedAt
                )}
              </Text>
            </View>

            <Text
              style={{
                color: "#9ca3af",
                fontSize: 14,
                marginTop: 14,
              }}
            >
              Task ID: {item.taskId || "Unavailable"}
            </Text>
          </View>
        ))
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
          ⚠️ Audit record
        </Text>

        <Text
          style={{
            color: "#fecaca",
            fontSize: 16,
            lineHeight: 24,
            marginTop: 8,
          }}
        >
          These entries represent completed care
          activity and should only be created after
          the recorded support has been provided.
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