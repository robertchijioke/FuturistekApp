import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useCart } from "../../context/CartContext";
import { fetchShopifyProducts, ShopifyProduct } from "../../lib/shopify";

    export default function StoreScreen() {

      const router = useRouter();
      const { totalItems } = useCart();

      const { addToCart } = useCart();
      const [addedMap, setAddedMap] = useState<Record<string, boolean>>({});
      const [products, setProducts] = useState<ShopifyProduct[]>([]);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState("");

      useEffect(() => {
        (async () => {
          try {
            const data = await fetchShopifyProducts();
            setProducts(data);
          } catch (err: any) {
            console.log("Shopify fetch error:", err);
            setError(err?.message || "Failed to load products");
          } finally {
            setLoading(false);
          }
        })();
      }, []);

          if (loading) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Futuristek Products</Text>
          <ActivityIndicator size="large" />
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Futuristek Products</Text>
          <Text style={{ color: "tomato", marginTop: 12 }}>{error}</Text>
        </View>
      );
    }

    if (products.length === 0) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Futuristek Products</Text>
          <Text style={{ color: "#9ca3af", marginTop: 12 }}>No Shopify products found.</Text>
        </View>
      );
    }

    return (
      <View style={styles.container}>

    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 12,
        marginBottom: 16,
      }}
    >
      <Text style={styles.title}>Futuristek Products</Text>

      <Pressable onPress={() => router.push("/cart")}>
        <View>
          <Ionicons
            name="cart-outline"
            size={34}
            color="#ffffff"
          />
          {totalItems > 0 && (
            <View
              style={{
                position: "absolute",
                top: -6,
                right: -8,
                backgroundColor: "#7CC8FF",
                borderRadius: 10,
                minWidth: 18,
                height: 18,
                alignItems: "center",
                justifyContent: "center",
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
    </View>

    <FlatList
          data={products}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 30 }}
            renderItem={({ item }) => (
            <Pressable
            style={styles.card}
            onPress={() =>
            router.push({
            pathname: "/product/[id]",
            params: { id: String(item.handle) },
          })
      }

            >

          <View style={styles.imageWrap}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>
      {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
    </Text>
      </View>

    {item.image ? (
      <Image source={{ uri: item.image }} style={styles.image} resizeMode="contain" />
    ) : (
      <View style={styles.image} />
    )}

    </View>
            <View style={styles.info}>

      <Text style={styles.name}>{item.name}</Text>

      <Text style={styles.price}>
        From £{Number(item?.price || 0).toFixed(2)}
      </Text>


    <Pressable
      style={({ pressed }) => [
        styles.addButton,
        addedMap[String(item.id)] && styles.addButtonAdded,
        pressed && styles.addButtonPressed,
      ]}
      onPress={() => {
        addToCart({
          id: String(item.id),
          name: item.name,
          price: Number(item.price),
          image: item.image,

          cjSku: item.cjSku || item.variantSku || item.sku || "",
          cjProductId: item.cjProductId || item.productId || item.spu || "",
        });

        const key = String(item.id);
        setAddedMap((prev) => ({ ...prev, [key]: true }));
        setTimeout(() => {
          setAddedMap((prev) => ({ ...prev, [key]: false }));
        }, 1200);
      }}
    >
      <Text
        style={[
          styles.addButtonText,
          addedMap[String(item.id)] && styles.addButtonTextAdded,
        ]}
      >
        {addedMap[String(item.id)] ? "Added ✓" : "Add to Cart"}
      </Text>
    </Pressable>

      </View>
          </Pressable>
          )}

          />
        </View>
      );
    }

    const styles = StyleSheet.create({
      container: {
        flex: 1,
        backgroundColor: "#071827",
        paddingTop: 20,
        paddingHorizontal: 16,
      },
      title: {
        fontSize: 28,
        fontWeight: "800",
        color: "#5CC9FF",
        marginBottom: 16,
      },
      card: {
        backgroundColor: "#0E2436",
        borderRadius: 18,
        overflow: "hidden",
        marginBottom: 16,
      },

      imageWrap: {
      width: "100%",
      height: 260,
      backgroundColor: "#0f172a",
      justifyContent: "center",
      alignItems: "center",
      padding: 0,
      overflow: "hidden",
    },

    image: {
      width: "100%",
      height: "100%",
    },


      info: {
        padding: 14,
      },
      name: {
        fontSize: 18,
        fontWeight: "700",
        color: "#ffffff",
        marginBottom: 6,
      },
      price: {
        fontSize: 15,
        color: "#5CC9FF",
        fontWeight: "600",
      },

      badge: {
      position: "absolute",
      top: 12,
      left: 12,
      backgroundColor: "#5CC9FF",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      zIndex: 10,
    },

    badgeText: {
      color: "#fff",
      fontSize: 12,
      fontWeight: "600",
    },

    addButton: {
      marginTop: 10,
      backgroundColor: "#5CC9FF",
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: "center",

      shadowColor: "#5CC9FF",
      shadowOpacity: 0.6,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 0 },

      elevation: 6,
    },

    addButtonText: {
      color: "#002A3A",
      fontWeight: "600",
    },

    addButtonPressed: {
      transform: [{ scale: 0.98 }],
      opacity: 0.95,
    },
    addButtonAdded: {
      backgroundColor: "#22C55E", // success green
    },
    addButtonTextAdded: {
      color: "#06250F",
      fontWeight: "800",
    },

    });
