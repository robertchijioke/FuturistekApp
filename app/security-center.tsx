import { useLocalSearchParams, useRouter } from "expo-router";
import { addDoc, collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Alert, Image, Pressable, ScrollView, Text, View } from "react-native";
import { getDeviceStatus } from "../lib/deviceStatus";
import { auth, db } from "../lib/firebase";

  export default function SecurityCenterScreen() {
    const router = useRouter();

    const {
      camerasOnline: routeCamerasOnline,
      motionAlerts,
      recordingsToday,
      recentEvents,
    } = useLocalSearchParams();

    const [securityEvents, setSecurityEvents] = useState<string[]>([]);
    const [isArmed, setIsArmed] = useState(false);
    const [panicMode, setPanicMode] = useState(false);
    const [frontDoorLocked, setFrontDoorLocked] = useState(true);
    const [garageClosed, setGarageClosed] = useState(true);
    const [devices, setDevices] = useState<any[]>([]);
    const [securityCaptures, setSecurityCaptures] = useState<any[]>([]);

    const cctvCameras = devices.filter((d: any) => {
    const type = String(d.type || "").toLowerCase();
    const property = String(d.propertyId || "").toLowerCase();
    const source = String(d.source || "").toLowerCase();

    return (
      type.includes("camera") &&
      (
        property === "cctv-wall" ||
        source === "cctv-wall" ||
        property === "home" ||
        property === ""
      )
    );
  });

    const isOnline = (status: any) =>
      status === true || String(status || "").toLowerCase() === "online";

    const camerasOnline = cctvCameras.filter((camera: any) =>
      isOnline(camera.status)
    ).length;
    

    const addSecurityEvent = async (event: string) => {
      try {
        await addDoc(collection(db, "securityEvents"), {
          event,
          camera: "Access Control",
          createdAt: serverTimestamp(),
        });
      } catch (error) {
        console.log("Security Event Error:", error);
      }
    };

    const events = recentEvents
      ? JSON.parse(String(recentEvents))
      : [];

    useEffect(() => {
      const q = query(
        collection(db, "securityEvents"),
        orderBy("createdAt", "desc")
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const loadedEvents = snapshot.docs.map((doc) => {
          const data = doc.data();
          return `${data.event}`;
        });

        setSecurityEvents(loadedEvents);
      });

      return unsubscribe;
    }, []);

    useEffect(() => {
      const loadSecurityMode = async () => {
        const ref = doc(db, "securitySettings", "homeMode");
        const snap = await getDoc(ref);

        if (snap.exists()) {
          setIsArmed(snap.data().isArmed === true);
        }
      };

      loadSecurityMode();
    }, []);

    useEffect(() => {
      const user = auth.currentUser;
      if (!user) return;

      const unsubscribe = onSnapshot(
        collection(db, "users", user.uid, "devices"),
        (snapshot) => {
          const loadedDevices = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          setDevices(loadedDevices);
        }
      );

      return unsubscribe;
    }, []);

    useEffect(() => {
      const user = auth.currentUser;
      if (!user) return;

      const q = query(
        collection(db, "users", user.uid, "securityCaptures"),
        orderBy("createdAt", "desc")
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const loadedCaptures = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setSecurityCaptures(loadedCaptures);
      });

      return unsubscribe;
    }, []);

  const displayEvents = securityEvents.length > 0 ? securityEvents : events;

  const latestEvent = displayEvents[0] || "";

  const hasMotionAlert = latestEvent.includes("Motion detected");

  const motionAlertsCount = displayEvents.filter((event: string) =>
    event.includes("Motion detected")
  ).length;

  const recordingsTodayCount = displayEvents.filter((event: string) =>
    event.includes("Recording started")
  ).length;

  const securityScore = hasMotionAlert ? 80 : 100;

  const securityStatus = hasMotionAlert ? "🔴 Security Alert" : "🟢 Home Secure";

  const lastMotion = displayEvents.find((event: string) =>
    event.includes("Motion detected")
  );

  const statusMessage = hasMotionAlert
  ? `Last motion: ${lastMotion}`
  : "All monitored areas are secure";

  const livingRoomStatus = hasMotionAlert
  ? "🚨 Alert"
  : "✅ Secure";

  const frontDoorStatus = hasMotionAlert
  ? "🚨 Alert"
  : "✅ Secure";

  const bedRoomStatus = hasMotionAlert
  ? "🚨 Alert"
  : "✅ Secure";

  const garageStatus = hasMotionAlert
  ? "🚨 Alert"
  : "✅ Secure";

  const lowBatteryDevices = devices.filter(
    (device) => Number(device.battery) < 25
  );

  const offlineDevices = devices.filter((device: any) => {
    const type = String(device.type || "").toLowerCase();

    if (!type.includes("camera")) return false;

    return !getDeviceStatus(device).isOnline;
  });

  const latestAccessEvents = displayEvents
  .filter((event: string) =>
    event.includes("Front Door") ||
    event.includes("Garage Door") ||
    event.includes("Emergency Mode")
  )
  .slice(0, 3);

  const notifications = [
    hasMotionAlert && "🚨 Motion detected",
    panicMode && "🚨 Emergency mode active",

    ...lowBatteryDevices.map(
      (device) => `⚠️ ${device.room || device.name} battery low`
    ),

    ...offlineDevices.map(
      (device) => `📷 ${device.room || device.name} camera offline`
    ),
    ...latestAccessEvents.map((event: string) => `🔔 ${event}`),
  ].filter(Boolean);

  const devicesOnline = devices.filter((device: any) =>
    getDeviceStatus(device).isOnline
  ).length;

  const totalDevices = devices.length;

  const devicesOnlineLive = devicesOnline;

  const totalDevicesLive = devices.length;

  const systemStatus = panicMode
    ? "🔴 Emergency Active"
    : notifications.length > 0
    ? "🟡 Attention Required"
    : "🟢 All Systems Operational";

  const systemStatusColor = panicMode
    ? "#7f1d1d"
    : notifications.length > 0
    ? "#4a3b12"
    : "#123c2b";

  const emergencyCount = displayEvents.filter((event: string) =>
    event.includes("Emergency Mode Activated")
  ).length;

  const motionCount = displayEvents.filter((event: string) =>
    event.includes("Motion detected")
  ).length;

  const recordingCount = displayEvents.filter((event: string) =>
    event.includes("Recording started")
  ).length;


  return (
    <ScrollView
        style={{
          flex: 1,
          backgroundColor: "#021a35",
          padding: 20,
          paddingTop: 60,
        }}
        contentContainerStyle={{
          paddingBottom: 120,
        }}
      >
      <Text
        style={{
          color: "#fff",
          fontSize: 30,
          fontWeight: "700",
          marginBottom: 20,
        }}
      >
        🚨 Security Center
      </Text>

      <View
        style={{
          backgroundColor: isArmed ? "#123c2b" : "#3a2f12",
          padding: 18,
          borderRadius: 18,
          marginBottom: 16,
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 22,
            fontWeight: "700",
          }}
        >
          {isArmed ? "🔒 Armed Mode" : "🔓 Disarmed Mode"}
        </Text>

        <Text
          style={{
            color: "#b8c7d9",
            fontSize: 16,
            marginTop: 6,
          }}
        >
          {isArmed
            ? "Security monitoring is active"
            : "Security monitoring is inactive"}
        </Text>
      </View>

      <View
        style={{
          backgroundColor: systemStatusColor,
          padding: 20,
          borderRadius: 20,
          marginBottom: 16,
        }}
      >
        <Text style={{ color: "#fff", fontSize: 24, fontWeight: "700" }}>
          {systemStatus}
        </Text>

        <Text style={{ color: "#b8c7d9", fontSize: 16, marginTop: 8 }}>
          Devices Online: {devicesOnline}/{totalDevices}
        </Text>

        <Text style={{ color: "#b8c7d9", fontSize: 16, marginTop: 6 }}>
          Security Mode: {isArmed ? "Armed" : "Disarmed"}
        </Text>

        <Text style={{ color: "#b8c7d9", fontSize: 16, marginTop: 6 }}>
          Emergency Mode: {panicMode ? "ON" : "OFF"}
        </Text>

        <Text style={{ color: "#b8c7d9", fontSize: 16, marginTop: 6 }}>
          Last Event: {latestEvent || "No recent events"}
        </Text>
      </View>

          {panicMode && (
            <View
              style={{
                backgroundColor: "#7f1d1d",
                padding: 20,
                borderRadius: 20,
                marginBottom: 16,
              }}
            >
              <Text
                style={{
                  color: "#fff",
                  fontSize: 24,
                  fontWeight: "700",
                }}
              >
                🚨 EMERGENCY MODE
              </Text>

              <Text
                style={{
                  color: "#fecaca",
                  marginTop: 8,
                }}
              >
                Emergency response active.
              </Text>
            </View>
          )}

      <View
        style={{
          backgroundColor: hasMotionAlert ? "#3b1020" : "#0a2b52",
          padding: 20,
          borderRadius: 20,
          marginBottom: 16,
        }}
      >
        <Text style={{ color: "#fff", fontSize: 24, fontWeight: "700" }}>
          {securityStatus}
        </Text>

        <Text style={{ color: "#b8c7d9", fontSize: 16, marginTop: 10 }}>
          {statusMessage}
        </Text>
      </View>

      <View
        style={{
          backgroundColor: "#0a2b52",
          padding: 20,
          borderRadius: 20,
          marginBottom: 16,
        }}
      >
        <Text style={{ color: "#fff", fontSize: 18 }}>
          📷 Cameras Online: {camerasOnline}/{cctvCameras.length}
        </Text>
      </View>

      <View
        style={{
          backgroundColor: "#0a2b52",
          padding: 20,
          borderRadius: 20,
          marginBottom: 16,
        }}
      >
        <Text style={{ color: "#fff", fontSize: 18 }}>
          🚨 Motion Alerts Today: {motionAlertsCount}
        </Text>
      </View>

      <View
        style={{
          backgroundColor: "#0a2b52",
          padding: 20,
          borderRadius: 20,
          marginBottom: 16,
        }}
      >
        <Text style={{ color: "#fff", fontSize: 18 }}>
          🎥 Recordings Today: {recordingsTodayCount}
        </Text>
      </View>

      <View
        style={{
          backgroundColor: "#0a2b52",
          padding: 20,
          borderRadius: 20,
          marginBottom: 16,
        }}
      >
        <Text style={{ color: "#fff", fontSize: 18 }}>
         🛡 Security Score: {securityScore}%
        </Text>
      </View>

      <View
        style={{
          backgroundColor: "#0a2b52",
          padding: 20,
          borderRadius: 20,
          marginBottom: 16,
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 20,
            fontWeight: "700",
            marginBottom: 12,
          }}
        >
          🏠 Home Status
        </Text>

        <Text
          style={{
            color: "#b8c7d9",
            fontSize: 16,
            marginBottom: 10,
          }}
        >
          🚪 Front Door: secure ✅
        </Text>

        <Text
            style={{
              color: "#b8c7d9",
              fontSize: 16,
              marginBottom: 10,
            }}
          >
        🛋 Living Room: {livingRoomStatus}
        </Text>

        <Text
          style={{
            color: "#b8c7d9",
            fontSize: 16,
            marginBottom: 10,
          }}
        >
          🛏 Bedroom: secure ✅
        </Text>

        <Text
          style={{
            color: "#b8c7d9",
            fontSize: 16,
            marginBottom: 10,
          }}
        >
          🚗 Garage: secure ✅
        </Text>
      </View>

        <View
          style={{
            backgroundColor: "#0a2b52",
            padding: 20,
            borderRadius: 20,
            marginBottom: 16,
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontSize: 22,
              fontWeight: "700",
              marginBottom: 16,
            }}
          >
            📹 Camera Network
          </Text>

         {cctvCameras.map((camera: any) => {
            const status = getDeviceStatus(camera);

            return (
              <Text
                key={camera.id}
                style={{ color: "#b8c7d9", fontSize: 16, marginBottom: 10 }}
              >
                📹 {camera.room || camera.name}: {status.label}{" "}
                {status.isOnline ? "✅" : "⚠️"}
              </Text>
            );
          })}
        </View>

        <View
          style={{
            backgroundColor: "#0a2b52",
            padding: 20,
            borderRadius: 20,
            marginBottom: 16,
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontSize: 26,
              fontWeight: "700",
              marginBottom: 16,
            }}
          >
            ❤️ Device Health
          </Text>
           {cctvCameras.map((device: any) => {
              const status = getDeviceStatus(device);

              return (
                <View key={device.id} style={{ marginBottom: 18 }}>
                  <Text style={{ color: "#b8c7d9", fontSize: 16 }}>
                    📹 {device.room || device.name}
                  </Text>

                  <Text style={{ color: "#b8c7d9" }}>
                    🔋 Battery: {device.battery || 86}%
                  </Text>

                  <Text style={{ color: "#b8c7d9" }}>
                    📶 Signal: {device.signal || "Excellent"}
                  </Text>

                  <Text style={{ color: status.isOnline ? "#4ade80" : "#facc15" }}>
                    {status.isOnline
                      ? "🟢 Status: Healthy"
                      : "🟡 Status: Attention Needed"}
                  </Text>
                </View>
              );
            })}
            </View>

        <View
          style={{
            backgroundColor: "#0a2b52",
            padding: 20,
            borderRadius: 20,
            marginBottom: 16,
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontSize: 26,
              fontWeight: "700",
              marginBottom: 18,
            }}
          >
            🚪 Access Control
          </Text>

         <Text style={{ color: "#b8c7d9", fontSize: 18, marginBottom: 10 }}>
            {frontDoorLocked ? "🔒" : "🔓"} Front Door Lock: {frontDoorLocked ? "Locked" : "Unlocked"}
          </Text>

          <Pressable
            onPress={() => {
              const nextLocked = !frontDoorLocked;
              setFrontDoorLocked(nextLocked);
              addSecurityEvent(
                  nextLocked 
                  ? "Front Door Locked" 
                  : "Front Door Unlocked"
                );
              }}
            style={{ backgroundColor: "#2563eb", padding: 12, borderRadius: 10, marginBottom: 14 }}
          >
            <Text style={{ color: "#fff", textAlign: "center", fontWeight: "700" }}>
              {frontDoorLocked ? "🔓 Unlock Front Door" : "🔒 Lock Front Door"}
            </Text>
          </Pressable>

          <Text style={{ color: "#b8c7d9", fontSize: 18, marginBottom: 10 }}>
            🚗 Garage Door: {garageClosed ? "Closed" : "Open"}
          </Text>

          <Pressable
            onPress={() => {
              const nextClosed = !garageClosed;
              setGarageClosed(nextClosed);
              addSecurityEvent(
                nextClosed
                  ? "Garage Door Closed"
                  : "Garage Door Opened"
              );
            }}
            style={{ backgroundColor: "#2563eb", padding: 12, borderRadius: 10, marginBottom: 14 }}
          >
            <Text style={{ color: "#fff", textAlign: "center", fontWeight: "700" }}>
              {garageClosed ? "⬆️ Open Garage" : "⬇️ Close Garage"}
            </Text>
          </Pressable>

          <Text style={{ color: "#b8c7d9", fontSize: 18 }}>
            🪟 Back Window: Closed
          </Text>
        </View>

        <View
          style={{
            backgroundColor: "#0a2b52",
            padding: 20,
            borderRadius: 20,
            marginBottom: 16,
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontSize: 26,
              fontWeight: "700",
              marginBottom: 16,
            }}
          >
            ⚡ Quick Actions
          </Text>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <Pressable
              style={{
                backgroundColor: "#2563eb",
                padding: 14,
                borderRadius: 12,
                flex: 0.48,
              }}
              onPress={async () => {
                setIsArmed(true);

                await setDoc(doc(db, "securitySettings", "homeMode"), {
                  isArmed: true,
                  updatedAt: new Date(),
                });

                Alert.alert("🔒 Home Armed", "Futuristek security mode is now active.");
              }}
            >
              <Text style={{ color: "#fff", textAlign: "center", fontWeight: "700" }}>
                🔒 Arm Home
              </Text>
            </Pressable>

            <Pressable
              style={{
                backgroundColor: "#2563eb",
                padding: 14,
                borderRadius: 12,
                flex: 0.48,
              }}
              onPress={async () => {
                setIsArmed(false);

                await setDoc(doc(db, "securitySettings", "homeMode"), {
                  isArmed: false,
                  updatedAt: new Date(),
                });

                Alert.alert("🔓 Home Disarmed", "Futuristek security mode is now inactive.");
              }}
            >
              <Text style={{ color: "#fff", textAlign: "center", fontWeight: "700" }}>
                🔓 Disarm
              </Text>
            </Pressable>
          </View>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
            }}
          >
            <Pressable
              style={{
                backgroundColor: "#2563eb",
                padding: 14,
                borderRadius: 12,
                flex: 0.48,
              }}
              onPress={() => router.push("/property-map")}
            >
              <Text style={{ color: "#fff", textAlign: "center", fontWeight: "700" }}>
                🗺️ Property Map
              </Text>
            </Pressable>

            <Pressable
              style={{
                backgroundColor: "#dc2626",
                padding: 14,
                borderRadius: 12,
                flex: 0.48,
              }}
              onPress={async () => {
                setPanicMode(true);

                await addDoc(collection(db, "securityEvents"), {
                  event: "Emergency Mode Activated",
                  camera: "Security Center",
                  createdAt: serverTimestamp(),
                });

                Alert.alert("🚨 Panic Mode", "Emergency mode activated.");
              }}
            >
              <Text style={{ color: "#fff", textAlign: "center", fontWeight: "700" }}>
                🚨 Panic
              </Text>
            </Pressable>
          </View>

           <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginTop: 12,
            }}
          >
            <Pressable
              onPress={() => router.push("/cctv-wall" as any)}
             style={{
                backgroundColor: "#2563eb",
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 12,
                flex: 0.48,
                minHeight: 58,
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#fff", textAlign: "center", fontWeight: "700" }}>
                📺 CCTV Wall
              </Text>
            </Pressable>

            <Pressable
              onPress={() => router.push("/incident-history" as any)}
             style={{
                backgroundColor: "#2563eb",
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 12,
                flex: 0.48,
                minHeight: 58,
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#fff", textAlign: "center", fontWeight: "700" }}>
                🧾 Incident History
              </Text>
            </Pressable>
          </View>

           {panicMode && (
              <Pressable
                style={{
                  backgroundColor: "#16a34a",
                  padding: 14,
                  borderRadius: 12,
                  marginTop: 12,
                  width: "100%",
                }}
                onPress={async () => {
                  setPanicMode(false);

                  await addDoc(collection(db, "securityEvents"), {
                    event: "Emergency Mode Cleared",
                    camera: "Security Center",
                    createdAt: serverTimestamp(),
                  });

                  Alert.alert(
                    "✅ Emergency Cleared",
                    "Security system returned to normal."
                  );
                }}
              >
                <Text
                  style={{
                    color: "#fff",
                    textAlign: "center",
                    fontWeight: "700",
                  }}
                >
                  ✅ Cancel Emergency
                </Text>
              </Pressable>
            )}
        </View>

        <View
          style={{
            backgroundColor: "#0a2b52",
            padding: 20,
            borderRadius: 20,
            marginBottom: 16,
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontSize: 24,
              fontWeight: "700",
              marginBottom: 16,
            }}
          >
            📷 Latest Captures
          </Text>

        {securityCaptures.slice(0, 4).map((capture: any) => (
          <Pressable
            key={capture.id}
            onPress={() =>
              router.push({
                pathname: "/snapshot-viewer",
              params: {
                  snapshotId: String(capture.snapshotId || capture.id || ""),
                  alertId: String(capture.alertId || ""),
                  cameraId: capture.cameraId,
                  cameraName: capture.cameraName || capture.room || "Camera",
                  room: capture.room,
                  image: capture.image || capture.thumbnail || "",
                  thumbnail: capture.thumbnail || capture.image || "",
                  type: capture.type || "Motion Capture",
                  time: "Just now",
                },
              } as any)
            }
            style={{
              backgroundColor: "#123c6d",
              padding: 14,
              borderRadius: 12,
              marginBottom: 12,
            }}
          >
            {capture.image && capture.image.trim() !== "" ? (
              <Image
                source={{ uri: capture.image }}
                style={{
                  width: "100%",
                  height: 120,
                  borderRadius: 12,
                  marginBottom: 10,
                }}
              />
            ) : null}

            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "600" }}>
              📸 {capture.room}
            </Text>

            <Text style={{ color: "#b8c7d9", marginTop: 6 }}>
              {capture.type || "Motion Capture"}
            </Text>

            <Text style={{ color: "#7dd3fc", marginTop: 4 }}>
              Just now
            </Text>
          </Pressable>
        ))}
        </View>
  
        <View
          style={{
            backgroundColor: "#0a2b52",
            padding: 20,
            borderRadius: 20,
            marginBottom: 16,
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontSize: 24,
              fontWeight: "700",
              marginBottom: 16,
            }}
          >
            📈 Security Analytics
          </Text>

          <Text style={{ color: "#b8c7d9", fontSize: 16, marginBottom: 10 }}>
            🚨 Motion Events: {motionCount}
          </Text>

          <Text style={{ color: "#b8c7d9", fontSize: 16, marginBottom: 10 }}>
            🚑 Emergency Activations: {emergencyCount}
          </Text>

          <Text style={{ color: "#b8c7d9", fontSize: 16, marginBottom: 10 }}>
            🎥 Recordings Started: {recordingCount}
          </Text>

          <Text style={{ color: "#7dd3fc", fontSize: 16 }}>
            📹 Devices Online: {devicesOnline}/{totalDevices}
          </Text>
        </View>

        <View
          style={{
            backgroundColor: "#0a2b52",
            padding: 20,
            borderRadius: 20,
            marginBottom: 16,
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontSize: 24,
              fontWeight: "700",
              marginBottom: 12,
            }}
          >
            🔔 Notifications ({notifications.length})
          </Text>

          {notifications.map((item, index) => (
            <Text
              key={index}
              style={{
                color: "#b8c7d9",
                fontSize: 16,
                marginBottom: 10,
              }}
            >
              {item}
            </Text>
          ))}
        </View>

     <View
        style={{
          backgroundColor: "#0f2d49",
          borderRadius: 20,
          padding: 20,
          marginBottom: 20,
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 28,
            fontWeight: "700",
            marginBottom: 18,
          }}
        >
          🧠 AI Command Center
        </Text>

        <Text style={{ color: "#22c55e", fontSize: 20, fontWeight: "700" }}>
          🟢 Monitoring 8 Devices
        </Text>

        <Text style={{ color: "#cfe2ff", fontSize: 18, marginTop: 12 }}>
          🚨 Active Investigation: 1
        </Text>

        <Text style={{ color: "#cfe2ff", fontSize: 18, marginTop: 8 }}>
          📸 New Evidence: 4 Snapshots
        </Text>

        <Text style={{ color: "#cfe2ff", fontSize: 18, marginTop: 8 }}>
          🤖 AI Confidence: 94%
        </Text>

        <Text style={{ color: "#cfe2ff", fontSize: 18, marginTop: 8 }}>
          🏠 Property Status: Secure
        </Text>

        <Pressable
          onPress={() => router.push("/ai-command-center" as any)}
          style={{
            backgroundColor: "#2563eb",
            padding: 16,
            borderRadius: 14,
            marginTop: 18,
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontSize: 18,
              fontWeight: "700",
              textAlign: "center",
            }}
          >
            🚀 Open AI Command Center
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}