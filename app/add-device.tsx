  import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

  export default function AddDeviceScreen() {
    const router = useRouter();
    
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={32} color="#fff" />
          </Pressable>

          <Text style={styles.title}>Add Device</Text>
        </View>

        <Text style={styles.subtitle}>
          Choose the type of smart device you want to connect.
        </Text>

        <View style={styles.grid}>
          <DeviceCard icon="bulb-outline" title="Smart Light" />
          <DeviceCard icon="flash-outline" title="Smart Plug" />
          <DeviceCard icon="videocam-outline" title="Camera" />
          <DeviceCard icon="radio-outline" title="Sensor" />
          <DeviceCard icon="hardware-chip-outline" title="IR Remote" />
          <DeviceCard icon="home-outline" title="Other Device" />
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Pairing coming next</Text>
          <Text style={styles.infoText}>
            We’ll connect this screen to Firebase and smart-home APIs step by step.
          </Text>
        </View>
      </ScrollView>
    );
  }

  function DeviceCard({
    icon,
    title,
  }: {
    icon: any;
    title: string;
  }) {
    const router = useRouter();

    return (
      <Pressable
        style={styles.card}
        onPress={() =>
          router.push({
            pathname: "/device-setup",
            params: { type: title },
          })
        }
      >
        <Ionicons name={icon} size={34} color="#7CC8FF" />
        <Text style={styles.cardText}>{title}</Text>
      </Pressable>
    );
  }

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "#071827",
    },
    content: {
      padding: 28,
      paddingTop: 70,
      paddingBottom: 120,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      marginBottom: 18,
    },
    title: {
      color: "#fff",
      fontSize: 42,
      fontWeight: "800",
    },
    subtitle: {
      color: "#9ca3af",
      fontSize: 18,
      lineHeight: 26,
      marginBottom: 30,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      rowGap: 18,
    },
    card: {
      backgroundColor: "#0B2236",
      borderRadius: 22,
      paddingVertical: 26,
      paddingHorizontal: 14,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 140,
      borderWidth: 1,
      borderColor: "rgba(124, 200, 255, 0.18)",
    },
    cardText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "700",
      marginTop: 12,
      textAlign: "center",
    },
    infoBox: {
      marginTop: 34,
      backgroundColor: "rgba(124, 200, 255, 0.08)",
      borderRadius: 20,
      padding: 20,
      borderWidth: 1,
      borderColor: "rgba(124, 200, 255, 0.2)",
    },
    infoTitle: {
      color: "#fff",
      fontSize: 20,
      fontWeight: "800",
      marginBottom: 8,
    },
    infoText: {
      color: "#9ca3af",
      fontSize: 16,
      lineHeight: 24,
    },
  });