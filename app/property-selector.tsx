import { useRouter } from "expo-router";
import { collection, deleteDoc, doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { auth, db } from "../lib/firebase";

export default function PropertySelector() {
  const router = useRouter();

  const [properties, setProperties] = useState<any[]>([
    { id: "home", name: "Home", icon: "🏠", devices: 0 },
    { id: "office", name: "Office", icon: "🏢", devices: 0 },
    { id: "villa", name: "Villa", icon: "🏖️", devices: 0 },
  ]);

useEffect(() => {
  const user = auth.currentUser;
  if (!user) return;

  let savedProperties: any[] = [];
  let deviceCounts: any = {};

  const defaultProperties = [
    { id: "home", name: "Home", icon: "🏠" },
    { id: "office", name: "Office", icon: "🏢" },
    { id: "villa", name: "Villa", icon: "🏖️" },
  ];

  const rebuildProperties = () => {
    setProperties([
      ...defaultProperties,
      ...savedProperties,
    ].map((property) => ({
      ...property,
      devices: deviceCounts[String(property.id).toLowerCase()] || 0,
    })));
  };

  const unsubscribeProperties = onSnapshot(
    collection(db, "users", user.uid, "properties"),
    (snapshot) => {
      savedProperties = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      rebuildProperties();
    }
  );

  const unsubscribeDevices = onSnapshot(
    collection(db, "users", user.uid, "devices"),
    (snapshot) => {
      const counts: any = {};

     snapshot.docs.forEach((doc) => {
      const data = doc.data();

      if (
        String(data.type || "").toLowerCase() !== "camera"
      ) {
        return;
      }

      const propertyId = String(
        data.propertyId || "home"
      ).toLowerCase();

      counts[propertyId] = (counts[propertyId] || 0) + 1;
    });

      deviceCounts = counts;
      rebuildProperties();
    }
  );

  return () => {
    unsubscribeProperties();
    unsubscribeDevices();
  };
}, []);

const deleteProperty = async (propertyId: string) => {
  if (["home", "office", "villa"].includes(propertyId)) {
    alert("Default properties cannot be deleted");
    return;
  }

  const user = auth.currentUser;
  if (!user) return;

  await deleteDoc(doc(db, "users", user.uid, "properties", propertyId));
};

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{
          flex: 1,
          backgroundColor: "#021a35",
          padding: 20,
        }}
        contentContainerStyle={{
          paddingBottom: 120,
        }}
        showsVerticalScrollIndicator={false}
      >
      <Text
        style={{
          color: "#fff",
          fontSize: 42,
          fontWeight: "800",
          marginTop: 50,
          marginBottom: 10,
        }}
      >
        🏠 My Properties
      </Text>

      <Text
        style={{
          color: "#94a3b8",
          fontSize: 18,
          marginBottom: 30,
        }}
      >
        Manage all your smart properties
      </Text>

      {properties.map((property) => (
       <Pressable
          key={property.id}
          onPress={() =>
            router.push({
              pathname: "/property-map",
              params: {
                propertyId: property.id,
                propertyName: property.name,
                propertyIcon: property.icon,
              },
            })
          }
          style={{
            backgroundColor: "#0A2747",
            padding: 20,
            borderRadius: 20,
            marginBottom: 16,
          }}
        >
          <Text
            style={{
              fontSize: 34,
              marginBottom: 10,
            }}
          >
            {property.icon}
          </Text>

          <Text
            style={{
              color: "#fff",
              fontSize: 24,
              fontWeight: "700",
            }}
          >
            {property.name}
          </Text>

          {!["home", "office", "villa"].includes(String(property.id).toLowerCase()) && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                deleteProperty(property.id);
              }}
            >
              <Text style={{ color: "#ff6b6b", fontSize: 18, marginTop: 10 }}>
                Delete
              </Text>
            </Pressable>
          )}

          <Text
            style={{
              color: "#94a3b8",
              marginTop: 6,
            }}
          >
            {property.devices} Devices
          </Text>
        </Pressable>
      ))}

     <Pressable
        onPress={() => router.push("/add-property")}
        style={{
          backgroundColor: "#3B82F6",
          padding: 18,
          borderRadius: 16,
          alignItems: "center",
          marginTop: 10,
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontWeight: "700",
            fontSize: 18,
          }}
        >
          + Add Property
        </Text>
      </Pressable>
    </ScrollView>
    </View>
  );
}