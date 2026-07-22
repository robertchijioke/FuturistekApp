import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function MenuScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Menu</Text>

      <Pressable style={styles.card} onPress={() => router.push("/orders")}>
        <Ionicons name="receipt-outline" size={30} color="#7CC8FF" />
        <Text style={styles.cardText}>Orders</Text>
      </Pressable>

      <Pressable style={styles.card} onPress={() => router.push("/profile")}>
        <Ionicons name="person-outline" size={30} color="#7CC8FF" />
        <Text style={styles.cardText}>Profile</Text>
      </Pressable>

     <Pressable
        style={styles.card}
        onPress={() => router.push("/my-designs")}
      >
        <Ionicons
          name="images-outline"
          size={30}
          color="#7CC8FF"
        />
        <Text style={styles.cardText}>My Designs</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#071827",
    paddingTop: 70,
    paddingHorizontal: 28,
  },

  title: {
    color: "#ffffff",
    fontSize: 42,
    fontWeight: "900",
    marginBottom: 28,
  },

  card: {
    backgroundColor: "#0E2436",
    borderRadius: 22,
    paddingVertical: 24,
    paddingHorizontal: 22,
    marginBottom: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },

  cardText: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "800",
  },
});