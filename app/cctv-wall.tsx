import { useLocalSearchParams, useRouter } from "expo-router";
import { collection, deleteDoc, doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Alert, Dimensions, Image, Pressable, ScrollView, Text, View } from "react-native";
import { getDeviceStatus } from "../lib/deviceStatus";
import { auth, db } from "../lib/firebase";

  export default function CCTVWall() {
    const router = useRouter();
    const [cameras, setCameras] = useState<any[]>([]);

    const isOnline = (status: any) =>
      status === true ||
      String(status || "").toLowerCase() === "online";

    const { propertyId } = useLocalSearchParams();
    const currentPropertyId = "cctv-wall";

    const [currentTime, setCurrentTime] = useState(
    new Date().toLocaleTimeString()
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const unsubscribe = onSnapshot(
      collection(db, "users", user.uid, "devices"),
      (snapshot) => {
    const loaded = snapshot.docs.map((doc) => {
      const data: any = doc.data();

      return {
        id: doc.id,
        ...data,
        thumbnail: String(data.thumbnail || data.image || "").trim(),
        image: String(data.image || data.thumbnail || "").trim(),
      };
    });

    setCameras(loaded);
    });

    return unsubscribe;
  }, []);


  const propertyCameras = cameras.filter((camera: any) => {
    const property = String(camera.propertyId || "").toLowerCase();
    const source = String(camera.source || "").toLowerCase();

    return String(camera.type || "").toLowerCase().includes("camera");
  });

  const sortedCameras = [...propertyCameras];

  const usedCameraIds = new Set<string>();

  const wallSlots = Array.from({ length: 9 }, (_, index) => {
    const slotNumber = index + 1;

    const positionedCamera = propertyCameras.find((camera: any) => {
      if (usedCameraIds.has(camera.id)) return false;
      return Number(camera.slot) === slotNumber;
    });

    if (positionedCamera) {
      usedCameraIds.add(positionedCamera.id);
      return positionedCamera;
    }

    const fallbackCamera = propertyCameras.find((camera: any) => {
      if (usedCameraIds.has(camera.id)) return false;
      return !camera.slot;
    });

    if (fallbackCamera) {
      usedCameraIds.add(fallbackCamera.id);
      return fallbackCamera;
    }

    return null;
  });

  const screenWidth = Dimensions.get("window").width;
  const CARD_GAP = 8;
  const CARD_WIDTH = (screenWidth - 32 - CARD_GAP * 2) / 3;

  const handleCameraOptions = (camera: any) => {
    Alert.alert(
      camera.room || "Camera",
      "Camera Options",
        [
          {
            text: "Rename",
            onPress: () => {
             router.push({
                pathname: "/rename-camera",
                params: {
                  cameraId: String(camera.id),
                  currentName: String(camera.room || camera.name || ""),
                },
              } as any);
            },
          },
          {
            text: "Move Camera",
            onPress: () => {
              router.push({
                pathname: "/move-camera",
                params: {
                  cameraId: String(camera.id),
                  currentSlot: String(camera.slot || ""),
                },
              } as any);
            },
          },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => {
              Alert.alert(
                "Delete Camera",
                `Are you sure you want to delete ${camera.room}?`,
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                      const user = auth.currentUser;
                        if (!user) return;

                        await deleteDoc(
                          doc(
                            db,
                            "users",
                            user.uid,
                            "devices",
                            camera.id
                          )
                        );
                    },
                  },
                ]
              );
            },
          },
          {
            text: "Cancel",
            style: "cancel",
          },
        ]
      );
    };



  return (
    <ScrollView
      style={{
        flex: 1,
        backgroundColor: "#021a35",
        padding: 16,
        paddingTop: 60,
      }}
    >
      <Text style={{ color: "#fff", fontSize: 36, fontWeight: "800", marginBottom: 20 }}>
        📺 CCTV Wall
      </Text>

    <View
      style={{
        flexDirection: "row",
        gap: 12,
        marginBottom: 18,
      }}
    >
      <Pressable
        onPress={() => router.push("/saved-snapshots")}
        style={{
          flex: 1,
          backgroundColor: "#143f6b",
          padding: 14,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: "#1f6fb2",
        }}
      >
        <Text style={{ color: "#fff", fontSize: 16, fontWeight: "800" }}>
          💾 Saved
        </Text>
        <Text style={{ color: "#9ec5ff", marginTop: 4, fontSize: 12 }}>
          Active captures
        </Text>
      </Pressable>

      <Pressable
        onPress={() => router.push("/archived-snapshots")}
        style={{
          flex: 1,
          backgroundColor: "#143f6b",
          padding: 14,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: "#1f6fb2",
        }}
      >
        <Text style={{ color: "#fff", fontSize: 16, fontWeight: "800" }}>
          📂 Archive
        </Text>
        <Text style={{ color: "#9ec5ff", marginTop: 4, fontSize: 12 }}>
          Old captures
        </Text>
      </Pressable>
    </View>

    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        rowGap: 12,
        marginTop: 10,
      }}
    >
     {wallSlots.map((camera, index) => {
        if (!camera) {
          return null;
        }

        const deviceStatus = getDeviceStatus(camera);

        return (
          <Pressable
            key={camera.id}
            onPress={() => {
              router.push({
                 pathname: "/camera-details",
                params: {
                  cameraId: String(camera.id),
                  name: String(camera.name || camera.room || "Camera"),
                  room: String(camera.room || ""),
                  type: String(camera.type || "Camera"),
                  status: String(camera.status),
                  battery: String(camera.battery || 86),
                  signal: String(camera.signal || "Excellent"),
                  thumbnail: String(camera.thumbnail || camera.image || ""),
                  image: String(camera.image || camera.thumbnail || ""),
                },
              } as any);
            }}
            onLongPress={() => {
              console.log("LONG PRESS CAMERA:", camera);
              handleCameraOptions(camera);
            }}
            style={{
              width: "32%",
              height: 175,
              backgroundColor: "#0a2b52",
              borderRadius: 14,
              padding: 8,
              marginBottom: 0,
              justifyContent: "space-between",
            }}
          >
            <View>
              <Text
                style={{
                  color: deviceStatus.isOnline ? "#4ade80" : "#facc15",
                  fontSize: 13,
                }}
              >
                {deviceStatus.isOnline ? "● LIVE" : "● OFFLINE"}
              </Text>

              <Text
                style={{
                  color: "#b8c7d9",
                  fontSize: 10,
                  marginTop: 4,
                  marginBottom: 4,
                }}
              >
                {currentTime}
              </Text>
            </View>

            <View>
              <Image
                source={{
                  uri:
                    String(camera.thumbnail || camera.image || "").trim() ||
                    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64"
                }}
                style={{
                  width: "100%",
                  height: 55,
                  borderRadius: 10,
                  marginBottom: 4,
                }}
                resizeMode="cover"
              />
            </View>

            <View>
              <Text
                numberOfLines={2}
                style={{
                  color: "#fff",
                  fontSize: 15,
                  fontWeight: "700",
                  lineHeight: 18,
                }}
              >
                {camera.icon} {camera.room}
              </Text>

              <Text
                  numberOfLines={1}
                  style={{
                    color:
                      !isOnline(camera.status)
                        ? "#facc15"
                        : camera.battery < 25
                        ? "#facc15"
                        : "#4ade80",
                    fontSize: 11,
                    fontWeight: "700",
                    marginTop: 2,
                  }}
                >
                  {!isOnline(camera.status)
                    ? "⚠️ Offline"
                    : camera.battery < 25
                    ? "🟡 Low Battery"
                    : "🟢 Healthy"}
                </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
    </ScrollView>
  );
}