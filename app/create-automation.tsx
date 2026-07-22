import { useRouter } from "expo-router";
import { addDoc, collection, onSnapshot, serverTimestamp } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { auth, db } from "../lib/firebase";

export default function CreateAutomationScreen() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState("Motion Detected");
  const [action, setAction] = useState("Turn ON");

  const [triggerDeviceId, setTriggerDeviceId] = useState("");
  const [triggerDeviceName, setTriggerDeviceName] = useState("");

  const [actionDeviceId, setActionDeviceId] = useState("");
  const [actionDeviceName, setActionDeviceName] = useState("");

  const [timeStart, setTimeStart] = useState("23:00");
  const [timeEnd, setTimeEnd] = useState("06:00");
  const [notify, setNotify] = useState(true);
  const [devices, setDevices] = useState<any[]>([]);
  const [selecting, setSelecting] = useState<"trigger" | "action" | null>(null);

  useEffect(() => {
  const user = auth.currentUser;
  if (!user) return;

  const unsubscribe = onSnapshot(
    collection(db, "users", user.uid, "devices"),
    (snapshot: any) => {
      const list = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setDevices(list);
    }
  );

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

      <Text style={styles.title}>Create Automation</Text>

      <Text style={styles.label}>Automation Name</Text>

      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Night Motion Light"
        placeholderTextColor="#777"
      />

      <Text style={styles.label}>Trigger</Text>

      <Text style={styles.label}>Trigger Device</Text>

     <Pressable
        style={styles.card}
        onPress={() => setSelecting("trigger")}
      >
        <Text style={styles.cardText}>
          {triggerDeviceName || "Select Sensor"}
        </Text>
      </Pressable>

      <View style={styles.card}>
        <Text style={styles.cardText}>{trigger}</Text>
      </View>

      <Text style={styles.label}>Action</Text>

      <Text style={styles.label}>Action Device</Text>

      <Pressable
        style={styles.card}
        onPress={() => setSelecting("action")}
      >
        <Text style={styles.cardText}>
          {actionDeviceName || "Select Device"}
        </Text>
      </Pressable>

      {selecting && (
        <View style={styles.card}>
          {devices
            .filter((device) =>
              selecting === "trigger"
                ? device.type === "Sensor"
                : device.type === "Smart Light" ||
                  device.type === "Smart Plug"
            )
            .map((device) => (
              <Pressable
                key={device.id}
                style={{ paddingVertical: 12 }}
                onPress={() => {
                  if (selecting === "trigger") {
                    setTriggerDeviceId(device.id);
                    setTriggerDeviceName(device.name);
                  } else {
                    setActionDeviceId(device.id);
                    setActionDeviceName(device.name);
                  }

                  setSelecting(null);
                }}
              >
                <Text style={styles.cardText}>
                  {device.name}
                </Text>
              </Pressable>
            ))}
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardText}>{action}</Text>
      </View>

      <Pressable
        style={styles.button}
        onPress={async () => {
          const user = auth.currentUser;

          if (!user) {
            Alert.alert("Login required", "Please log in to save automations.");
            return;
          }

          if (!name.trim()) {
            Alert.alert("Name required", "Please enter an automation name.");
            return;
          }

          try {
            await addDoc(collection(db, "users", user.uid, "automations"), {
              name: name.trim(),
              trigger,
              action,

              triggerDeviceId,
              triggerDeviceName,

              actionDeviceId,
              actionDeviceName,

              timeStart,
              timeEnd,
              enabled: true,
              notify,
              createdAt: serverTimestamp(),
            });

            Alert.alert("Automation saved", `${name.trim()} has been created.`);
            router.back();
          } catch (error) {
            console.log("Save automation error:", error);
            Alert.alert("Error", "Could not save automation.");
          }
        }}
      >
        <Text style={styles.buttonText}>Save Automation</Text>
      </Pressable>
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
    fontSize: 42,
    fontWeight: "800",
    marginBottom: 30,
  },

  label: {
    color: "#fff",
    fontSize: 18,
    marginBottom: 10,
    marginTop: 10,
  },

  input: {
    backgroundColor: "#0B2340",
    color: "#fff",
    borderRadius: 18,
    padding: 18,
    marginBottom: 20,
  },

  card: {
    backgroundColor: "#0B2340",
    padding: 20,
    borderRadius: 18,
    marginBottom: 20,
  },

  cardText: {
    color: "#fff",
    fontSize: 18,
  },

  button: {
    backgroundColor: "#3498DB",
    padding: 20,
    borderRadius: 20,
    alignItems: "center",
    marginTop: 20,
  },

  buttonText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },

  content: {
  paddingBottom: 140,
},
});