import { useLocalSearchParams, useRouter } from "expo-router";
import {
  collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput,
  View,
} from "react-native";
import { db } from "../lib/firebase";

type ResidentStatus =
  | "SAFE"
  | "ATTENTION"
  | "CRITICAL";

type FallRisk =
  | "LOW"
  | "MEDIUM"
  | "HIGH";

type ResidentRecord = {
  fullName: string;
  room: string;
  age?: number;
  dateOfBirth?: string;
  status: ResidentStatus;
  activity?: string;
  fallRisk?: FallRisk;
  mobilitySupport?: string;
  observationFrequency?: string;
  medicationAssistance?: boolean;
  emergencyContact?: string;
  createdAt?: any;
  updatedAt?: any;
};

const createResidentDocumentId = (
  room: string
) =>
  room
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const normaliseRoom = (value: string) => {
  const cleaned = value.trim();

  if (!cleaned) {
    return "";
  }

  const roomNumber =
    cleaned.match(/\d+/)?.[0];

  if (roomNumber) {
    return `Room ${roomNumber}`;
  }

  return cleaned;
};

const calculateAgeFromDateOfBirth = (
  dateOfBirth: string
): number | null => {
  const trimmedDate = dateOfBirth.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
    return null;
  }

  const [year, month, day] = trimmedDate
    .split("-")
    .map(Number);

  const birthDate = new Date(year, month - 1, day);

  const isValidDate =
    birthDate.getFullYear() === year &&
    birthDate.getMonth() === month - 1 &&
    birthDate.getDate() === day;

  if (!isValidDate || birthDate > new Date()) {
    return null;
  }

  const today = new Date();

  let calculatedAge =
    today.getFullYear() - birthDate.getFullYear();

  const birthdayHasNotOccurred =
    today.getMonth() < birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() &&
      today.getDate() < birthDate.getDate());

  if (birthdayHasNotOccurred) {
    calculatedAge -= 1;
  }

  return calculatedAge;
};

