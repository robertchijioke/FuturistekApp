  import { useRouter } from "expo-router";
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Alert, Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { auth, db } from "../lib/firebase";

  export default function SavedSnapshotsScreen() {
    const router = useRouter();
    const [snapshots, setSnapshots] = useState<any[]>([]);
    const [selectedFilter, setSelectedFilter] = useState("All");
    const [searchText, setSearchText] = useState("");
    const [showSummary, setShowSummary] = useState(false);
    const [aiAnswer, setAiAnswer] = useState("");

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

        setSnapshots(
          data.filter(
            (item: any) =>
              !item.archived &&
              !item.deleted
          )
        );
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
      const search = searchText.toLowerCase().trim();

    const isUnusualQuestion =
      search.includes("worry") ||
      search.includes("unusual") ||
      search.includes("unsual") ||
      search.includes("danger") ||
      search.includes("suspicious");

      const itemDate = item.createdAt?.toDate?.();
      const today = new Date();

      const isToday =
        itemDate &&
        itemDate.toDateString() === today.toDateString();

      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);

      const isYesterday =
        itemDate &&
        itemDate.toDateString() === yesterday.toDateString();

      const text = String(
        `${item.cameraName || ""} ${item.room || ""} ${item.type || ""} ${
          item.aiClassification || ""
        } ${item.threatLevel || ""}`
      ).toLowerCase();

      const matchesSearch =
        search.length === 0 ||
        (() => {
          if (isUnusualQuestion) {
            return String(item.threatLevel || "").toUpperCase() === "HIGH";
          }

          return search.split(" ").every((word) => {
            if (word === "today") return isToday;
            if (word === "yesterday") return isYesterday;
            if (word === "high") return String(item.threatLevel).toUpperCase() === "HIGH";
            if (word === "medium") return String(item.threatLevel).toUpperCase() === "MEDIUM";
            if (word === "low") return String(item.threatLevel).toUpperCase() === "LOW";
            if (word === "packages" || word === "package") return text.includes("package");
            if (word === "pets" || word === "pet") return text.includes("pet") || text.includes("animal");
            if (word === "people" || word === "person") return text.includes("person");
            if (word === "vehicles" || word === "vehicle" || word === "car") return text.includes("vehicle") || text.includes("car");

            return text.includes(word);
             });
           })();

      const matchesFilter = (() => {
        if (selectedFilter === "All") return true;

        if (selectedFilter.includes("People")) return text.includes("person");
        if (selectedFilter.includes("Packages")) return text.includes("package");
        if (selectedFilter.includes("Pets")) return text.includes("pet") || text.includes("animal");
        if (selectedFilter.includes("Vehicles")) return text.includes("vehicle") || text.includes("car");
        if (selectedFilter.includes("High Risk")) return String(item.threatLevel || "").toUpperCase() === "HIGH";

        return true;
      })();

      return matchesSearch && matchesFilter;
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

  const archiveSnapshot = async (item: any) => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      await updateDoc(
        doc(db, "users", user.uid, "securityCaptures", item.id),
        {
          archived: true,
        }
      );

      Alert.alert("📁 Archived", "Snapshot moved to Archived Snapshots successfully.");
    } catch (error) {
      console.error(error);
      Alert.alert("Archive Error", "Could not archive this snapshot.");
    }
  };

  const deleteSnapshot = async (item: any) => {
    Alert.alert(
      "Delete Snapshot?",
      "This snapshot will be removed permanently.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const user = auth.currentUser;
            if (!user) return;

            await deleteDoc(
              doc(db, "users", user.uid, "securityCaptures", item.id)
            );
          },
        },
      ]
    );
  };

  const showAISummary = () => {
  const total = filteredSnapshots.length;

  const highRisk = filteredSnapshots.filter(
    (item) => String(item.threatLevel || "").toUpperCase() === "HIGH"
  ).length;

  const packages = filteredSnapshots.filter((item) =>
    String(item.aiClassification || item.type || "")
      .toLowerCase()
      .includes("package")
  ).length;

  const pets = filteredSnapshots.filter((item) => {
    const text = String(item.aiClassification || item.type || "").toLowerCase();
    return text.includes("pet") || text.includes("animal");
  }).length;

  const people = filteredSnapshots.filter((item) =>
    String(item.aiClassification || item.type || "")
      .toLowerCase()
      .includes("person")
  ).length;

    Alert.alert(
      "🧠 Futuristek AI Summary",
      `${searchText.trim() ? `Found ${total} matching snapshots.` : `Summary of all saved snapshots: ${total} total.`}\n\n` +
        `🔴 High Risk: ${highRisk}\n` +
        `📦 Packages: ${packages}\n` +
        `🐕 Pets: ${pets}\n` +
        `👤 People: ${people}\n\n` +
        `${
          highRisk > 0
            ? "⚠️ Attention recommended. High-risk activity was detected."
            : "✅ No high-risk activity found in this view."
        }`
    );
  };

    const highRisk = filteredSnapshots.filter(
    (item: any) =>
      String(item.threatLevel || "").toUpperCase() === "HIGH"
  ).length;

  const packages = filteredSnapshots.filter((item: any) =>
    String(item.aiClassification || item.type || "")
      .toLowerCase()
      .includes("package")
  ).length;

  const pets = filteredSnapshots.filter((item: any) => {
    const text = String(
      item.aiClassification || item.type || ""
    ).toLowerCase();

    return text.includes("pet") || text.includes("animal");
  }).length;

  const people = filteredSnapshots.filter((item: any) =>
    String(item.aiClassification || item.type || "")
      .toLowerCase()
      .includes("person")
  ).length;

  const aiRecommendation =
      highRisk === 0
        ? "✅ Everything looks normal. No high-risk activity was detected."
        : highRisk === 1
        ? "⚠️ One HIGH RISK event requires your attention."
        : "🚨 Multiple HIGH RISK events detected. Immediate review is recommended.";

  const askFuturistek = () => {
    const query = searchText.toLowerCase().trim();

    if (
      query.includes("worry") ||
      query.includes("unusual") ||
      query.includes("danger") ||
      query.includes("suspicious")
    ) {
      const allHighRisk = snapshots.filter(
        (item: any) =>
          String(item.threatLevel || "").toUpperCase() === "HIGH"
      );

      setAiAnswer(
        allHighRisk.length > 0
          ? `Yes. I found ${allHighRisk.length} high-risk event${
              allHighRisk.length === 1 ? "" : "s"
            }. Review the most recent high-risk snapshot first.`
          : "I did not find anything unusual. No high-risk activity was detected."
      );

      return;
    }

    if (!query) {
      setAiAnswer(
        `I analyzed ${snapshots.length} saved security events. ` +
          `I found ${highRisk} high-risk event${highRisk === 1 ? "" : "s"}, ` +
          `${packages} package event${packages === 1 ? "" : "s"}, ` +
          `${pets} pet detection${pets === 1 ? "" : "s"}, and ` +
          `${people} person detection${people === 1 ? "" : "s"}.`
      );
      return;
    }

    setAiAnswer(
      `I found ${filteredSnapshots.length} security event${
        filteredSnapshots.length === 1 ? "" : "s"
      } matching "${searchText}".`
    );
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
        💾 Saved Snapshots
      </Text>

      <TextInput
        value={searchText}
        onChangeText={setSearchText}
        onSubmitEditing={askFuturistek}
        returnKeyType="search"
        placeholder='Ask Futuristek… e.g. "motion high"'
        placeholderTextColor="#8faac4"
        style={{
          backgroundColor: "#06284d",
          color: "#fff",
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: 16,
          fontSize: 16,
          marginBottom: 16,
          borderWidth: 1,
          borderColor: "#0b5c9c",
        }}
      />

      {aiAnswer.length > 0 && (
        <View
          style={{
            backgroundColor: "#0b3158",
            borderRadius: 18,
            padding: 18,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: "#1f6fb2",
          }}
        >
          <Text style={{ color: "#fff", fontSize: 20, fontWeight: "800" }}>
            🧠 Futuristek
          </Text>

          <Text style={{ color: "#c7d8ea", fontSize: 16, marginTop: 10 }}>
            {aiAnswer}
          </Text>
        </View>
      )}

      <Pressable
        onPress={() => setShowSummary(!showSummary)}
        style={{
          backgroundColor: "#1f6fb2",
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: 16,
          marginBottom: 16,
          borderWidth: 1,
          borderColor: "#42a5ff",
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 16,
            fontWeight: "800",
          }}
        >
          🧠 {showSummary ? "Hide AI Summary" : "AI Summary"}
        </Text>
      </Pressable>

      {showSummary && (
        <View
          style={{
            backgroundColor: "#0b3158",
            borderRadius: 18,
            padding: 18,
            marginBottom: 18,
            borderWidth: 1,
            borderColor: "#1f6fb2",
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontSize: 20,
              fontWeight: "800",
              marginBottom: 12,
            }}
          >
            🧠 Futuristek AI Summary
          </Text>

          <Text style={{ color: "#c7d8ea", fontSize: 16, marginBottom: 12 }}>
            {searchText.trim()
              ? `AI analyzed ${filteredSnapshots.length} matching security events.`
              : `AI analyzed ${filteredSnapshots.length} saved security events.`}
          </Text>

          <Text style={{ color: "#fff", fontSize: 16 }}>🔴 High Risk: {highRisk}</Text>
          <Text style={{ color: "#fff", fontSize: 16 }}>📦 Packages: {packages}</Text>
          <Text style={{ color: "#fff", fontSize: 16 }}>🐕 Pets: {pets}</Text>
          <Text style={{ color: "#fff", fontSize: 16 }}>👤 People: {people}</Text>

          <Text
            style={{
              color: highRisk > 0 ? "#ffd166" : "#7df3a6",
              fontSize: 16,
              marginTop: 16,
              fontWeight: "700",
            }}
          >
            {aiRecommendation}
          </Text>
        </View>
      )}

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
                archiveSnapshot(item);
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
                📂 Archive
              </Text>
            </Pressable>

            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                deleteSnapshot(item);
              }}
              style={{
                marginTop: 10,
                backgroundColor: "#8b1e1e",
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 12,
                alignSelf: "flex-start",
              }}
            >
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>
                🗑 Delete
              </Text>
            </Pressable>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}