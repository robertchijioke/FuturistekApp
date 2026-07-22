import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useRouter } from "expo-router";
import { auth, db } from "../lib/firebase";

export default function ActivityHistoryScreen() {
  const [logs, setLogs] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const logsRef = collection(
      db,
      "users",
      user.uid,
      "activityLog"
    );

    const q = query(
      logsRef,
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setLogs(items);
    });

    return unsubscribe;
  }, []);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >

      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>
        Activity History
      </Text>

      {logs.map((log) => (
        <View key={log.id} style={styles.card}>
          <Text style={styles.event}>
            {log.event}
          </Text>

          <Text style={styles.action}>
            {log.action}
          </Text>

          <Text style={styles.automation}>
            {log.automation}
          </Text>

          <Text style={styles.time}>
            {log.createdAt?.toDate?.().toLocaleString() || ""}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#071827",
    padding: 24,
    paddingTop: 70,
  },

  title: {
    color: "#fff",
    fontSize: 40,
    fontWeight: "800",
    marginBottom: 20,
  },

  card: {
    backgroundColor: "#0B2340",
    padding: 20,
    borderRadius: 20,
    marginBottom: 15,
  },

  event: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },

  action: {
    color: "#9CA3AF",
    marginTop: 6,
  },

  automation: {
    color: "#22C55E",
    marginTop: 10,
    fontWeight: "700",
  },

  back: {
  color: "#7CC8FF",
  fontSize: 18,
  marginBottom: 20,
},

time: {
  color: "#6B7280",
  marginTop: 8,
  fontSize: 12,
},

content: {
  paddingBottom: 120,
},
});