export default function CareResidentForm() {
  const router = useRouter();

  const { mode, residentId } =
    useLocalSearchParams<{
      mode?: string;
      residentId?: string;
    }>();

  const isEditMode =
    mode === "edit" &&
    typeof residentId === "string" &&
    residentId.trim().length > 0;

  const currentResidentId =
    typeof residentId === "string"
      ? residentId.trim()
      : "";

  const [loading, setLoading] =
    useState(isEditMode);

  const [saving, setSaving] =
    useState(false);

  const [fullName, setFullName] =
    useState("");

  const [room, setRoom] =
    useState("");

  const [age, setAge] =
    useState("");

  const [dateOfBirth, setDateOfBirth] =
    useState("");

  const [status, setStatus] =
    useState<ResidentStatus>("SAFE");

  const [activity, setActivity] =
    useState("No activity");

  const [fallRisk, setFallRisk] =
    useState<FallRisk>("MEDIUM");

  const [
    mobilitySupport,
    setMobilitySupport,
  ] = useState("");

  const [
    observationFrequency,
    setObservationFrequency,
  ] = useState("");

  const [
    medicationAssistance,
    setMedicationAssistance,
  ] = useState(true);

  const [
    emergencyContact,
    setEmergencyContact,
  ] = useState("");

  useEffect(() => {
    if (!isEditMode) {
      setLoading(false);
      return;
    }

    const loadResident = async () => {
      try {
        const residentReference = doc(
          db,
          "residents",
          currentResidentId
        );

        const residentSnapshot =
          await getDoc(residentReference);

        if (!residentSnapshot.exists()) {
          Alert.alert(
            "Resident unavailable",
            "The resident record could not be found."
          );

          setLoading(false);
          return;
        }

        const data =
          residentSnapshot.data() as ResidentRecord;

        setFullName(data.fullName ?? "");
        setRoom(data.room ?? "");
        setAge(
          typeof data.age === "number"
            ? String(data.age)
            : ""
        );
        setDateOfBirth(
          data.dateOfBirth ?? ""
        );
        setStatus(data.status ?? "SAFE");
        setActivity(
          data.activity ?? "No activity"
        );
        setFallRisk(
          data.fallRisk ?? "MEDIUM"
        );
        setMobilitySupport(
          data.mobilitySupport ?? ""
        );
        setObservationFrequency(
          data.observationFrequency ?? ""
        );
        setMedicationAssistance(
          data.medicationAssistance ?? false
        );
        setEmergencyContact(
          data.emergencyContact ?? ""
        );
      } catch (error) {
        console.error(
          "Could not load resident:",
          error
        );

        Alert.alert(
          "Resident unavailable",
          "The resident information could not be loaded."
        );
      } finally {
        setLoading(false);
      }
    };

    loadResident();
  }, [
    currentResidentId,
    isEditMode,
  ]);

  const handleDateOfBirthChange = (value: string) => {
    setDateOfBirth(value);

    const calculatedAge =
      calculateAgeFromDateOfBirth(value);

    if (calculatedAge !== null) {
      setAge(String(calculatedAge));
    }
  };

  const validateForm = async () => {
    const cleanedName = fullName.trim();
    const cleanedRoom =
      normaliseRoom(room);

    if (!cleanedName) {
      Alert.alert(
        "Resident name required",
        "Enter the resident's full name."
      );

      return null;
    }

    if (!cleanedRoom) {
      Alert.alert(
        "Room required",
        "Enter the resident's room."
      );

      return null;
    }

    if (dateOfBirth.trim()) {
      const calculatedAge =
        calculateAgeFromDateOfBirth(dateOfBirth);

      if (calculatedAge === null) {
        Alert.alert(
          "Invalid date of birth",
          "Enter the date of birth in YYYY-MM-DD format, for example 1942-06-15."
        );

        return null;
      }

      setAge(String(calculatedAge));
    }

    if (age.trim()) {
      const parsedAge = Number(age);

      if (
        !Number.isInteger(parsedAge) ||
        parsedAge < 0 ||
        parsedAge > 125
      ) {
        Alert.alert(
          "Invalid age",
          "Enter a valid age between 0 and 125."
        );

        return null;
      }
    }

    const newResidentId =
      createResidentDocumentId(
        cleanedRoom
      );

    if (!newResidentId) {
      Alert.alert(
        "Invalid room",
        "The room could not be converted into a valid resident record."
      );

      return null;
    }

    const duplicateRoomQuery = query(
      collection(db, "residents"),
      where("room", "==", cleanedRoom)
    );

    const duplicateRoomSnapshot =
      await getDocs(
        duplicateRoomQuery
      );

    const duplicateResident =
      duplicateRoomSnapshot.docs.find(
        (document) =>
          document.id !==
          currentResidentId
      );

    if (duplicateResident) {
      Alert.alert(
        "Room already assigned",
        `${cleanedRoom} is already assigned to another resident.`
      );

      return null;
    }

    return {
      cleanedName,
      cleanedRoom,
      newResidentId,
    };
  };

  const saveResident = async () => {
    try {
      setSaving(true);

      const validation =
        await validateForm();

      if (!validation) {
        return;
      }

      const {
        cleanedName,
        cleanedRoom,
        newResidentId,
      } = validation;

      const residentData = {
        fullName: cleanedName,
        room: cleanedRoom,
        age:
          calculateAgeFromDateOfBirth(dateOfBirth) ??
          (age.trim() ? Number(age) : null),
        dateOfBirth:
          dateOfBirth.trim(),
        status,
        activity:
          activity.trim() ||
          "No activity",
        fallRisk,
        mobilitySupport:
          mobilitySupport.trim() ||
          "Not recorded",
        observationFrequency:
          observationFrequency.trim() ||
          "Not recorded",
        medicationAssistance,
        emergencyContact:
          emergencyContact.trim() ||
          "Not yet added",
        updatedAt:
          serverTimestamp(),
      };

      if (isEditMode) {
        if (
          newResidentId !==
          currentResidentId
        ) {
          const newResidentReference =
            doc(
              db,
              "residents",
              newResidentId
            );

          const existingNewDocument =
            await getDoc(
              newResidentReference
            );

          if (
            existingNewDocument.exists()
          ) {
            Alert.alert(
              "Room unavailable",
              "A resident document already exists for that room."
            );

            return;
          }

          const oldResidentReference =
            doc(
              db,
              "residents",
              currentResidentId
            );

          const oldResidentSnapshot =
            await getDoc(
              oldResidentReference
            );

          await setDoc(
            newResidentReference,
            {
              ...residentData,
              createdAt:
                oldResidentSnapshot.data()
                  ?.createdAt ??
                serverTimestamp(),
            }
          );

          Alert.alert(
            "Room change requires review",
            "A new resident document was created for the new room. Existing historical records may still use the previous resident ID.",
            [
              {
                text: "OK",
                onPress: () =>
                  router.replace(
                    "/care-residents" as any
                  ),
              },
            ]
          );

          return;
        }

        await updateDoc(
          doc(
            db,
            "residents",
            currentResidentId
          ),
          residentData
        );

        Alert.alert(
          "Resident updated",
          `${cleanedName}'s resident record has been updated.`,
          [
            {
              text: "OK",
              onPress: () =>
                router.back(),
            },
          ]
        );

        return;
      }

      await setDoc(
        doc(
          db,
          "residents",
          newResidentId
        ),
        {
          ...residentData,
          createdAt:
            serverTimestamp(),
        }
      );

      Alert.alert(
        "Resident added",
        `${cleanedName} has been added to ${cleanedRoom}.`,
        [
          {
            text: "OK",
            onPress: () =>
              router.back(),
          },
        ]
      );
    } catch (error) {
      console.error(
        "Could not save resident:",
        error
      );

      Alert.alert(
        "Save failed",
        "The resident record could not be saved."
      );
    } finally {
      setSaving(false);
    }
  };

  const renderChoiceButton = (
    label: string,
    selected: boolean,
    onPress: () => void,
    selectedColor: string
  ) => (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: selected
          ? `${selectedColor}33`
          : "#0d2942",
        borderRadius: 12,
        borderWidth: selected
          ? 2
          : 1,
        borderColor: selected
          ? selectedColor
          : "#374151",
        paddingVertical: 13,
        paddingHorizontal: 15,
        marginRight: 10,
        marginBottom: 10,
      }}
    >
      <Text
        style={{
          color: selected
            ? selectedColor
            : "#cfe2ff",
          fontSize: 15,
          fontWeight: "900",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );

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
        <ActivityIndicator
          size="large"
        />

        <Text
          style={{
            color: "#93c5fd",
            fontSize: 19,
            fontWeight: "800",
            marginTop: 14,
          }}
        >
          Loading resident record...
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
        {isEditMode
          ? "✏️ Edit Resident"
          : "➕ Add Resident"}
      </Text>

      <Text
        style={{
          color: "#93c5fd",
          fontSize: 19,
          marginTop: 8,
        }}
      >
        {isEditMode
          ? "Update resident profile and care needs"
          : "Create a new resident record"}
      </Text>

      <View
        style={{
          marginTop: 24,
          backgroundColor: "#081826",
          borderRadius: 18,
          padding: 20,
          borderWidth: 1,
          borderColor: "#2563eb",
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 26,
            fontWeight: "900",
          }}
        >
          👤 Personal Information
        </Text>

        <Text
          style={{
            color: "#93c5fd",
            fontSize: 16,
            fontWeight: "800",
            marginTop: 20,
          }}
        >
          Full name
        </Text>

        <TextInput
          value={fullName}
          onChangeText={setFullName}
          placeholder="Example: Mrs. Jane Smith"
          placeholderTextColor="#64748b"
          style={{
            backgroundColor: "#0d2942",
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#374151",
            color: "#fff",
            fontSize: 17,
            padding: 15,
            marginTop: 9,
          }}
        />

        <Text
          style={{
            color: "#93c5fd",
            fontSize: 16,
            fontWeight: "800",
            marginTop: 18,
          }}
        >
          Room
        </Text>

        <TextInput
          value={room}
          onChangeText={setRoom}
          placeholder="Example: Room 7"
          placeholderTextColor="#64748b"
          autoCapitalize="words"
          style={{
            backgroundColor: "#0d2942",
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#374151",
            color: "#fff",
            fontSize: 17,
            padding: 15,
            marginTop: 9,
          }}
        />

        <Text
          style={{
            color: "#93c5fd",
            fontSize: 16,
            fontWeight: "800",
            marginTop: 18,
          }}
        >
          Age
        </Text>

        <TextInput
          value={age}
          onChangeText={setAge}
          placeholder="Example: 84"
          placeholderTextColor="#64748b"
          keyboardType="number-pad"
          maxLength={3}
          style={{
            backgroundColor: "#0d2942",
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#374151",
            color: "#fff",
            fontSize: 17,
            padding: 15,
            marginTop: 9,
          }}
        />

        <Text
          style={{
            color: "#93c5fd",
            fontSize: 16,
            fontWeight: "800",
            marginTop: 18,
          }}
        >
          Date of birth
        </Text>

        <TextInput
          value={dateOfBirth}
          onChangeText={handleDateOfBirthChange}
          placeholder="Example: 1942-06-15"
          placeholderTextColor="#64748b"
          keyboardType="numbers-and-punctuation"
          maxLength={10}
          style={{
            backgroundColor: "#0d2942",
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#374151",
            color: "#fff",
            fontSize: 17,
            padding: 15,
            marginTop: 9,
          }}
        />

        {calculateAgeFromDateOfBirth(dateOfBirth) !== null && (
          <Text
            style={{
              color: "#22c55e",
              fontSize: 15,
              fontWeight: "800",
              marginTop: 8,
            }}
          >
            ✅ Age calculated automatically: {age} years
          </Text>
        )}
      </View>

      <View
        style={{
          marginTop: 22,
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
            fontSize: 26,
            fontWeight: "900",
          }}
        >
          📊 Current Status
        </Text>

        <Text
          style={{
            color: "#93c5fd",
            fontSize: 16,
            fontWeight: "800",
            marginTop: 20,
          }}
        >
          Resident status
        </Text>

        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            marginTop: 12,
          }}
        >
          {renderChoiceButton(
            "🟢 Safe",
            status === "SAFE",
            () => setStatus("SAFE"),
            "#22c55e"
          )}

          {renderChoiceButton(
            "🟡 Attention",
            status === "ATTENTION",
            () =>
              setStatus("ATTENTION"),
            "#fbbf24"
          )}

          {renderChoiceButton(
            "🔴 Critical",
            status === "CRITICAL",
            () =>
              setStatus("CRITICAL"),
            "#ef4444"
          )}
        </View>

        <Text
          style={{
            color: "#93c5fd",
            fontSize: 16,
            fontWeight: "800",
            marginTop: 12,
          }}
        >
          Current activity
        </Text>

        <TextInput
          value={activity}
          onChangeText={setActivity}
          placeholder="Example: Resting"
          placeholderTextColor="#64748b"
          style={{
            backgroundColor: "#0d2942",
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#374151",
            color: "#fff",
            fontSize: 17,
            padding: 15,
            marginTop: 9,
          }}
        />
      </View>

      <View
        style={{
          marginTop: 22,
          backgroundColor: "#081826",
          borderRadius: 18,
          padding: 20,
          borderWidth: 1,
          borderColor: "#fbbf24",
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 26,
            fontWeight: "900",
          }}
        >
          📝 Care Needs
        </Text>

        <Text
          style={{
            color: "#93c5fd",
            fontSize: 16,
            fontWeight: "800",
            marginTop: 20,
          }}
        >
          Fall risk
        </Text>

        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            marginTop: 12,
          }}
        >
          {renderChoiceButton(
            "Low",
            fallRisk === "LOW",
            () => setFallRisk("LOW"),
            "#22c55e"
          )}

          {renderChoiceButton(
            "Medium",
            fallRisk === "MEDIUM",
            () =>
              setFallRisk("MEDIUM"),
            "#60a5fa"
          )}

          {renderChoiceButton(
            "High",
            fallRisk === "HIGH",
            () => setFallRisk("HIGH"),
            "#fbbf24"
          )}
        </View>

        <Text
          style={{
            color: "#93c5fd",
            fontSize: 16,
            fontWeight: "800",
            marginTop: 12,
          }}
        >
          Mobility support
        </Text>

        <TextInput
          value={mobilitySupport}
          onChangeText={
            setMobilitySupport
          }
          placeholder="Example: Uses walking frame"
          placeholderTextColor="#64748b"
          multiline
          style={{
            backgroundColor: "#0d2942",
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#374151",
            color: "#fff",
            fontSize: 17,
            padding: 15,
            marginTop: 9,
            minHeight: 80,
            textAlignVertical: "top",
          }}
        />

        <Text
          style={{
            color: "#93c5fd",
            fontSize: 16,
            fontWeight: "800",
            marginTop: 18,
          }}
        >
          Observation frequency
        </Text>

        <TextInput
          value={observationFrequency}
          onChangeText={
            setObservationFrequency
          }
          placeholder="Example: Every 2 hours"
          placeholderTextColor="#64748b"
          style={{
            backgroundColor: "#0d2942",
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#374151",
            color: "#fff",
            fontSize: 17,
            padding: 15,
            marginTop: 9,
          }}
        />

        <Text
          style={{
            color: "#93c5fd",
            fontSize: 16,
            fontWeight: "800",
            marginTop: 18,
          }}
        >
          Medication assistance
        </Text>

        <View
          style={{
            flexDirection: "row",
            marginTop: 12,
          }}
        >
          {renderChoiceButton(
            "Required",
            medicationAssistance,
            () =>
              setMedicationAssistance(
                true
              ),
            "#22c55e"
          )}

          {renderChoiceButton(
            "Not required",
            !medicationAssistance,
            () =>
              setMedicationAssistance(
                false
              ),
            "#60a5fa"
          )}
        </View>

        <Text
          style={{
            color: "#93c5fd",
            fontSize: 16,
            fontWeight: "800",
            marginTop: 12,
          }}
        >
          Emergency contact
        </Text>

        <TextInput
          value={emergencyContact}
          onChangeText={
            setEmergencyContact
          }
          placeholder="Name and contact details"
          placeholderTextColor="#64748b"
          multiline
          style={{
            backgroundColor: "#0d2942",
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#374151",
            color: "#fff",
            fontSize: 17,
            padding: 15,
            marginTop: 9,
            minHeight: 90,
            textAlignVertical: "top",
          }}
        />
      </View>

      <View
        style={{
          marginTop: 22,
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
          ⚠️ Resident-record accuracy
        </Text>

        <Text
          style={{
            color: "#fecaca",
            fontSize: 16,
            lineHeight: 24,
            marginTop: 8,
          }}
        >
          Confirm all resident identity,
          room and care-needs information
          against the organisation’s
          authorised records before saving.
        </Text>
      </View>

      <Pressable
        disabled={saving}
        onPress={saveResident}
        style={{
          backgroundColor: saving
            ? "#475569"
            : "#16a34a",
          padding: 18,
          borderRadius: 16,
          marginTop: 24,
          opacity: saving ? 0.75 : 1,
        }}
      >
        <Text
          style={{
            color: "#fff",
            textAlign: "center",
            fontSize: 21,
            fontWeight: "900",
          }}
        >
          {saving
            ? "⏳ Saving Resident..."
            : isEditMode
            ? "✅ Save Resident Changes"
            : "➕ Create Resident"}
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