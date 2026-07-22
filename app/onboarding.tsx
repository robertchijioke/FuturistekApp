import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { Button, Text, View } from "react-native";

export default function Onboarding() {
  const handleGetStarted = async () => {
    await AsyncStorage.setItem("hasSeenOnboarding", "true");
    router.replace("/(tabs)/home");
  };

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#020817",
        padding: 24,
      }}
    >
      <Text
        style={{
          color: "white",
          fontSize: 28,
          fontWeight: "700",
          marginBottom: 16,
        }}
      >
        Welcome to Futuristek
      </Text>

      <Text
        style={{
          color: "#cbd5e1",
          fontSize: 16,
          textAlign: "center",
          marginBottom: 30,
        }}
      >
        Shop smart devices and manage your connected home with ease.
      </Text>

      <Button title="Get Started" onPress={handleGetStarted} />
    </View>
  );
}