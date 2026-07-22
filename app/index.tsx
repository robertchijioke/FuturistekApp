import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect } from "expo-router";
import { onAuthStateChanged, User } from "firebase/auth";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { auth } from "../lib/firebase";

export default function Index() {
  const [ready, setReady] = useState(false);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let unsubscribeAuth: (() => void) | undefined;

    const check = async () => {
      try {
        const value = await AsyncStorage.getItem("hasSeenOnboarding");
        setHasSeenOnboarding(value === "true");

        unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
          setUser(currentUser);
          setReady(true);
        });
      } catch (error) {
        console.error(error);
        setHasSeenOnboarding(false);
        setReady(true);
      }
    };

    check();

    return () => {
      if (unsubscribeAuth) unsubscribeAuth();
    };
  }, []);

if (!ready) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#020817",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <ActivityIndicator size="large" color="#60a5fa" />
    </View>
  );
}

if (!hasSeenOnboarding) {
  return <Redirect href="/onboarding" />;
}

return <Redirect href="/(tabs)/home" />;
}