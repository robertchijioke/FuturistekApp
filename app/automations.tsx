import { useRouter } from "expo-router";
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { auth, db } from "../lib/firebase";

type Automation = {
  id: string;
  name: string;
  trigger: string;
  action: string;
  enabled: boolean;
  notify?: boolean;
  actionDeviceName?: string;
};

export default function AutomationsScreen() {
  const router = useRouter();
  const [automations, setAutomations] = useState<Automation[]>([]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const automationsRef = collection(db, "users", user.uid, "automations");
    const q = query(automationsRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Automation, "id">),
      }));

      setAutomations(list);
    });

    return unsubscribe;
  }, []);

  async function deleteAutomation(id: string, name: string) {
  const user = auth.currentUser;
  if (!user) return;

  Alert.alert(
    "Delete Automation",
    `Delete "${name}"?`,
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteDoc(
            doc(db, "users", user.uid, "automations", id)
          );
        },
      },
    ]
  );
}

async function toggleAutomation(
  id: string,
  currentValue: boolean
) {
  const user = auth.currentUser;
  if (!user) return;

  await updateDoc(
    doc(db, "users", user.uid, "automations", id),
    {
      enabled: !currentValue,
    }
  );
}

async function toggleAutomationNotify(id: string, currentNotify: boolean) {
  const user = auth.currentUser;
  if (!user) return;

  await updateDoc(
    doc(db, "users", user.uid, "automations", id),
    {
      notify: !currentNotify,
    }
  );
}

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>Automations</Text>

      <Text style={styles.subtitle}>
        Make your home react automatically
      </Text>

      <Pressable
        style={styles.addCard}
        onPress={() => router.push("/create-automation")}
      >
        <Text style={styles.addTitle}>➕ Create Automation</Text>
        <Text style={styles.addText}>Build smart rules for your devices</Text>
      </Pressable>

      {automations.length === 0 ? (
        <View style={styles.ruleCard}>
          <Text style={styles.ruleTitle}>No automations yet</Text>
          <Text style={styles.ruleText}>
            Create your first smart rule to get started.
          </Text>
        </View>
      ) : (
        automations.map((automation) => (
          <View key={automation.id} style={styles.ruleCard}>
            <Text style={styles.ruleTitle}>
              🤖 {automation.name}
            </Text>

            <Text style={styles.ruleText}>
              IF {automation.trigger}
            </Text>

            <Text style={styles.ruleText}>
              THEN {automation.action} {automation.actionDeviceName || ""}
            </Text>

            <Pressable
              onPress={() =>
                toggleAutomation(
                  automation.id,
                  automation.enabled
                )
              }
            >
              <Text
                style={[
                  styles.statusText,
                  {
                    color: automation.enabled
                      ? "#22C55E"
                      : "#EF4444",
                  },
                ]}
              >
                {automation.enabled
                  ? "🟢 Enabled"
                  : "🔴 Disabled"}
              </Text>
            </Pressable>

            <Pressable
              onPress={() =>
                toggleAutomationNotify(
                  automation.id,
                  automation.notify !== false
                )
              }
            >
              <Text style={styles.notifyText}>
                {automation.notify !== false
                  ? "🔔 Notifications ON"
                  : "🔕 Notifications OFF"}
              </Text>
            </Pressable>

            <Pressable
              style={styles.deleteButton}
              onPress={() =>
                deleteAutomation(
                  automation.id,
                  automation.name
                )
              }
            >
              <Text style={styles.deleteText}>
                Delete
              </Text>
            </Pressable>

          </View>
        ))
      )}
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
  back: {
    color: "#7CC8FF",
    fontSize: 18,
    marginBottom: 20,
  },
  title: {
    color: "#fff",
    fontSize: 46,
    fontWeight: "800",
  },
  subtitle: {
    color: "#9CA3AF",
    fontSize: 20,
    marginTop: 10,
    marginBottom: 30,
  },
  addCard: {
    backgroundColor: "#0B2340",
    padding: 24,
    borderRadius: 22,
    marginBottom: 24,
  },
  addTitle: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "700",
  },
  addText: {
    color: "#9CA3AF",
    fontSize: 16,
    marginTop: 8,
  },
  ruleCard: {
    backgroundColor: "#0B2340",
    padding: 24,
    borderRadius: 22,
    marginBottom: 18,
  },
  ruleTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 10,
  },
  ruleText: {
    color: "#9CA3AF",
    fontSize: 16,
    marginBottom: 4,
  },
  statusText: {
    color: "#22C55E",
    fontSize: 15,
    fontWeight: "700",
    marginTop: 10,
  },

  deleteButton: {
  marginTop: 12,
  alignSelf: "flex-start",
},

deleteText: {
  color: "#EF4444",
  fontWeight: "700",
  fontSize: 16,
},

notifyText: {
  color: "#38BDF8",
  fontSize: 16,
  fontWeight: "700",
  marginTop: 14,
},

contentContainer: {
  paddingBottom: 180,
},
});