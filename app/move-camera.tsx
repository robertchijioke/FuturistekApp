import { useLocalSearchParams, useRouter } from "expo-router";
import { collection, doc, getDoc, getDocs, writeBatch } from "firebase/firestore";
import { Alert, Pressable, Text, View } from "react-native";
import { auth, db } from "../lib/firebase";

export default function MoveCamera() {
  const router = useRouter();

  const { cameraId, currentSlot } = useLocalSearchParams<{
    cameraId: string;
    currentSlot?: string;
  }>();

  const moveToSlot = async (targetSlot: number) => {
    try {
      const user = auth.currentUser;
      if (!user || !cameraId) return;

      const devicesRef = collection(db, "users", user.uid, "devices");
      const movingRef = doc(db, "users", user.uid, "devices", String(cameraId));
      const movingSnap = await getDoc(movingRef);

      if (!movingSnap.exists()) {
        Alert.alert("Error", "Camera not found.");
        return;
      }

      const movingCamera: any = movingSnap.data();
      const oldSlot = Number(movingCamera.slot || 0);
      const targetSlotNumber = Number(targetSlot);

      if (oldSlot === targetSlotNumber) {
        router.back();
        return;
      }

      const allSnap = await getDocs(devicesRef);

      const occupiedDoc = allSnap.docs.find((d) => {
        const data: any = d.data();

        const isCamera = String(data.type || "").toLowerCase() === "camera";
        const isCctv =
          String(data.propertyId || "").toLowerCase() === "cctv-wall" ||
          String(data.source || "").toLowerCase() === "cctv-wall";

        return (
          d.id !== String(cameraId) &&
          isCamera &&
          isCctv &&
          Number(data.slot) === targetSlotNumber
        );
      });

      const completeMove = async () => {
        const batch = writeBatch(db);

        if (occupiedDoc) {
          batch.update(doc(db, "users", user.uid, "devices", occupiedDoc.id), {
            slot: oldSlot,
            propertyId: "cctv-wall",
            source: "cctv-wall",
          });
        }

        batch.update(movingRef, {
          slot: targetSlotNumber,
          propertyId: "cctv-wall",
          source: "cctv-wall",
        });

        await batch.commit();

        Alert.alert("Camera moved", `Camera moved to slot ${targetSlotNumber}.`);
        router.back();
      };

      if (occupiedDoc) {
        const occupiedCamera: any = occupiedDoc.data();

        Alert.alert(
          "Slot occupied",
          `Slot ${targetSlotNumber} already has ${
            occupiedCamera.room || occupiedCamera.name || "another camera"
          }.\n\nDo you want to swap them?`,
          [
            { text: "Cancel", style: "cancel" },
            { text: "Swap", onPress: completeMove },
          ]
        );

        return;
      }

      await completeMove();
    } catch (error) {
      console.log("MOVE CAMERA ERROR:", error);
      Alert.alert("Error", "Could not move camera.");
    }
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#021a35",
        padding: 24,
        paddingTop: 70,
      }}
    >
      <Pressable onPress={() => router.back()}>
        <Text style={{ color: "#7ea6ff", fontSize: 20, marginBottom: 35 }}>
          ← Back
        </Text>
      </Pressable>

      <Text
        style={{
          color: "#fff",
          fontSize: 42,
          fontWeight: "800",
          marginBottom: 12,
        }}
      >
        🔀 Move Camera
      </Text>

      <Text style={{ color: "#b8c7d9", fontSize: 20, marginBottom: 30 }}>
        Choose a CCTV Wall slot
      </Text>

      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
          rowGap: 14,
        }}
      >
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((slot) => {
          const isCurrent = String(slot) === String(currentSlot);

          return (
            <Pressable
              key={slot}
              onPress={() => moveToSlot(slot)}
              style={{
                width: "31%",
                height: 110,
                backgroundColor: isCurrent ? "#3d6df2" : "#0a2b52",
                borderRadius: 16,
                borderWidth: 1,
                borderColor: isCurrent ? "#7ea6ff" : "#1e3a5f",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  color: "#fff",
                  fontSize: 34,
                  fontWeight: "800",
                }}
              >
                {slot}
              </Text>

              <Text
                style={{
                  color: "#b8c7d9",
                  fontSize: 13,
                  marginTop: 6,
                }}
              >
                {isCurrent ? "Current Slot" : "Slot"}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}