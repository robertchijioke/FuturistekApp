import { useLocalSearchParams, useRouter } from "expo-router";
import {
  addDoc, collection,
  doc,
  getDocs,
  onSnapshot, query, serverTimestamp, where,
  writeBatch
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View,
} from "react-native";
import { db } from "../lib/firebase";

type NotePriority = "ROUTINE" | "IMPORTANT" | "URGENT";

type CareNoteRecord = {
  id: string;
  residentName?: string;
  room?: string;
  category?: string;
  note?: string;
  priority?: NotePriority;
  staffName?: string;
  createdAt?: any;
  residentId?: string;
  editedAt?: any;
  editedBy?: string;
  editReason?: string;
  editCount?: number;
};

const CATEGORIES = [
  "General observation",
  "Mobility",
  "Nutrition",
  "Personal care",
  "Sleep",
  "Behaviour",
];

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

  return "Saving timestamp...";
};

const getPriorityPresentation = (
  priority?: NotePriority
) => {
  if (priority === "URGENT") {
    return {
      label: "🚨 Urgent",
      color: "#ef4444",
      backgroundColor: "#3b1117",
    };
  }

  if (priority === "IMPORTANT") {
    return {
      label: "⚠️ Important",
      color: "#fbbf24",
      backgroundColor: "#3b2605",
    };
  }

  return {
    label: "📝 Routine",
    color: "#22c55e",
    backgroundColor: "#0d2c22",
  };
};

