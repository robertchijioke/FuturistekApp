import { useLocalSearchParams, useRouter } from "expo-router";
import {
  collection, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View,
} from "react-native";
import { db } from "../lib/firebase";

type CareTaskStatus =
  | "PENDING"
  | "DUE"
  | "COMPLETED";

type CareTaskRecord = {
  id: string;
  residentId?: string;
  templateId: string;
  residentName: string;
  room: string;
  taskDate: string;
  order: number;
  title: string;
  category: string;
  description: string;
  scheduledTime: string;
  status: CareTaskStatus;
  completedBy?: string;
  completedAt?: any;
  createdAt?: any;
  updatedAt?: any;
};

const TASK_TEMPLATES = [
  {
    id: "observation",
    order: 1,
    title: "Two-hour observation",
    category: "Observation",
    description:
      "Complete and record the scheduled resident wellbeing observation.",
    scheduledTime: "Every 2 hours",
    initialStatus: "DUE" as CareTaskStatus,
  },
  {
    id: "mobility",
    order: 2,
    title: "Mobility and walking-frame check",
    category: "Mobility",
    description:
      "Check that the walking frame is accessible, safe and appropriate for use.",
    scheduledTime: "Morning",
    initialStatus: "PENDING" as CareTaskStatus,
  },
  {
    id: "medication",
    order: 3,
    title: "Medication assistance",
    category: "Medication",
    description:
      "Review the current MAR and provide scheduled medication support.",
    scheduledTime: "As scheduled",
    initialStatus: "DUE" as CareTaskStatus,
  },
  {
    id: "hydration",
    order: 4,
    title: "Hydration check",
    category: "Nutrition",
    description:
      "Offer fluids and record relevant intake or concerns.",
    scheduledTime: "Throughout shift",
    initialStatus: "PENDING" as CareTaskStatus,
  },
  {
    id: "personal-care",
    order: 5,
    title: "Personal-care support",
    category: "Personal care",
    description:
      "Provide required personal-care support while maintaining dignity.",
    scheduledTime: "Morning",
    initialStatus: "PENDING" as CareTaskStatus,
  },
  {
    id: "nutrition",
    order: 6,
    title: "Meal and nutrition monitoring",
    category: "Nutrition",
    description:
      "Review meal support needs and record any intake concerns.",
    scheduledTime: "Meal times",
    initialStatus: "PENDING" as CareTaskStatus,
  },
];

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

