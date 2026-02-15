import { StyleSheet, Text, View } from "react-native";

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Futuristek</Text>
      <Text style={styles.subtitle}>Smart Living Starts Here</Text>
      <Text style={styles.text}>Welcome 👋</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: "center" },
  title: { fontSize: 34, fontWeight: "800", textAlign: "center" },
  subtitle: { fontSize: 16, opacity: 0.8, textAlign: "center", marginTop: 6 },
  text: { fontSize: 16, textAlign: "center", marginTop: 16 },
});
