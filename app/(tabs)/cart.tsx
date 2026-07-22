import { Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Alert, FlatList, Image, StyleSheet, Text, View } from "react-native";
import { useCart } from "../../context/CartContext";

import { useRouter } from "expo-router";

export default function CartScreen() {
  const router = useRouter();

  const {
    items,
    totalItems,
    totalPrice,
    increaseQty,
    decreaseQty,
    removeFromCart,
    clearCart,
  } = useCart();

  const goToCheckout = () => {
  if (!items?.length) {
    Alert.alert("Cart is empty");
    return;
  }
  router.push("/checkout");
};

    const handleCheckout = () => {
  if (!items.length) {
    Alert.alert("Cart is empty");
    return;
  }

  router.push("/checkout");
};

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.title}>Your cart is empty</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
  <SafeAreaView style={styles.container}>
    <Text style={styles.header}>Cart ({totalItems})</Text>

    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
      renderItem={({ item }) => {

        const imageUri =
          item.image?.startsWith("//")
            ? `https:${item.image}`
            : item.image;

        return (
          <View style={styles.card}>
          <View style={styles.row}>
           {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.image}
              resizeMode="contain"
            />
          ) : (
            <View style={[styles.image, { opacity: 0.15 }]} />
          )}

            <View style={styles.info}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.price}>
                £{Number(item.price || 0).toFixed(2)} x {item.qty}
              </Text>
            </View>
          </View>

          <View style={styles.actionsRow}>
            <View style={styles.qtyGroup}>
              <Pressable
                style={styles.qtyBtn}
                onPress={() => decreaseQty(item.id)}
              >
                <Text style={styles.qtyBtnText}>-</Text>
              </Pressable>

              <Text style={styles.qtyText}>{item.qty}</Text>

              <Pressable
                style={styles.qtyBtn}
                onPress={() => increaseQty(item.id)}
              >
                <Text style={styles.qtyBtnText}>+</Text>
              </Pressable>
            </View>

            <Pressable
              style={[styles.removeBtn, styles.removeBtnPushRight]}
              onPress={() => removeFromCart(item.id)}
            >
              <Text style={styles.removeText}>Remove</Text>
            </Pressable>
          </View>
        </View>
      );
      }}
    />

    <View style={styles.bottomBar}>
      <Text style={styles.totalText}>
        Total: £{Number(totalPrice || 0).toFixed(2)}
      </Text>

      <Pressable style={styles.checkoutBtn} onPress={goToCheckout}>
        <Text style={styles.checkoutText}>Checkout</Text>
      </Pressable>
    </View>
  </SafeAreaView>
);
}




const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#071726",
  },

  header: {
    fontSize: 28,
    fontWeight: "700",
    color: "white",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
  },

  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },

  image: {
    width: 72,
    height: 72,
    borderRadius: 14,
    backgroundColor: "white",
  },

  info: {
    flex: 1,
  },

  name: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
  },

  price: {
    color: "#8CC3FF",
    fontSize: 16,
    fontWeight: "600",
  },


  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 12,
  },

  qtyGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  qtyBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },

  qtyBtnText: {
    color: "white",
    fontSize: 22,
    fontWeight: "800",
  },

  qtyText: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
    minWidth: 22,
    textAlign: "center",
  },

  removeBtn: {
    backgroundColor: "rgba(255,90,90,0.18)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,90,90,0.22)",
  },

  removeBtnPushRight: {
    marginLeft: "auto",
  },

  removeText: {
    color: "#FF9A9A",
    fontWeight: "800",
    fontSize: 16,
  },

  // Bottom bar (Total + Checkout)
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#071A2A",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.12)",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  totalText: {
    fontSize: 22,
    fontWeight: "800",
    color: "white",
  },

  checkoutBtn: {
    marginLeft: "auto",
    backgroundColor: "#2E6BB6",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
  },

  checkoutText: {
    color: "white",
    fontWeight: "800",
    fontSize: 16,
  },

  center: {
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
  paddingHorizontal: 16,
},

title: {
  color: "white",
  fontSize: 20,
  fontWeight: "700",
},

});
