  import { useRouter } from "expo-router";
import { addDoc, collection, doc, getDoc, getDocs, serverTimestamp, updateDoc } from "firebase/firestore";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { auth, db } from "../lib/firebase";
import { sendPushNotification } from "../lib/sendPush";

  export default function ScenesScreen() {
    const router = useRouter();

    async function runGoodNightScene() {
      const user = auth.currentUser;

      if (!user) {
        Alert.alert("Login required", "Please log in to run scenes.");
        return;
      }

      try {
        const devicesRef = collection(db, "users", user.uid, "devices");
        const snapshot = await getDocs(devicesRef);

        const updates = snapshot.docs.map((deviceDoc) => {
          const device = deviceDoc.data();

          const isSensor = String(device.type).toLowerCase().includes("sensor");

          return updateDoc(doc(db, "users", user.uid, "devices", deviceDoc.id), {
            status: isSensor ? true : false,
            brightness: isSensor ? device.brightness ?? 100 : 0,
          });
        });

        await Promise.all(updates);

        await addDoc(collection(db, "users", user.uid, "activityLog"), {
        event: "Scene activated",
        action: "Good Night mode activated",
        automation: "Good Night",
        createdAt: serverTimestamp(),
      });

      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        const expoPushToken = userData?.expoPushToken;

        if (expoPushToken) {
          await sendPushNotification(
            expoPushToken,
            "🌙 Good Night activated",
            "Your home has been set for night mode.",
            {
              type: "scene",
              scene: "Good Night",
            }
          );
        }
      }

        Alert.alert("Good Night activated", "Devices updated successfully.");
        router.back();
      } catch (error) {
        console.log("Good night scene error:", error);
        Alert.alert("Error", "Could not run Good Night scene.");
      }
    }

  async function runMovieModeScene() {
    const user = auth.currentUser;

    if (!user) {
      Alert.alert("Login required", "Please log in to run scenes.");
      return;
    }

    try {
      const devicesRef = collection(db, "users", user.uid, "devices");
      const snapshot = await getDocs(devicesRef);

      const updates = snapshot.docs.map((deviceDoc) => {
        const device = deviceDoc.data();

        const type = String(device.type).toLowerCase();
        const room = String(device.room).toLowerCase();

        let newStatus = device.status;

        if (type.includes("light")) {
          newStatus = room.includes("living");
        }

        if (
          type.includes("plug") ||
          type.includes("camera") ||
          type.includes("remote") ||
          type.includes("sensor")
        ) {
          newStatus = true;
        }

        return updateDoc(
          doc(db, "users", user.uid, "devices", deviceDoc.id),
          {
            status: newStatus,
            brightness: newStatus ? 100 : 0,
          }
        );
      });

      await Promise.all(updates);

      await addDoc(collection(db, "users", user.uid, "activityLog"), {
        event: "Scene activated",
        action: "Movie Mode activated",
        automation: "Movie Mode",
        createdAt: serverTimestamp(),
      });

      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        const expoPushToken = userData?.expoPushToken;

        if (expoPushToken) {
          await sendPushNotification(
            expoPushToken,
            "🎬 Movie Mode activated",
            "Entertainment devices are ready.",
            {
              type: "scene",
              scene: "Movie Mode",
            }
          );
        }
      }

      Alert.alert(
        "Movie Mode Activated",
        "Entertainment devices are ready."
      );

      router.back();
    } catch (error) {
      console.log("Movie mode error:", error);
      Alert.alert("Error", "Could not run Movie Mode.");
    }
  }

  async function runMorningModeScene() {
    const user = auth.currentUser;

    if (!user) {
      Alert.alert("Login required", "Please log in to run scenes.");
      return;
    }

    try {
      const devicesRef = collection(db, "users", user.uid, "devices");
      const snapshot = await getDocs(devicesRef);

      const updates = snapshot.docs.map((deviceDoc) => {
        return updateDoc(
          doc(db, "users", user.uid, "devices", deviceDoc.id),
          {
            status: "Online",
            brightness: 100,
          }
        );
      });

      await Promise.all(updates);

     await addDoc(collection(db, "users", user.uid, "activityLog"), {
      event: "Scene activated",
      action: "Morning Mode activated",
      automation: "Morning",
      createdAt: serverTimestamp(),
    });

    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const userData = userSnap.data();
      const expoPushToken = userData?.expoPushToken;

      if (expoPushToken) {
        await sendPushNotification(
          expoPushToken,
          "☀️ Morning Mode activated",
          "Good morning! Your home is ready.",
          {
            type: "scene",
            scene: "Morning",
          }
        );
      }
    }

      Alert.alert(
        "Morning Mode Activated",
        "Good morning! All devices are ready."
      );

      router.back();
    } catch (error) {
      console.log("Morning mode error:", error);
      Alert.alert("Error", "Could not run Morning Mode.");
    }
  }

  async function runAwayModeScene() {
    const user = auth.currentUser;

    if (!user) {
      Alert.alert("Login required", "Please log in to run scenes.");
      return;
    }

    try {
      const devicesRef = collection(db, "users", user.uid, "devices");
      const snapshot = await getDocs(devicesRef);

      const updates = snapshot.docs.map((deviceDoc) => {
        const device = deviceDoc.data();
        const type = String(device.type).toLowerCase();

        const shouldStayOn =
          type.includes("camera") || type.includes("sensor");

        return updateDoc(doc(db, "users", user.uid, "devices", deviceDoc.id), {
          status: shouldStayOn,
          brightness: shouldStayOn ? device.brightness ?? 100 : 0,
        });
      });

      await Promise.all(updates);

      await addDoc(collection(db, "users", user.uid, "activityLog"), {
        event: "Scene activated",
        action: "Away Mode activated",
        automation: "Away Mode",
        createdAt: serverTimestamp(),
      });

      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        const expoPushToken = userData?.expoPushToken;

        if (expoPushToken) {
          await sendPushNotification(
            expoPushToken,
            "🏠 Away Mode activated",
            "Security devices are active while you're away.",
            {
              type: "scene",
              scene: "Away Mode",
            }
          );
        }
      }

      Alert.alert("Away Mode Activated", "Security devices are active.");
      router.back();
    } catch (error) {
      console.log("Away mode error:", error);
      Alert.alert("Error", "Could not run Away Mode.");
    }
  }

  return (
    <View style={styles.container}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>Scenes</Text>
      <Text style={styles.subtitle}>
        Control multiple devices with one tap.
      </Text>

      <View style={styles.grid}>
        <SceneCard
          emoji="🌙"
          title="Good Night"
          onPress={runGoodNightScene}
        />
          <SceneCard 
          emoji="🎬" 
          title="Movie Mode" 
          onPress={runMovieModeScene} 
        />
          <SceneCard 
          emoji="☀️" 
          title="Morning" 
          onPress={runMorningModeScene} 
        />
          <SceneCard 
          emoji="🚪" 
          title="Away Mode" 
          onPress={runAwayModeScene} 
        />
      </View>
    </View>
  );
}

function SceneCard({
  emoji,
  title,
  onPress,
}: {
  emoji: string;
  title: string;
  onPress?: () => void;
}) {

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={styles.cardTitle}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#071827",
    padding: 24,
    paddingTop: 70,
  },
  back: {
    color: "#7CC8FF",
    fontSize: 18,
    marginBottom: 24,
  },
  title: {
    color: "#fff",
    fontSize: 42,
    fontWeight: "800",
    marginBottom: 10,
  },
  subtitle: {
    color: "#9ca3af",
    fontSize: 18,
    marginBottom: 30,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  card: {
    width: "47%",
    backgroundColor: "#0B2236",
    borderRadius: 22,
    padding: 22,
    minHeight: 150,
    justifyContent: "center",
    alignItems: "center",
  },
  emoji: {
    fontSize: 36,
    marginBottom: 14,
  },
  cardTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
});