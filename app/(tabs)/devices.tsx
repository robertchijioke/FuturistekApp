import { StyleSheet, Text, View } from "react-native";

export default function DevicesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Devices</Text>
      <Text style={styles.text}>
        Your smart devices will appear here (lights, plugs, switches).
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 28, fontWeight: "800", marginBottom: 10 },
  text: { fontSize: 16, opacity: 0.85 },
});
