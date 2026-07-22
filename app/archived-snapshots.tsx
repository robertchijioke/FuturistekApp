    import { useRouter } from "expo-router";
import { collection, doc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Alert, Image, Pressable, ScrollView, Text, View } from "react-native";
import { auth, db } from "../lib/firebase";

    export default function SavedSnapshotsScreen() {
      const router = useRouter();
      const [snapshots, setSnapshots] = useState<any[]>([]);
      const [selectedFilter, setSelectedFilter] = useState("All");

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const q = query(
      collection(db, "users", user.uid, "securityCaptures"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setSnapshots(data.filter((item: any) => item.archived === true));
    });

    return unsubscribe;
  }, []);

      const getThreatBadge = (level: string) => {
        const threat = String(level || "MEDIUM").toUpperCase();

        if (threat === "HIGH") return "🔴 HIGH RISK";
        if (threat === "LOW") return "🟢 LOW RISK";

        return "🟡 MEDIUM RISK";
      };

      const formatTime = (item: any) => {
        const date = item.createdAt?.toDate?.();

        if (!date) return "🕒 Recently captured";

        return `🕒 ${date.toLocaleDateString()} • ${date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}`;
      };

      const getClassification = (item: any) => {
        const text = String(
          item.aiClassification || item.type || "Motion detected"
        ).toLowerCase();

        if (text.includes("person")) return "👤 Person Detected";
        if (text.includes("package")) return "📦 Package Delivered";
        if (text.includes("pet") || text.includes("animal")) return "🐕 Pet Detected";
        if (text.includes("vehicle") || text.includes("car")) return "🚗 Vehicle Detected";
        if (text.includes("motion")) return "🚨 Motion Detected";

        return `🧠 ${item.aiClassification || item.type || "AI Event"}`;
      };

    const filteredSnapshots = snapshots.filter((item) => {
      if (selectedFilter === "All") return true;

      const text = String(
        item.aiClassification || item.type || ""
      ).toLowerCase();

      const threat = String(item.threatLevel || "").toUpperCase();

      if (selectedFilter.includes("People")) {
        return text.includes("person");
      }

      if (selectedFilter.includes("Packages")) {
        return text.includes("package");
      }

      if (selectedFilter.includes("Pets")) {
        return text.includes("pet") || text.includes("animal");
      }

      if (selectedFilter.includes("Vehicles")) {
        return text.includes("vehicle") || text.includes("car");
      }

      if (selectedFilter.includes("High Risk")) {
        return threat === "HIGH";
      }

      return true;
    });

    const filters = [
      "All",
      "👤 People",
      "📦 Packages",
      "🐕 Pets",
      "🚗 Vehicles",
      "🔴 High Risk",
    ];

    const toggleFavorite = async (item: any) => {
      const user = auth.currentUser;
      if (!user) return;

      await updateDoc(doc(db, "users", user.uid, "securityCaptures", item.id), {
        favorite: !item.favorite,
      });
    };

    const restoreSnapshot = async (item: any) => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      await updateDoc(
        doc(db, "users", user.uid, "securityCaptures", item.id),
        {
          archived: false,
        }
      );

      Alert.alert("Restored", "Snapshot restored to Saved Snapshots.");
    } catch (error) {
      console.error(error);
      Alert.alert("Restore Failed", "Unable to restore snapshot.");
    }
  };

  return (
    <ScrollView
      style={{
        flex: 1,
        backgroundColor: "#021a35",
        padding: 20,
        paddingTop: 60,
      }}
      contentContainerStyle={{ paddingBottom: 120 }}
    >
      <Pressable onPress={() => router.back()}>
        <Text style={{ color: "#8fd3ff", fontSize: 18, marginBottom: 24 }}>
          ← Back
        </Text>
      </Pressable>

      <Text
        style={{
          color: "#fff",
          fontSize: 36,
          fontWeight: "800",
          marginBottom: 20,
        }}
      >
        💾 Archived Snapshots
      </Text>

      <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 20 }}
        >
          {filters.map((filter) => (
            <Pressable
              key={filter}
              onPress={() => setSelectedFilter(filter)}
              style={{
                backgroundColor:
                  selectedFilter === filter ? "#2b78ff" : "#0b2b4f",
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 30,
                marginRight: 10,
              }}
            >
              <Text
                style={{
                  color: "#fff",
                  fontWeight: "700",
                }}
              >
                {filter}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

      {filteredSnapshots.length === 0 ? (
        <Text style={{ color: "#b8c7d9", fontSize: 18 }}>
          No saved snapshots yet.
        </Text>
      ) : (
        filteredSnapshots.map((item) => (
          <Pressable
            key={item.id}
            onPress={() =>
              router.push({
                pathname: "/snapshot-viewer",
                params: {
                  savedSnapshotId: item.id,
                  snapshotId: item.snapshotId || item.id,
                  cameraId: item.cameraId,
                  cameraName: item.cameraName || item.room,
                  room: item.room,
                  type: item.type,
                  image: item.image || item.thumbnail,
                  thumbnail: item.thumbnail || item.image,
                },
              })
            }
            style={{
              backgroundColor: "#06284d",
              borderRadius: 18,
              padding: 14,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: "#0b5c9c",
            }}
          >
            {(item.thumbnail || item.image) ? (
              <Image
                source={{ uri: item.thumbnail || item.image }}
                style={{
                  width: "100%",
                  height: 190,
                  borderRadius: 14,
                  marginBottom: 12,
                  backgroundColor: "#011224",
                }}
                resizeMode="cover"
              />
            ) : (
              <View
                style={{
                  height: 190,
                  borderRadius: 14,
                  marginBottom: 12,
                  backgroundColor: "#011224",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "#8faac4", fontSize: 16 }}>
                  No image preview
                </Text>
              </View>
            )}

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontSize: 22, fontWeight: "800", flex: 1 }}>
                📷 {item.cameraName || item.room || "Camera Snapshot"}
              </Text>

              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  toggleFavorite(item);
                }}
              >
                <Text
                  style={{
                    fontSize: 30,
                    color: item.favorite ? "#FFD700" : "#B8C7D9",
                  }}
                >
                  {item.favorite ? "★" : "☆"}
                </Text>
              </Pressable>
            </View>

            <Text style={{ color: "#b8c7d9", fontSize: 16, marginTop: 8 }}>
              {getClassification(item)}
            </Text>

            <Text style={{ color: "#8fd3ff", fontSize: 16, marginTop: 6 }}>
              {getThreatBadge(item.threatLevel)}
            </Text>

            <Text style={{ color: "#9fb2c7", fontSize: 14, marginTop: 8 }}>
              {formatTime(item)}
            </Text>

            <Text style={{ color: "#7f94aa", fontSize: 13, marginTop: 10 }}>
              Tap to view full snapshot
            </Text>

            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                restoreSnapshot(item);
              }}
              style={{
                marginTop: 12,
                backgroundColor: "#164d7a",
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 12,
                alignSelf: "flex-start",
              }}
            >
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>
                ♻ Restore
              </Text>
            </Pressable>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}