import { useRouter } from "expo-router";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, Text, View } from "react-native";
import { db } from "../lib/firebase";

  export default function PropertyMap() {
    const router = useRouter();

    const [homeStatus, setHomeStatus] = useState<"secure" | "alert">("secure");
    const [activeIncidents, setActiveIncidents] = useState<any[]>([]);

useEffect(() => {
  const q = query(collection(db, "activeIncidents"), orderBy("createdAt", "desc"));

  const unsub = onSnapshot(q, (snapshot) => {
    setActiveIncidents(
      snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
    );
  });

  return unsub;
}, []);

    const safeAnim = useRef(new Animated.Value(1)).current;
    const warningAnim = useRef(new Animated.Value(1)).current;
    const dangerAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(safeAnim, {
          toValue: 1.03,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(safeAnim, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: true,
        }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(warningAnim, {
          toValue: 1.05,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(warningAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(dangerAnim, {
          toValue: 1.08,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.timing(dangerAnim, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

    const rooms = [
      { name: "Living Room", status: "safe" },
      { name: "Kitchen", status: "safe" },
      { name: "Bedroom", status: "safe" },
      { name: "Garage", status: "safe" },
      { name: "Front Door", status: "safe" },
      { name: "Back Garden", status: "safe" },
    ];

    const colour = (status: string) => {
      switch (status) {
        case "danger":
          return "#ef4444";
        case "warning":
          return "#f59e0b";
        default:
          return "#22c55e";
      }
    };

  useEffect(() => {
    const hasCriticalRoom = rooms.some((room) => room.status === "danger");

    setHomeStatus(hasCriticalRoom ? "alert" : "secure");
  }, []);

  useEffect(() => {
    const q = query(collection(db, "activeIncidents"), orderBy("createdAt", "desc"));

    const unsub = onSnapshot(q, (snapshot) => {
      setActiveIncidents(
        snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
      );
    });

    return unsub;
  }, []);

  

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#061826" }}
      contentContainerStyle={{
        paddingTop: 70,
        paddingHorizontal: 20,
        paddingBottom: 140,
      }}
    >
      <Text
        style={{
          color: "white",
          fontSize: 30,
          fontWeight: "700",
          marginBottom: 25,
        }}
      >
        🗺️ Property Map
      </Text>

      <View
        style={{
          backgroundColor:
            homeStatus === "secure"
              ? "#16325c"
              : "#5b1d1d",
          padding: 20,
          borderRadius: 20,
          marginBottom: 20,
        }}
      >
        <Text style={{ color: "#fff", fontSize: 28, fontWeight: "800", marginBottom: 12 }}>
          🏠 {activeIncidents.length > 0 ? "🔴 Alert Active" : "🟢 Property Secure"}
        </Text>

       <Text
          style={{
            color: homeStatus === "secure" ? "#22c55e" : "#ef4444",
            fontSize: 20,
            fontWeight: "700",
          }}
        >
          {homeStatus === "secure"
            ? "🟢 Property Secure"
            : "🔴 Alert Active"}
        </Text>

        <Text style={{ color: "#b6c8df", fontSize: 18, marginBottom: 6 }}>
          Devices Online: 5
        </Text>

        <Text style={{ color: "#b6c8df", fontSize: 18, marginBottom: 6 }}>
          Cameras Online: 1
        </Text>

        <Text style={{ color: "#b6c8df", fontSize: 18, marginBottom: 6 }}>
          Sensors Active: 2
        </Text>

        <Text style={{ color: "#b6c8df", fontSize: 18 }}>
          Last Activity: {activeIncidents.length > 0 
            ? "Security event detected" 
            : "No active incidents"}
        </Text>
      </View>

      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
        }}
      >
        {rooms.map((room) => {
          const isRoomActive = activeIncidents.some(
            (incident) => incident.room === room.name
          );

          return (
         <Animated.View
            key={room.name}
            style={{
              width: "47%",
              height: 120,
              backgroundColor: "#0f2d49",
              borderRadius: 18,
              padding: 14,
              marginBottom: 16,
              justifyContent: "center",
              alignItems: "center",
              transform: [
                {
                  scale:
                    isRoomActive
                      ? dangerAnim
                      : room.status === "warning"
                      ? warningAnim
                      : safeAnim,
                },
              ],
            }}
          >
            <Pressable
              onPress={() =>
               router.push({
                  pathname: "/room-dashboard",
                  params: {
                    room: room.name,
                    status: isRoomActive ? "danger" : "safe",
                  },
                } as any)
              }
              style={{
                width: "100%",
                height: "100%",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
            <Animated.View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: colour(
                  isRoomActive
                    ? "danger"
                    : room.status === "warning"
                    ? "warning"
                    : "safe"
                ),
                transform:[{
                 scale:
                  isRoomActive
                    ? dangerAnim
                    : room.status === "warning"
                    ? warningAnim
                    : safeAnim,
                }],
              }}
            />
            <Text
              style={{
                color: "white",
                fontWeight: "700",
                fontSize: 18,
              }}
            >
              {room.name}
            </Text>
            </Pressable>
         </Animated.View>
        );
       })}
      </View>

      <Pressable
        onPress={() => router.push("/security-center" as any)}
        style={{
          backgroundColor: "#2563eb",
          padding: 18,
          borderRadius: 16,
          marginTop: 24,
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 20,
            fontWeight: "700",
            textAlign: "center",
          }}
        >
          🛡️ Security Center
        </Text>
      </Pressable>
    </ScrollView>
  );
}