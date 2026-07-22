import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useCart } from "../../context/CartContext";

export default function HomeScreen() {
  const router = useRouter();
  const { totalItems } = useCart();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.hero}>

        <Pressable
          onPress={() => router.push("/cart")}
          style={{
            position: "absolute",
            top: 50,
            right: 20,
            zIndex: 10,
          }}
        >
          <View>
            <Ionicons
              name="cart-outline"
              size={30}
              color="#FFFFFF"
            />

            {totalItems > 0 && (
              <View
                style={{
                  position: "absolute",
                  top: -6,
                  right: -10,
                  backgroundColor: "#7CC8FF",
                  borderRadius: 10,
                  minWidth: 18,
                  height: 18,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: "#0B1C2B",
                    fontSize: 10,
                    fontWeight: "700",
                  }}
                >
                  {totalItems}
                </Text>
              </View>
            )}
          </View>
        </Pressable>

        <Image
          source={{ uri: "https://images.unsplash.com/photo-1558002038-1055907df827" }}
          style={styles.heroImage}
        />
        <View style={styles.overlay}>
          <Text style={styles.heroTitle}>Smart Living Made Simple</Text>
          <Text style={styles.heroSubtitle}>
            Upgrade your home with smart devices
          </Text>
        </View>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Why Choose Futuristek?</Text>

        <Text style={styles.bullet}>• Smart tech for everyday living</Text>
        <Text style={styles.bullet}>• Works with Alexa & Google Home</Text>
        <Text style={styles.bullet}>• Easy setup & global compatibility</Text>
        <Text style={styles.bullet}>• Fast worldwide shipping</Text>
      </View>

      <View style={styles.grid}>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Best Sellers</Text>

        <View style={styles.grid}>
          <Pressable
            onPress={() => router.push("/product/123")}
            style={styles.productCard}
          >
            <Image
              source={{ uri: "https://your-product-image-url" }}
              style={styles.productImage}
              resizeMode="cover"
            />
            <Text style={styles.productName} numberOfLines={2}>
              Smart WiFi Plug
            </Text>
            <Text style={styles.productPrice}>£19.99</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/product/124")}
            style={styles.productCard}
          >
            <Image
              source={{ uri: "https://your-product-image-url" }}
              style={styles.productImage}
              resizeMode="cover"
            />
            <Text style={styles.productName} numberOfLines={2}>
              Smart Touch Light Switch
            </Text>
            <Text style={styles.productPrice}>£24.99</Text>
          </Pressable>
          </View>
        </View>

        {/* COLLECTIONS */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Collections</Text>

      </View>

        <View style={styles.grid}>
          <View style={styles.card}>
            <Text style={styles.cardText}>Smart Lighting</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardText}>Smart Security</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardText}>Best Sellers</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardText}>Essentials</Text>
          </View>
        </View>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0F1A",
  },

  hero: {
    height: 300,
  },

  heroImage: {
    width: "100%",
    height: 260,
  },

overlay: {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0,0,0,0.35)",
  justifyContent: "flex-end",
  padding: 20,
},

  heroTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
  },

heroSubtitle: {
  color: "#e5e7eb",
  fontSize: 16,
  marginTop: 8,
},

section: {
  paddingHorizontal: 20,
  marginTop: 24,
  paddingTop: 20,
  paddingBottom: 10,
},

  sectionTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 14,
  },

  bullet: {
    color: "#ccc",
    marginBottom: 6,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 16,
  },

  card: {
    width: "48%",
    height: 110,
    backgroundColor: "#1A1F2E",
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },

  cardText: {
    color: "#fff",
    fontWeight: "600",
  },

productCard: {
  width: "48%",
  backgroundColor: "#141a33",
  borderRadius: 20,
  padding: 12,
  marginBottom: 16,
  minHeight: 210,
},

productImagePlaceholder: {
  width: "100%",
  height: 120,
  backgroundColor: "#E5E7EB",
  borderRadius: 10,
  marginBottom: 10,
},

productName: {
  color: "#fff",
  fontSize: 15,
  fontWeight: "700",
  lineHeight: 20,
  minHeight: 40,
},

productPrice: {
  color: "#60a5fa",
  fontSize: 15,
  fontWeight: "800",
  marginTop: 6,
},

productImage: {
  width: "100%",
  height: 110,
  borderRadius: 16,
  backgroundColor: "#d9d9d9",
  marginBottom: 10,
},

heroOverlay: {
  position: "absolute",
  left: 20,
  right: 20,
  bottom: 24,
},
});
