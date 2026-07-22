import { StyleSheet, Text, View } from "react-native";

export default function MyDesignsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Designs</Text>
      <Text style={styles.subtitle}>
        Your generated room designs will appear here.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#06111f",
    padding: 24,
    paddingTop: 70,
  },
  title: {
    color: "#fff",
    fontSize: 34,
    fontWeight: "900",
    marginBottom: 12,
  },
  subtitle: {
    color: "#b8c7dc",
    fontSize: 18,
    lineHeight: 26,
  },
});