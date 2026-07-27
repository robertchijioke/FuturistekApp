import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Text, View } from "react-native";
import { useCart } from "../../context/CartContext";

  export default function TabsLayout() {
    const { totalItems } = useCart();

    const cartCount = totalItems;
    const badgeText = cartCount > 99 ? "99+" : String(cartCount);
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
      name="store"
      options={{
      title: "Store",
      tabBarIcon: ({ color, size, focused }) => (
      <Ionicons
        name={focused ? "storefront" : "storefront-outline"}
        color={color}
        size={size}
      />
      ),
     }}
    />
      <Tabs.Screen
        name="devices"
        options={{
          title: "Devices",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="hardware-chip-outline" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
      name="orders"
      options={{
        href: null,
        title: "Orders",
      tabBarIcon: ({ color, size }) => <Ionicons name="receipt-outline" size={size} color={color} />
       }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          href: null,
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="support"
        options={{
          title: "Support",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-ellipses-outline" color={color} size={size} />
          ),
        }}
      />

       <Tabs.Screen
        name="my-designs"
        options={{
          href: null,
          title: "My Designs",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="images-outline" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
      name="menu"
      options={{
        title: "Menu",
        tabBarIcon: ({ color, size }) => (
          <Ionicons name="menu-outline" color={color} size={size} />
        ),
      }}
    />

     <Tabs.Screen
      name="cart"
      options={{
        href: null,
        title: "Cart",
        tabBarIcon: ({ color, size }) => (
      <View style={{ width: 28, height: 28, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="cart-outline" color={color} size={size ?? 24} />

    {cartCount > 0 && (
      <View
        style={{
          position: "absolute",
          top: -6,
          right: -10,
          backgroundColor: "#7CC8FF",
          borderRadius: 10,
          minWidth: 18,
          height: 18,
          paddingHorizontal: 5,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: "#0B1C2B", fontSize: 11, fontWeight: "800" }}>
          {cartCount > 99 ? "99+" : cartCount}
        </Text>
      </View>
    )}
  </View>
),
    tabBarBadgeStyle: {
      backgroundColor: "#7CC8FF",
      color: "#0B1C2B",
      fontSize: 12,
      fontWeight: "700",
      minWidth: 18,
      height: 18,
    },
  }}
/>
    </Tabs>
  );
}