const formatDateHeading = () =>
  new Date().toLocaleDateString([], {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const formatTimestamp = (timestamp: any) => {
  if (typeof timestamp?.toDate === "function") {
    return timestamp.toDate().toLocaleString();
  }

  if (typeof timestamp?.seconds === "number") {
    return new Date(
      timestamp.seconds * 1000
    ).toLocaleString();
  }

  return "Time pending";
};

const getStatusPresentation = (
  status: CareTaskStatus
) => {
  if (status === "COMPLETED") {
    return {
      label: "✅ Completed",
      color: "#22c55e",
      backgroundColor: "#0d2c22",
    };
  }

  if (status === "DUE") {
    return {
      label: "⏰ Due",
      color: "#fbbf24",
      backgroundColor: "#3b2605",
    };
  }

  return {
    label: "📋 Pending",
    color: "#60a5fa",
    backgroundColor: "#0d2942",
  };
};

export default function ResidentCareTasks() {
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
          "Care tasks opened without a valid resident ID.",
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
              "Care-task resident document not found:",
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

          console.log("✅ CARE TASK RESIDENT RESOLVED:", {
            residentId: snapshot.id,
            residentName:
              resolvedName || routeResidentName,
            room: resolvedRoom || routeRoom,
          });
        },
        (error) => {
          console.error(
            "Could not resolve Care Task resident:",
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

  const taskDate = useMemo(
    () => getLocalDateKey(),
    []
  );

  const [tasks, setTasks] = useState<
    CareTaskRecord[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [savingTaskId, setSavingTaskId] =
    useState<string | null>(null);

  const [staffName, setStaffName] =
    useState("James");

  useEffect(() => {
    if (!currentResidentId) {
      setLoading(false);
      return;
    }

    const initialiseTodayTasks = async () => {
      try {
        await Promise.all(
          TASK_TEMPLATES.map(async (template) => {
            const documentId =
              `${currentResidentId}-${taskDate}-${template.id}`;

            const taskReference = doc(
              db,
              "residentCareTasks",
              documentId
            );

            const existingTask =
              await getDoc(taskReference);

            // Do not overwrite a task already completed.
            if (existingTask.exists()) {
              return;
            }

            await setDoc(taskReference, {
              templateId: template.id,
              residentId: currentResidentId,
              residentName: currentResidentName,
              room: currentRoom,
              taskDate,
              order: template.order,
              title: template.title,
              category: template.category,
              description: template.description,
              scheduledTime:
                template.scheduledTime,
              status: template.initialStatus,
              completedBy: "",
              completedAt: null,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          })
        );
      } catch (error) {
        console.error(
          "Could not initialise daily care tasks:",
          error
        );

        Alert.alert(
          "Task setup unavailable",
          "Today's care tasks could not be prepared."
        );
      }
    };

    initialiseTodayTasks();

    const tasksQuery = query(
      collection(db, "residentCareTasks"),
      where(
        "residentId",
        "==",
        currentResidentId
      )
    );

    const unsubscribe = onSnapshot(
      tasksQuery,
      (snapshot) => {
        const todayTasks = snapshot.docs
          .map((document) => ({
            id: document.id,
            ...(document.data() as Omit<
              CareTaskRecord,
              "id"
            >),
          }))
          .filter(
            (task) => task.taskDate === taskDate
          )
          .sort(
            (a, b) =>
              Number(a.order ?? 0) -
              Number(b.order ?? 0)
          );

        setTasks(todayTasks);
        setLoading(false);

        console.log("✅ DAILY CARE TASKS LOADED:", {
          room: currentRoom,
          taskDate,
          count: todayTasks.length,
        });
      },
      (error) => {
        console.error(
          "Could not load daily care tasks:",
          error
        );

        setLoading(false);

        Alert.alert(
          "Care tasks unavailable",
          "Today's care tasks could not be loaded."
        );
      }
    );

    return unsubscribe;
  }, [
    currentResidentId,
    currentRoom,
    currentResidentName,
    taskDate,
  ]);

  const completedCount = tasks.filter(
    (task) => task.status === "COMPLETED"
  ).length;

  const dueCount = tasks.filter(
    (task) => task.status === "DUE"
  ).length;

  const pendingCount = tasks.filter(
    (task) => task.status === "PENDING"
  ).length;

  const completeTask = (
    task: CareTaskRecord
  ) => {
    const cleanedStaffName = staffName.trim();

    if (!cleanedStaffName) {
      Alert.alert(
        "Staff name required",
        "Enter the name of the staff member completing this task."
      );
      return;
    }

    if (task.status === "COMPLETED") {
      Alert.alert(
        "Task already completed",
        `${task.title} was completed by ${
          task.completedBy || "a staff member"
        }.`
      );
      return;
    }

    Alert.alert(
      "Confirm task completion",
      `Mark “${task.title}” as completed by ${cleanedStaffName}?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Complete",
          onPress: async () => {
            try {
              setSavingTaskId(task.id);

              await updateDoc(
                doc(
                  db,
                  "residentCareTasks",
                  task.id
                ),
                {
                  residentId: currentResidentId,
                  residentName: currentResidentName,
                  room: currentRoom,
                  status: "COMPLETED",
                  completedBy: cleanedStaffName,
                  completedAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                }
              );

              await setDoc(
                doc(
                  collection(
                    db,
                    "residentCareTaskHistory"
                  )
                ),
                {
                  residentId: currentResidentId,
                  taskId: task.id,
                  templateId: task.templateId,
                  taskTitle: task.title,
                  category: task.category,
                  residentName:
                    currentResidentName,
                  room: currentRoom,
                  taskDate,
                  completedBy:
                    cleanedStaffName,
                  status: "COMPLETED",
                  completedAt:
                    serverTimestamp(),
                }
              );

              Alert.alert(
                "Task completed",
                `${task.title} has been recorded as complete.`
              );
            } catch (error) {
              console.error(
                "Could not complete care task:",
                error
              );

              Alert.alert(
                "Completion failed",
                "The care task could not be saved."
              );
            } finally {
              setSavingTaskId(null);
            }
          },
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
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" />

        <Text
          style={{
            color: "#93c5fd",
            fontSize: 19,
            marginTop: 14,
            fontWeight: "800",
          }}
        >
          Loading daily care tasks...
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
          fontSize: 42,
          fontWeight: "900",
        }}
      >
        ✅ Daily Care Tasks
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

      <Text
        style={{
          color: "#9ca3af",
          fontSize: 16,
          marginTop: 8,
        }}
      >
        {formatDateHeading()}
      </Text>

      <View
        style={{
          marginTop: 24,
          backgroundColor: "#0d2942",
          borderRadius: 18,
          padding: 20,
          borderWidth: 1,
          borderColor: "#0891b2",
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 25,
            fontWeight: "900",
          }}
        >
          📊 Shift Overview
        </Text>

        <Text
          style={{
            color: "#cfe2ff",
            fontSize: 18,
            marginTop: 14,
          }}
        >
          Total tasks: {tasks.length}
        </Text>

        <Text
          style={{
            color: "#22c55e",
            fontSize: 18,
            fontWeight: "800",
            marginTop: 8,
          }}
        >
          Completed: {completedCount}
        </Text>

        <Text
          style={{
            color: "#fbbf24",
            fontSize: 18,
            fontWeight: "800",
            marginTop: 8,
          }}
        >
          Due: {dueCount}
        </Text>

        <Text
          style={{
            color: "#60a5fa",
            fontSize: 18,
            fontWeight: "800",
            marginTop: 8,
          }}
        >
          Pending: {pendingCount}
        </Text>
      </View>

      <View
        style={{
          marginTop: 22,
          backgroundColor: "#081826",
          borderRadius: 16,
          padding: 18,
          borderWidth: 1,
          borderColor: "#374151",
        }}
      >
        <Text
          style={{
            color: "#93c5fd",
            fontSize: 17,
            fontWeight: "800",
          }}
        >
          Completing staff member
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
      </View>

      <Text
        style={{
          color: "#fff",
          fontSize: 29,
          fontWeight: "900",
          marginTop: 30,
        }}
      >
        📋 Today’s Tasks
      </Text>

      {tasks.map((task) => {
        const presentation =
          getStatusPresentation(task.status);

        const isSaving =
          savingTaskId === task.id;

        return (
          <View
            key={task.id}
            style={{
              marginTop: 18,
              backgroundColor: "#081826",
              borderRadius: 18,
              padding: 20,
              borderWidth: 1,
              borderColor: presentation.color,
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
                fontSize: 25,
                fontWeight: "900",
                marginTop: 14,
              }}
            >
              {task.title}
            </Text>

            <Text
              style={{
                color: "#93c5fd",
                fontSize: 17,
                marginTop: 8,
              }}
            >
              {task.category}
            </Text>

            <Text
              style={{
                color: "#cfe2ff",
                fontSize: 17,
                lineHeight: 25,
                marginTop: 12,
              }}
            >
              {task.description}
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
                Scheduled
              </Text>

              <Text
                style={{
                  color: "#fff",
                  fontSize: 17,
                  fontWeight: "900",
                  marginTop: 4,
                }}
              >
                {task.scheduledTime}
              </Text>

              {task.status === "COMPLETED" && (
                <>
                  <Text
                    style={{
                      color: "#93c5fd",
                      fontSize: 15,
                      marginTop: 12,
                    }}
                  >
                    Completed by
                  </Text>

                  <Text
                    style={{
                      color: "#22c55e",
                      fontSize: 17,
                      fontWeight: "900",
                      marginTop: 4,
                    }}
                  >
                    {task.completedBy ||
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
                      task.completedAt
                    )}
                  </Text>
                </>
              )}
            </View>

            {task.status !== "COMPLETED" && (
              <Pressable
                disabled={isSaving}
                onPress={() =>
                  completeTask(task)
                }
                style={{
                  backgroundColor: isSaving
                    ? "#475569"
                    : "#16a34a",
                  padding: 15,
                  borderRadius: 12,
                  marginTop: 18,
                  opacity: isSaving ? 0.75 : 1,
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
                  {isSaving
                    ? "⏳ Saving..."
                    : "✅ Mark Task Complete"}
                </Text>
              </Pressable>
            )}
          </View>
        );
      })}

      <Pressable
        onPress={() =>
          router.push({
            pathname: "/resident-care-task-history",
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
            fontSize: 20,
            fontWeight: "900",
          }}
        >
          📚 Care Task History
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
          ⚠️ Care-task accuracy
        </Text>

        <Text
          style={{
            color: "#fecaca",
            fontSize: 16,
            lineHeight: 24,
            marginTop: 8,
          }}
        >
          Only mark a task complete after the care
          has been provided and any relevant concerns
          have been recorded or escalated.
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