export default function ResidentCareNote() {
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
    CareNoteRecord[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [category, setCategory] = useState(
    "General observation"
  );

  const [priority, setPriority] =
    useState<NotePriority>("ROUTINE");

  const [staffName, setStaffName] =
    useState("James");

  const [noteText, setNoteText] = useState("");

  const [editingNoteId, setEditingNoteId] =
    useState<string | null>(null);

  const [editNoteText, setEditNoteText] =
    useState("");

  const [editCategory, setEditCategory] =
    useState("General observation");

  const [editPriority, setEditPriority] =
    useState<"ROUTINE" | "IMPORTANT" | "URGENT">(
      "ROUTINE"
    );

  const [editStaffName, setEditStaffName] =
    useState("");

  const [correctionReason, setCorrectionReason] =
    useState("");

  const [savingEdit, setSavingEdit] =
    useState(false);

  useEffect(() => {
    if (!currentResidentId) {
      console.warn(
        "Care notes opened without a valid resident ID.",
        {
          residentId,
          room: currentRoom,
        }
      );

      setRecords([]);
      setLoading(false);
      return;
    }

    const migrateLegacyCareNotes = async () => {

      if (!currentRoom) {
        console.log(
          "No valid room supplied. Skipping legacy care-note migration.",
          {
            residentId: currentResidentId,
          }
        );

        return;
      }

      const legacyNotesQuery = query(
        collection(db, "residentCareNotes"),
        where("room", "==", currentRoom)
      );

      const legacySnapshot = await getDocs(
        legacyNotesQuery
      );

      const notesWithoutResidentId =
        legacySnapshot.docs.filter(
          (document) =>
            !document.data().residentId
        );

      if (notesWithoutResidentId.length === 0) {
        console.log(
          "✅ NO LEGACY CARE NOTES TO MIGRATE:",
          {
            residentId: currentResidentId,
            room: currentRoom,
          }
        );

        return;
      }

      const batch = writeBatch(db);

      notesWithoutResidentId.forEach((document) => {
        batch.update(document.ref, {
          residentId: currentResidentId,
          migratedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      await batch.commit();

      console.log(
        "✅ LEGACY CARE NOTES MIGRATED:",
        {
          residentId: currentResidentId,
          room: currentRoom,
          count: notesWithoutResidentId.length,
        }
      );
    };

    migrateLegacyCareNotes().catch((error) => {
      console.error(
        "Could not migrate legacy care notes:",
        error
      );
    });

    const notesQuery = query(
      collection(db, "residentCareNotes"),
      where("residentId", "==", currentResidentId)
    );

    const unsubscribe = onSnapshot(
      notesQuery,
      (snapshot) => {
        const notes = snapshot.docs
          .map((document) => ({
            id: document.id,
            ...(document.data() as Omit<
              CareNoteRecord,
              "id"
            >),
          }))
          .sort(
            (a, b) =>
              getTimestampMillis(b.createdAt) -
              getTimestampMillis(a.createdAt)
          );

        setRecords(notes);
        setLoading(false);

        console.log("📝 CARE NOTES LOADED:", {
          room: currentRoom,
          count: notes.length,
        });
      },
      (error) => {
        console.error(
          "Could not load resident care notes:",
          error
        );

        setLoading(false);

        Alert.alert(
          "Care notes unavailable",
          "The resident's care notes could not be loaded."
        );
      }
    );

    return unsubscribe;
  }, [currentResidentId]);

  const startEditingCareNote = (
    item: CareNoteRecord
  ) => {
    setEditingNoteId(item.id);
    setEditNoteText(item.note ?? "");
    setEditCategory(
      item.category ?? "General observation"
    );
    setEditPriority(
      item.priority === "IMPORTANT" ||
        item.priority === "URGENT"
        ? item.priority
        : "ROUTINE"
    );
    setEditStaffName(item.staffName ?? "");
    setCorrectionReason("");
  };

  const cancelEditingCareNote = () => {
    setEditingNoteId(null);
    setEditNoteText("");
    setEditCategory("General observation");
    setEditPriority("ROUTINE");
    setEditStaffName("");
    setCorrectionReason("");
  };

  const saveEditedCareNote = async (
    item: CareNoteRecord
  ) => {
    const cleanedNote = editNoteText.trim();
    const cleanedEditor = editStaffName.trim();
    const cleanedReason = correctionReason.trim();

    if (!cleanedNote) {
      Alert.alert(
        "Care observation required",
        "The corrected care observation cannot be empty."
      );
      return;
    }

    if (!cleanedEditor) {
      Alert.alert(
        "Staff name required",
        "Enter the staff member making this correction."
      );
      return;
    }

    if (cleanedReason.length < 5) {
      Alert.alert(
        "Correction reason required",
        "Briefly explain why this care record is being corrected."
      );
      return;
    }

    const hasChanged =
      cleanedNote !== item.note ||
      editCategory !== item.category ||
      editPriority !== item.priority ||
      cleanedEditor !== item.staffName;

    if (!hasChanged) {
      Alert.alert(
        "No changes detected",
        "Update at least one part of the care record before saving."
      );
      return;
    }

    Alert.alert(
      "Confirm care-record correction",
      "The existing entry will be updated and its previous contents will be stored permanently in the audit history.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Save correction",
          onPress: async () => {
            try {
              setSavingEdit(true);

              const batch = writeBatch(db);

              const noteReference = doc(
                db,
                "residentCareNotes",
                item.id
              );

              const auditReference = doc(
                collection(
                  db,
                  "residentCareNoteAuditLogs"
                )
              );

              batch.set(auditReference, {
                careNoteId: item.id,
                residentId: currentResidentId,
                residentName:
                  item.residentName ??
                  currentResidentName,
                room: item.room ?? currentRoom,

                previousNote: item.note ?? "",
                previousCategory:
                  item.category ??
                  "General observation",
                previousPriority:
                  item.priority ?? "ROUTINE",
                previousStaffName:
                  item.staffName ?? "",

                originalCreatedAt:
                  item.createdAt ?? null,

                correctedNote: cleanedNote,
                correctedCategory: editCategory,
                correctedPriority: editPriority,
                correctedStaffName: cleanedEditor,

                correctedBy: cleanedEditor,
                correctionReason: cleanedReason,
                correctedAt: serverTimestamp(),
              });

              batch.update(noteReference, {
                note: cleanedNote,
                category: editCategory,
                priority: editPriority,
                staffName: cleanedEditor,

                editedAt: serverTimestamp(),
                editedBy: cleanedEditor,
                editReason: cleanedReason,
                editCount:
                  typeof item.editCount === "number"
                    ? item.editCount + 1
                    : 1,

                updatedAt: serverTimestamp(),
              });

              await batch.commit();

              console.log(
                "✅ CARE NOTE CORRECTED:",
                {
                  careNoteId: item.id,
                  residentId: currentResidentId,
                  editedBy: cleanedEditor,
                  correctionReason: cleanedReason,
                }
              );

              cancelEditingCareNote();

              Alert.alert(
                "Care note corrected",
                "The updated care note has been saved and the previous version has been preserved in the audit history."
              );
            } catch (error) {
              console.error(
                "Could not correct care note:",
                error
              );

              Alert.alert(
                "Correction failed",
                "The care note correction could not be saved."
              );
            } finally {
              setSavingEdit(false);
            }
          },
        },
      ]
    );
  };

  const saveCareNote = async () => {
    const cleanedNote = noteText.trim();
    const cleanedStaffName = staffName.trim();

    if (!cleanedNote) {
      Alert.alert(
        "Care note required",
        "Enter an observation before saving."
      );
      return;
    }

    if (!cleanedStaffName) {
      Alert.alert(
        "Staff name required",
        "Enter the name of the staff member recording this note."
      );
      return;
    }

    try {
      setSaving(true);

      await addDoc(
        collection(db, "residentCareNotes"),
        {
          residentId: currentResidentId,
          residentName: currentResidentName,
          room: currentRoom,
          category,
          note: cleanedNote,
          priority,
          staffName: cleanedStaffName,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );

      console.log("✅ CARE NOTE SAVED:", {
        residentId: currentResidentId,
        residentName: currentResidentName,
        room: currentRoom,
        category,
        priority,
        staffName: cleanedStaffName,
      });

      setNoteText("");
      setCategory("General observation");
      setPriority("ROUTINE");

      Alert.alert(
        "Care note saved",
        "The observation has been added to the resident's permanent care record."
      );
    } catch (error) {
      console.error(
        "Could not save resident care note:",
        error
      );

      Alert.alert(
        "Save failed",
        "The care note could not be saved."
      );
    } finally {
      setSaving(false);
    }
  };

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
        📝 Care Notes
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
          📊 Care Record Summary
        </Text>

        <Text
          style={{
            color: "#cfe2ff",
            fontSize: 18,
            marginTop: 12,
          }}
        >
          Recorded observations: {records.length}
        </Text>
      </View>

      <View
        style={{
          marginTop: 24,
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
            fontSize: 27,
            fontWeight: "900",
          }}
        >
          ✍️ Add Observation
        </Text>

        <Text
          style={{
            color: "#93c5fd",
            fontSize: 17,
            marginTop: 18,
            fontWeight: "800",
          }}
        >
          Observation category
        </Text>

        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 10,
            marginTop: 12,
          }}
        >
          {CATEGORIES.map((item) => {
            const selected = category === item;

            return (
              <Pressable
                key={item}
                onPress={() => setCategory(item)}
                style={{
                  backgroundColor: selected
                    ? "#2563eb"
                    : "#0d2942",
                  borderRadius: 20,
                  paddingHorizontal: 13,
                  paddingVertical: 9,
                  borderWidth: 1,
                  borderColor: selected
                    ? "#60a5fa"
                    : "#374151",
                }}
              >
                <Text
                  style={{
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: "800",
                  }}
                >
                  {item}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text
          style={{
            color: "#93c5fd",
            fontSize: 17,
            marginTop: 22,
            fontWeight: "800",
          }}
        >
          Priority
        </Text>

        <View
          style={{
            flexDirection: "row",
            gap: 10,
            marginTop: 12,
          }}
        >
          {(
            [
              "ROUTINE",
              "IMPORTANT",
              "URGENT",
            ] as NotePriority[]
          ).map((item) => {
            const selected = priority === item;
            const presentation =
              getPriorityPresentation(item);

            return (
              <Pressable
                key={item}
                onPress={() => setPriority(item)}
                style={{
                  flex: 1,
                  backgroundColor: selected
                    ? presentation.backgroundColor
                    : "#0d2942",
                  borderRadius: 12,
                  paddingVertical: 12,
                  borderWidth: selected ? 2 : 1,
                  borderColor: selected
                    ? presentation.color
                    : "#374151",
                }}
              >
                <Text
                  style={{
                    color: selected
                      ? presentation.color
                      : "#cfe2ff",
                    textAlign: "center",
                    fontSize: 13,
                    fontWeight: "900",
                  }}
                >
                  {item}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text
          style={{
            color: "#93c5fd",
            fontSize: 17,
            marginTop: 22,
            fontWeight: "800",
          }}
        >
          Staff member
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

        <Text
          style={{
            color: "#93c5fd",
            fontSize: 17,
            marginTop: 22,
            fontWeight: "800",
          }}
        >
          Care observation
        </Text>

        <TextInput
          value={noteText}
          onChangeText={setNoteText}
          placeholder="Record the observation, care provided and any required follow-up..."
          placeholderTextColor="#64748b"
          multiline
          textAlignVertical="top"
          style={{
            minHeight: 150,
            backgroundColor: "#0d2942",
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#374151",
            color: "#fff",
            fontSize: 17,
            lineHeight: 25,
            padding: 15,
            marginTop: 10,
          }}
        />

        <Pressable
          disabled={saving}
          onPress={saveCareNote}
          style={{
            backgroundColor: saving
              ? "#475569"
              : "#16a34a",
            padding: 17,
            borderRadius: 14,
            marginTop: 20,
            opacity: saving ? 0.75 : 1,
          }}
        >
          <Text
            style={{
              color: "#fff",
              textAlign: "center",
              fontSize: 19,
              fontWeight: "900",
            }}
          >
            {saving
              ? "⏳ Saving Care Note..."
              : "✅ Save Care Note"}
          </Text>
        </Pressable>
      </View>

      <Text
        style={{
          color: "#fff",
          fontSize: 29,
          fontWeight: "900",
          marginTop: 30,
        }}
      >
        📚 Observation History
      </Text>

      {loading ? (
        <View
          style={{
            alignItems: "center",
            marginTop: 40,
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
            Loading care notes...
          </Text>
        </View>
      ) : records.length === 0 ? (
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
              color: "#22c55e",
              fontSize: 23,
              fontWeight: "900",
            }}
          >
            ✅ No observations recorded
          </Text>

          <Text
            style={{
              color: "#cfe2ff",
              fontSize: 17,
              lineHeight: 25,
              marginTop: 10,
            }}
          >
            New care observations will appear here
            automatically.
          </Text>
        </View>
      ) : (
        records.map((item) => {
          const presentation =
            getPriorityPresentation(item.priority);

          return (
            <View
              key={item.id}
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
                  paddingVertical: 6,
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
                  fontSize: 24,
                  fontWeight: "900",
                  marginTop: 14,
                }}
              >
                {item.category ||
                  "General observation"}
              </Text>

              <Text
                style={{
                  color: "#cfe2ff",
                  fontSize: 18,
                  lineHeight: 27,
                  marginTop: 12,
                }}
              >
                {item.note ||
                  "No observation details recorded."}
              </Text>

              <View
                style={{
                  backgroundColor: "#0d2942",
                  padding: 14,
                  borderRadius: 12,
                  marginTop: 16,
                }}
              >
                <Text
                  style={{
                    color: "#93c5fd",
                    fontSize: 15,
                  }}
                >
                  Recorded by
                </Text>

                <Text
                  style={{
                    color: "#fff",
                    fontSize: 17,
                    fontWeight: "900",
                    marginTop: 4,
                  }}
                >
                  {item.staffName || "Unknown staff"}
                </Text>

                <Text
                  style={{
                    color: "#9ca3af",
                    fontSize: 15,
                    marginTop: 9,
                  }}
                >
                  {formatTimestamp(item.createdAt)}
                </Text>
              </View>

              {item.editedAt && (
                <View
                  style={{
                    backgroundColor: "#3b2605",
                    borderRadius: 12,
                    padding: 14,
                    marginTop: 14,
                    borderWidth: 1,
                    borderColor: "#fbbf24",
                  }}
                >
                  <Text
                    style={{
                      color: "#fbbf24",
                      fontSize: 16,
                      fontWeight: "900",
                    }}
                  >
                    ✏️ Corrected care record
                  </Text>

                  <Text
                    style={{
                      color: "#fde68a",
                      fontSize: 15,
                      marginTop: 7,
                    }}
                  >
                    Corrected by:{" "}
                    {item.editedBy || "Unknown staff"}
                  </Text>

                  <Text
                    style={{
                      color: "#fde68a",
                      fontSize: 15,
                      lineHeight: 22,
                      marginTop: 7,
                    }}
                  >
                    Reason:{" "}
                    {item.editReason ||
                      "Correction reason unavailable"}
                  </Text>

                  <Text
                    style={{
                      color: "#9ca3af",
                      fontSize: 14,
                      marginTop: 7,
                    }}
                  >
                    {formatTimestamp(item.editedAt)}
                    {item.editCount
                      ? ` • Edit #${item.editCount}`
                      : ""}
                  </Text>
                </View>
              )}

              {editingNoteId !== item.id ? (
                <Pressable
                  onPress={() =>
                    startEditingCareNote(item)
                  }
                  style={{
                    backgroundColor: "#2563eb",
                    padding: 14,
                    borderRadius: 12,
                    marginTop: 16,
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
                    ✏️ Correct Care Note
                  </Text>
                </Pressable>
              ) : (
                <View
                  style={{
                    backgroundColor: "#0d2942",
                    borderRadius: 14,
                    padding: 16,
                    marginTop: 16,
                    borderWidth: 1,
                    borderColor: "#60a5fa",
                  }}
                >
                  <Text
                    style={{
                      color: "#fff",
                      fontSize: 22,
                      fontWeight: "900",
                    }}
                  >
                    ✏️ Correct Care Record
                  </Text>

                  <Text
                    style={{
                      color: "#93c5fd",
                      fontSize: 16,
                      fontWeight: "800",
                      marginTop: 16,
                    }}
                  >
                    Observation category
                  </Text>

                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: 8,
                      marginTop: 10,
                    }}
                  >
                    {[
                      "General observation",
                      "Mobility",
                      "Nutrition",
                      "Personal care",
                      "Sleep",
                      "Behaviour",
                    ].map((option) => (
                      <Pressable
                        key={option}
                        onPress={() =>
                          setEditCategory(option)
                        }
                        style={{
                          backgroundColor:
                            editCategory === option
                              ? "#2563eb"
                              : "#081826",
                          borderRadius: 18,
                          paddingHorizontal: 12,
                          paddingVertical: 9,
                          borderWidth: 1,
                          borderColor:
                            editCategory === option
                              ? "#60a5fa"
                              : "#374151",
                        }}
                      >
                        <Text
                          style={{
                            color: "#fff",
                            fontSize: 14,
                            fontWeight: "800",
                          }}
                        >
                          {option}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text
                    style={{
                      color: "#93c5fd",
                      fontSize: 16,
                      fontWeight: "800",
                      marginTop: 16,
                    }}
                  >
                    Priority
                  </Text>

                  <View
                    style={{
                      flexDirection: "row",
                      gap: 8,
                      marginTop: 10,
                    }}
                  >
                    {(
                      [
                        "ROUTINE",
                        "IMPORTANT",
                        "URGENT",
                      ] as const
                    ).map((option) => (
                      <Pressable
                        key={option}
                        onPress={() =>
                          setEditPriority(option)
                        }
                        style={{
                          flex: 1,
                          backgroundColor:
                            editPriority === option
                              ? option === "URGENT"
                                ? "#3b1117"
                                : option === "IMPORTANT"
                                ? "#3b2605"
                                : "#0d2c22"
                              : "#081826",
                          borderRadius: 10,
                          paddingVertical: 12,
                          borderWidth:
                            editPriority === option
                              ? 2
                              : 1,
                          borderColor:
                            editPriority === option
                              ? option === "URGENT"
                                ? "#ef4444"
                                : option === "IMPORTANT"
                                ? "#fbbf24"
                                : "#22c55e"
                              : "#374151",
                        }}
                      >
                        <Text
                          style={{
                            color: "#fff",
                            textAlign: "center",
                            fontSize: 12,
                            fontWeight: "900",
                          }}
                        >
                          {option}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text
                    style={{
                      color: "#93c5fd",
                      fontSize: 16,
                      fontWeight: "800",
                      marginTop: 16,
                    }}
                  >
                    Corrected observation
                  </Text>

                  <TextInput
                    value={editNoteText}
                    onChangeText={setEditNoteText}
                    multiline
                    textAlignVertical="top"
                    style={{
                      minHeight: 140,
                      backgroundColor: "#081826",
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: "#374151",
                      color: "#fff",
                      fontSize: 16,
                      lineHeight: 24,
                      padding: 14,
                      marginTop: 9,
                    }}
                  />

                  <Text
                    style={{
                      color: "#93c5fd",
                      fontSize: 16,
                      fontWeight: "800",
                      marginTop: 16,
                    }}
                  >
                    Correcting staff member
                  </Text>

                  <TextInput
                    value={editStaffName}
                    onChangeText={setEditStaffName}
                    placeholder="Enter staff name"
                    placeholderTextColor="#64748b"
                    style={{
                      backgroundColor: "#081826",
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: "#374151",
                      color: "#fff",
                      fontSize: 16,
                      padding: 14,
                      marginTop: 9,
                    }}
                  />

                  <Text
                    style={{
                      color: "#93c5fd",
                      fontSize: 16,
                      fontWeight: "800",
                      marginTop: 16,
                    }}
                  >
                    Required correction reason
                  </Text>

                  <TextInput
                    value={correctionReason}
                    onChangeText={setCorrectionReason}
                    placeholder="Explain the error and why this correction is required..."
                    placeholderTextColor="#64748b"
                    multiline
                    textAlignVertical="top"
                    style={{
                      minHeight: 100,
                      backgroundColor: "#081826",
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: "#374151",
                      color: "#fff",
                      fontSize: 16,
                      lineHeight: 23,
                      padding: 14,
                      marginTop: 9,
                    }}
                  />

                  <Pressable
                    disabled={savingEdit}
                    onPress={() =>
                      saveEditedCareNote(item)
                    }
                    style={{
                      backgroundColor: savingEdit
                        ? "#475569"
                        : "#16a34a",
                      padding: 14,
                      borderRadius: 12,
                      marginTop: 16,
                      opacity: savingEdit ? 0.75 : 1,
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
                      {savingEdit
                        ? "⏳ Saving Correction..."
                        : "✅ Save Care-Record Correction"}
                    </Text>
                  </Pressable>

                  <Pressable
                    disabled={savingEdit}
                    onPress={cancelEditingCareNote}
                    style={{
                      backgroundColor: "#374151",
                      padding: 13,
                      borderRadius: 12,
                      marginTop: 10,
                    }}
                  >
                    <Text
                      style={{
                        color: "#fff",
                        textAlign: "center",
                        fontSize: 16,
                        fontWeight: "800",
                      }}
                    >
                      Cancel Correction
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        })
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
          ⚠️ Record accuracy
        </Text>

        <Text
          style={{
            color: "#fecaca",
            fontSize: 16,
            lineHeight: 24,
            marginTop: 8,
          }}
        >
          Record factual observations, care provided
          and required follow-up. Urgent concerns must
          also follow the organisation's escalation
          procedure.
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