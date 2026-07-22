import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { useCart } from "../context/CartContext";

export default function CartButton() {
  const router = useRouter();
  const { totalItems } = useCart();

  return (
    <Pressable
      onPress={() => router.push("/cart")}
      style={{
        position: "absolute",
        top: 10,
        right: 16,
        width: 56,
        height: 56,
        alignItems: "center",
        justifyContent: "center",
        zIndex: 999,
        elevation: 20,
      }}
    >
      <View style={{ position: "relative" }}>
        <Ionicons name="cart-outline" size={38} color="white" />

        {totalItems > 0 && (
          <View
            style={{
              position: "absolute",
              top: -10,
              right: -10,
              backgroundColor: "#7CC8FF",
              borderRadius: 10,
              minWidth: 20,
              height: 20,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 5,
              zIndex: 1000,
              elevation: 30,
            }}
          >
            <Text
              style={{
                color: "#0B1C2B",
                fontSize: 11,
                fontWeight: "800",
              }}
            >
              {totalItems > 99 ? "99+" : totalItems}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}