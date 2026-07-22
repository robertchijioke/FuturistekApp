import { Stack, router } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { auth, db } from "../../lib/firebase";

export default function AdminLayout() {
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setOk(false);
        router.replace("/(auth)/login");
        return;
      }

      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);

      const role = snap.exists() ? snap.data()?.role : null;
      const isAdmin = role === "admin";

      setOk(isAdmin);

      if (!isAdmin) router.replace("/(tabs)/profile"); 
    });

    return () => unsub();
  }, []);

  if (ok === null) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }
   if (ok === false) return null;
  return <Stack screenOptions={{ headerShown: true, title: "Admin" }} />;
}