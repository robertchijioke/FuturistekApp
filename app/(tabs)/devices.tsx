  import { useLocalSearchParams, useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { startAutomationEngine } from "../../lib/automationEngine";
import { auth, db } from "../../lib/firebase";

  function getDeviceIcon(type: string) {
    switch (type) {
      case "Smart Light":
        return "💡";

      case "Camera":
        return "📷";

      case "Smart Plug":
        return "🔌";

      case "Sensor":
        return "📡";

      case "IR Remote":
        return "📺";

      default:
        return "🏠";
    }
  }

  type DevicesAccessState =
    | "checking"
    | "signedOut"
    | "siteManager"
    | "allowed"
    | "error";

  export default function DevicesScreen() {
    const router = useRouter();

    const { propertyId } = useLocalSearchParams();
    const currentPropertyId = String(propertyId || "home");

    const [devices, setDevices] = useState<any[]>([]);
    const [brightness, setBrightness] = useState(100);
    const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
    const [automations, setAutomations] = useState<any[]>([]);
    const [devicesAccessState, setDevicesAccessState] =
      useState<DevicesAccessState>("checking");


  useEffect(() => {
    let unsubscribeDevices:
      | (() => void)
      | null = null;

    let unsubscribeAutomations:
      | (() => void)
      | null = null;

    let accessCheckVersion = 0;

    const stopDataListeners = () => {
      unsubscribeDevices?.();
      unsubscribeAutomations?.();

      unsubscribeDevices = null;
      unsubscribeAutomations = null;
    };

    const unsubscribeAuth = onAuthStateChanged(
      auth,
      (user) => {
        accessCheckVersion += 1;

        const currentCheckVersion =
          accessCheckVersion;

        stopDataListeners();

        setDevices([]);
        setAutomations([]);

        if (!user) {
          setDevicesAccessState("signedOut");
          return;
        }

        setDevicesAccessState("checking");

        void (async () => {
          try {
            const accessProfileSnapshot =
              await getDoc(
                doc(
                  db,
                  "userAccessProfiles",
                  user.uid
                )
              );

            if (
              currentCheckVersion !==
              accessCheckVersion
            ) {
              return;
            }

            if (accessProfileSnapshot.exists()) {
              const accessData =
                accessProfileSnapshot.data();

              const role = String(
                accessData.role ?? ""
              )
                .trim()
                .toUpperCase();

              const isSiteManager =
                accessData.enabled === true &&
                role === "SITE_MANAGER";

              if (isSiteManager) {
                console.log(
                  "DEVICES ACCESS BLOCKED FOR SITE MANAGER:",
                  {
                    uid: user.uid,
                    role,
                  }
                );

                setDevicesAccessState(
                  "siteManager"
                );

                return;
              }
            }

            setDevicesAccessState("allowed");

            await Promise.resolve(
              startAutomationEngine()
            ).catch((error) => {
              console.error(
                "AUTOMATION ENGINE START ERROR:",
                error
              );
            });

            if (
              currentCheckVersion !==
                accessCheckVersion ||
              auth.currentUser?.uid !== user.uid
            ) {
              return;
            }

            const devicesQuery = query(
              collection(
                db,
                "users",
                user.uid,
                "devices"
              ),
              orderBy("createdAt", "desc")
            );

            unsubscribeDevices = onSnapshot(
              devicesQuery,
              (snapshot) => {
                const list = snapshot.docs.map(
                  (document) => ({
                    id: document.id,
                    ...document.data(),
                  })
                );

                const filteredList = list.filter(
                  (device: any) =>
                    String(
                      device.propertyId || "home"
                    ) === currentPropertyId
                );

                setDevices(filteredList);
              },
              (error) => {
                console.error(
                  "DEVICES LISTENER ERROR:",
                  error
                );

                setDevices([]);
                setDevicesAccessState("error");
              }
            );

            const automationsQuery = query(
              collection(
                db,
                "users",
                user.uid,
                "automations"
              ),
              orderBy("createdAt", "desc")
            );

            unsubscribeAutomations =
              onSnapshot(
                automationsQuery,
                (snapshot) => {
                  const list =
                    snapshot.docs.map(
                      (document) => ({
                        id: document.id,
                        ...document.data(),
                      })
                    );

                  setAutomations(list);
                },
                (error) => {
                  console.error(
                    "AUTOMATIONS LISTENER ERROR:",
                    error
                  );

                  setAutomations([]);
                  setDevicesAccessState(
                    "error"
                  );
                }
              );
          } catch (error) {
            console.error(
              "DEVICES ACCESS CHECK ERROR:",
              error
            );

            if (
              currentCheckVersion ===
              accessCheckVersion
            ) {
              setDevicesAccessState("error");
            }
          }
        })();
      }
    );

    return () => {
      accessCheckVersion += 1;

      stopDataListeners();
      unsubscribeAuth();
    };
  }, [currentPropertyId]);

    const roomCounts = devices.reduce((acc: any, device: any) => {
      const room = device.room || "Other";
      acc[room] = (acc[room] || 0) + 1;
      return acc;
    }, {});

    const isOnline = (device: any) =>
      device.status === true ||
      device.online === true ||
      String(device.status || "").toLowerCase() === "online";

    const onlineDevices = devices.filter(isOnline).length;

    const offlineDevices = devices.filter(
      (device) => !isOnline(device)
    ).length;

    const totalRooms = Object.keys(roomCounts).length;

    const lightCount = devices.filter((d) =>
      String(d.type).toLowerCase().includes("light")
    ).length;

    const plugCount = devices.filter((d) =>
      String(d.type).toLowerCase().includes("plug")
    ).length;

    const cameraCount = devices.filter((d) =>
      String(d.type).toLowerCase().includes("camera")
    ).length;

    const sensorCount = devices.filter((d) =>
      String(d.type).toLowerCase().includes("sensor")
    ).length;

    const remoteCount = devices.filter((d) =>
      String(d.type).toLowerCase().includes("remote")
    ).length;

    const visibleDevices = selectedRoom
    ? devices.filter((device) => device.room === selectedRoom)
    : devices;

    async function quickToggleDevice(device: any) {
    const user = auth.currentUser;
    if (!user || !device.id) return;

    const nextStatus = !device.status;

    await updateDoc(doc(db, "users", user.uid, "devices", device.id), {
      status: nextStatus,
      isOn: nextStatus,
      online: nextStatus,
      brightness: nextStatus ? device.brightness ?? 100 : 0,
      lastSeen: new Date(),
    });
  }

  const homeDevices = devices.filter(
    (device: any) => String(device.propertyId || "home") === "home"
  );

  if (devicesAccessState === "checking") {
    return (
      <View style={styles.accessContainer}>
        <Text style={styles.accessTitle}>
          Checking device access...
        </Text>

        <Text style={styles.accessText}>
          Your account permissions are being verified.
        </Text>
      </View>
    );
  }

  if (devicesAccessState === "signedOut") {
    return (
      <View style={styles.accessContainer}>
        <Text style={styles.accessTitle}>
          🏠 Your Smart Home
        </Text>

        <Text style={styles.accessText}>
          Sign in to view and control your connected
          smart-home devices.
        </Text>

        <Pressable
          onPress={() =>
            router.push({
              pathname: "/(auth)/login",
              params: {
                redirectTo: "/(tabs)/devices",
              },
            } as any)
          }
          style={styles.accessButton}
        >
          <Text style={styles.accessButtonText}>
            Sign In
          </Text>
        </Pressable>
      </View>
    );
  }

  if (devicesAccessState === "siteManager") {
    return (
      <View style={styles.accessContainer}>
        <Text style={styles.accessTitle}>
          🏥 Staff Account
        </Text>

        <Text style={styles.accessText}>
          Customer smart-home device controls are not
          available to Site Manager accounts.
        </Text>

        <Pressable
          onPress={() =>
            router.push(
              "/mission-control" as any
            )
          }
          style={styles.accessButton}
        >
          <Text style={styles.accessButtonText}>
            Open Mission Control
          </Text>
        </Pressable>
      </View>
    );
  }

  if (devicesAccessState === "error") {
    return (
      <View style={styles.accessContainer}>
        <Text style={styles.accessTitle}>
          Unable to load devices
        </Text>

        <Text style={styles.accessText}>
          Device access could not be verified. Reload
          the screen and try again.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >

      <Text style={styles.title}>Futuristek Devices</Text>

      <Pressable
        onPress={() => router.push("/property-selector")}
        style={{
          backgroundColor: "#0A2747",
          borderRadius: 20,
          padding: 20,
          marginBottom: 20,
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 24,
            fontWeight: "800",
            marginBottom: 6,
          }}
        >
          🏠 Properties
        </Text>

        <Text
          style={{
            color: "#9fb3c8",
            fontSize: 16,
          }}
        >
          Manage multiple homes and buildings
        </Text>
      </Pressable>

      <View style={styles.dashboardCard}>
        <View style={styles.dashboardRow}>
          <Text style={styles.dashboardNumber}>
            {onlineDevices}
          </Text>
          <Text style={styles.dashboardLabel}>
            Online
          </Text>
        </View>

        <View style={styles.dashboardRow}>
          <Text style={styles.dashboardNumber}>
            {offlineDevices}
          </Text>
          <Text style={styles.dashboardLabel}>
            Offline
          </Text>
        </View>

        <View style={styles.dashboardRow}>
          <Text style={styles.dashboardNumber}>
            {totalRooms}
          </Text>
          <Text style={styles.dashboardLabel}>
            Rooms
          </Text>
        </View>

        <View style={styles.dashboardRow}>
          <Text style={styles.dashboardNumber}>
            4
          </Text>
          <Text style={styles.dashboardLabel}>
            Scenes
          </Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Categories</Text>

      <View style={styles.categoryRow}>
        <Text style={styles.categoryPill}>💡 Lights ({lightCount})</Text>
        <Text style={styles.categoryPill}>🔌 Plugs ({plugCount})</Text>
        <Text style={styles.categoryPill}>📷 Cameras ({cameraCount})</Text>
        <Text style={styles.categoryPill}>📡 Sensors ({sensorCount})</Text>
        <Text style={styles.categoryPill}>📺 Remotes ({remoteCount})</Text>
      </View>

     <Pressable
        style={styles.addCard}
        onPress={() => router.push("/device-discovery" as any)}
      >
        <Text style={styles.addTitle}>+ Add Device</Text>
        <Text style={styles.addText}>
          Connect smart plugs, lights, cameras and sensors
        </Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Rooms</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.roomScroll}
        style={{
          gap: 18,
          marginRight: -24,
          paddingBottom: 24,
        }}
      >
        <Pressable
          style={styles.roomCard}
          onPress={() => setSelectedRoom(null)}
        >
          <Text style={styles.roomEmoji}>🏠</Text>
          <Text style={styles.roomName}>All Rooms</Text>
        </Pressable>
        {Object.keys(roomCounts).map((room) => (
          <Pressable
            key={room}
            style={styles.roomCard}
            onPress={() =>
              router.push({
                pathname: "/room-control",
                params: { room },
              })
            }
          >
            <Text style={styles.roomEmoji}>
              {room.toLowerCase().includes("bedroom")
                ? "🛏️"
                : room.toLowerCase().includes("living")
                ? "🛋️"
                : room.toLowerCase().includes("toilet")
                ? "🚽"
                : "🏠"}
            </Text>

            <Text style={styles.roomName}>
              {room} ({roomCounts[room]})
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <Pressable
        style={styles.addCard}
        onPress={() => router.push("/scenes")}
      >
        <Text style={styles.addTitle}>🎬 Scenes</Text>

        <Text style={styles.addText}>
          Control multiple devices with one tap
        </Text>
      </Pressable>

      <Pressable
        style={styles.addCard}
        onPress={() => router.push("/activity-history" as any)}
      >
        <Text style={styles.addTitle}>
          📜 Activity History
        </Text>

        <Text style={styles.addText}>
          See everything your home has done
        </Text>
      </Pressable>

      <Pressable
        style={styles.addCard}
        onPress={() => router.push("/automations")}
      >
        <Text style={styles.addTitle}>🤖 Automations</Text>

        <Text style={styles.addText}>
          Create smart home rules
        </Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Connected Devices</Text>

      {devices.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No devices connected yet</Text>
          <Text style={styles.emptyText}>
            Add your first smart device to begin controlling your home.
          </Text>
        </View>
      ) : (
       visibleDevices.map((device) => (
        <Pressable
          key={device.id}
          style={styles.emptyCard}
          onPress={() =>
            router.push({
              pathname: "/device-control",
              params: {
                id: device.id,
                name: device.name,
                type: device.type,
                room: device.room,
                status: String(device.status),
                brightness: String(device.brightness ?? 100),
              },
            })
          }
        >
          <Text style={styles.emptyTitle}>
            {getDeviceIcon(device.type)} {device.name}
          </Text>
         <Text style={styles.emptyText}>
            {device.type} • {device.room}
          </Text>

          <Text style={styles.emptyText}>
            {device.status === true ? "🟢 Online" : "🔴 Offline"}
          </Text>
          {device.status && (
          <Text style={styles.healthText}>
            {String(device.type).toLowerCase().includes("light") &&
              "📶 WiFi: Strong • 🕒 Last seen: Just now"}

            {String(device.type).toLowerCase().includes("plug") &&
              "⚡ Power: 23W • 📶 WiFi: Good"}

            {String(device.type).toLowerCase().includes("camera") &&
              "🎥 Streaming Ready • 📶 Signal: Excellent"}

            {String(device.type).toLowerCase().includes("sensor") &&
              "🔋 Battery: 78% • 🕒 Last motion: 2 min ago"}

            {String(device.type).toLowerCase().includes("remote") &&
              "📡 IR Signal: Ready • 📶 WiFi: Good"}
          </Text>
          )}

          {(
          String(device.type).toLowerCase().includes("light") ||
          String(device.type).toLowerCase().includes("plug")
        ) && (
          <View style={styles.quickActionsRow}>
            <Pressable
              style={styles.quickButton}
              onPress={() =>
                router.push({
                  pathname: "/device-control",
                  params: {
                    id: device.id,
                    name: device.name,
                    type: device.type,
                    room: device.room,
                    status: String(device.status),
                    brightness: String(device.brightness ?? 100),
                  },
                })
              }
            >
              <Pressable
                style={styles.quickButton}
                onPress={() => quickToggleDevice(device)}
              >
                <Text style={styles.quickButtonText}>
                  {device.status ? "OFF" : "ON"}
                </Text>
              </Pressable>
            </Pressable>
          </View>
        )}
        </Pressable>
      ))
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
  flex: 1,
  backgroundColor: "#071827",
},

content: {
  padding: 20,
  paddingBottom: 140,
},

  title: {
  fontSize: 36,
  fontWeight: "800",
  color: "#fff",
  marginTop: 40,
  marginBottom: 24,
},

  text: {
   fontSize: 16, opacity: 0.85
  },

  addCard: {
  backgroundColor: "#0f2238",
  padding: 18,
  borderRadius: 20,
  marginBottom: 24,
},

addTitle: {
  color: "#fff",
  fontSize: 20,
  fontWeight: "700",
},

addText: {
  color: "#9ca3af",
  marginTop: 8,
},

sectionTitle: {
  color: "#fff",
  fontSize: 20,
  fontWeight: "700",
  marginBottom: 12,
},

roomRow: {
  flexDirection: "row",
  gap: 12,
  marginBottom: 32,
},

roomCard: {
  width: 120,
  height: 140,
  backgroundColor: "#102238",
  borderRadius: 24,
  alignItems: "center",
  justifyContent: "center",
  padding: 12,
},

roomEmoji: {
  fontSize: 32,
  marginBottom: 12,
},

roomName: {
  color: "#fff",
  fontSize: 20,
  fontWeight: "700",
  textAlign: "center",
},

emptyCard: {
  backgroundColor: "#0f2238",
  padding: 20,
  borderRadius: 20,
},

emptyTitle: {
  color: "#fff",
  fontSize: 18,
  fontWeight: "700",
  marginBottom: 8,
},

emptyText: {
  color: "#9ca3af",
},

statusCard: {
  backgroundColor: "#0B2236",
  padding: 24,
  borderRadius: 22,
  marginBottom: 24,
},

statusLabel: {
  color: "#9ca3af",
  fontSize: 16,
  marginBottom: 8,
},

statusText: {
  color: "#fff",
  fontSize: 34,
  fontWeight: "800",
},

button: {
  flex: 1,
  backgroundColor: "#1E88E5",
  padding: 18,
  borderRadius: 18,
  alignItems: "center",
},

buttonText: {
  color: "#fff",
  fontWeight: "800",
  fontSize: 18,
},

roomScroll: {
  gap: 18,
  paddingRight: 48,
},

dashboardCard: {
  backgroundColor: "#0D2340",
  borderRadius: 24,
  padding: 20,
  marginTop: 20,
  marginBottom: 24,
  flexDirection: "row",
  justifyContent: "space-between",
},

dashboardRow: {
  alignItems: "center",
},

dashboardNumber: {
  color: "#FFFFFF",
  fontSize: 24,
  fontWeight: "800",
},

dashboardLabel: {
  color: "#9CA3AF",
  marginTop: 4,
  fontSize: 14,
},

categoryRow: {
  flexDirection: "row",
  flexWrap: "wrap",
  gap: 10,
  marginBottom: 24,
},

categoryPill: {
  backgroundColor: "#0D2340",
  color: "#FFFFFF",
  paddingVertical: 10,
  paddingHorizontal: 14,
  borderRadius: 999,
  fontSize: 15,
  fontWeight: "700",
},

healthText: {
  color: "#8FA3B8",
  fontSize: 14,
  marginTop: 6,
  lineHeight: 20,
},

quickActionsRow: {
  flexDirection: "row",
  marginTop: 12,
},

quickButton: {
  backgroundColor: "#1E88E5",
  paddingHorizontal: 16,
  paddingVertical: 8,
  borderRadius: 10,
},

quickButtonText: {
  color: "#fff",
  fontWeight: "700",
},

dashboardTitle: {
  color: "#FFF",
  fontSize: 22,
  fontWeight: "700",
  marginBottom: 18,
},

accessContainer: {
  flex: 1,
  backgroundColor: "#061826",
  alignItems: "center",
  justifyContent: "center",
  paddingHorizontal: 30,
},

accessTitle: {
  color: "#ffffff",
  fontSize: 29,
  fontWeight: "900",
  textAlign: "center",
},

accessText: {
  color: "#cbd5e1",
  fontSize: 18,
  lineHeight: 28,
  textAlign: "center",
  marginTop: 16,
},

accessButton: {
  backgroundColor: "#2563eb",
  borderRadius: 16,
  paddingHorizontal: 26,
  paddingVertical: 16,
  marginTop: 28,
},

accessButtonText: {
  color: "#ffffff",
  fontSize: 18,
  fontWeight: "900",
},
});
