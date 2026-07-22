import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, db } from "../lib/firebase";

import { getAddresses, UserAddress } from "../lib/address";

import { useFocusEffect } from "@react-navigation/native";
import { useStripe } from '@stripe/stripe-react-native';
import { collection, getDocs, query } from "firebase/firestore";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCart } from "../context/CartContext";

const formatAddressParts = (parts: Array<string | undefined | null>) =>
  parts
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(", ");

export default function CheckoutScreen() {
  const params = useLocalSearchParams<{ selectedAddress?: string }>();

  const user = auth.currentUser;

  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<UserAddress | null>(null);
  const [loadingAddress, setLoadingAddress] = useState(true);

if (!user) {
  return <Redirect href="/(auth)/login?redirectTo=/checkout" />;
}

  const insets = useSafeAreaInsets();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const router = useRouter();
  const { items, totalPrice, clearCart } = useCart();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [postcode, setPostcode] = useState("");
  const [country, setCountry] = useState("United Kingdom");

  useFocusEffect(
    useCallback(() => {
      const loadSelectedCheckoutAddress = async () => {
        const saved = await AsyncStorage.getItem("selected_checkout_address");

        if (saved) {
          const parsed = JSON.parse(saved);

          setSelectedAddress(parsed);
          setFullName(parsed.fullName ?? "");
          setPhone(parsed.phone ?? "");
          setAddressLine1(parsed.line1 ?? "");
          setCity(parsed.city ?? "");
          setPostcode(parsed.postcode ?? "");
          setCountry(parsed.country ?? "United Kingdom");
        }
      };

      loadSelectedCheckoutAddress();
    }, [])
  );


  useEffect(() => {
  if (!selectedAddress) return;

  setFullName(selectedAddress.fullName || "");
  setPhone(selectedAddress.phone || "");

  const combinedAddress = [
    selectedAddress.addressLine1,
    selectedAddress.city,
    selectedAddress.postcode,
  ]
    .map((part) => (part || "").trim())
    .filter(Boolean)
    .join(", ");

  setAddressLine1(selectedAddress.addressLine1 || "");
  setCity(selectedAddress.city || "");
  setPostcode(selectedAddress.postcode || "");
}, [selectedAddress]);

  useEffect(() => {
  const loadAddresses = async () => {
    if (!user) return;

    try {
      const data = await getAddresses(user.uid);
      setAddresses(data);

      const defaultAddr = data.find(a => a.isDefault);
      setSelectedAddress(defaultAddr || data[0] || null);
    } catch (e) {
      console.log("ADDRESS LOAD ERROR:", e);
    } finally {
      setLoadingAddress(false);
    }
  };

  loadAddresses();
}, [user]);

useEffect(() => {
  const loadCheckoutData = async () => {
    try {
      if (user) {
        const addressesSnap = await getDocs(
          query(collection(db, "users", user.uid, "addresses"))
        );

        const addresses = addressesSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as any[];

        const defaultAddress = addresses.find(a => a.isDefault);
        if (defaultAddress) {
          setSelectedAddress(defaultAddress);
          setFullName(defaultAddress.fullName || "");
          setPhone(defaultAddress.phone || "");
          setAddressLine1(defaultAddress.line1 ?? "");
          setCity(defaultAddress.city ?? "");
          setPostcode(defaultAddress.postcode ?? "");
          setCountry(defaultAddress.country ?? "United Kingdom");
          return;
        }
      }

      const saved = await AsyncStorage.getItem("checkout_details");
      if (saved) {
        const parsed = JSON.parse(saved);
        setFullName(parsed.fullName || "");
        setPhone(parsed.phone || "");
        setAddressLine1(parsed.addressLine1 || "");
      }
    } catch (error) {
      console.log("loadCheckoutData error:", error);
    }
  };

  loadCheckoutData();
}, [user]);
  

  const deliveryFee = useMemo(() => (totalPrice > 0 ? 3.99 : 0), [totalPrice]);

  const grandTotal = useMemo(
    () => totalPrice + deliveryFee,
    [totalPrice, deliveryFee]
  );

  const placeOrder = async () => {
  const currentUser = auth.currentUser;

  if (!currentUser) {
      Alert.alert("Error", "User not logged in");
      return;
    }
  const phoneClean = phone.replace(/\s/g, "");

  if (!user) {
    router.push("/(auth)/login");
    return;
  }

  if (!selectedAddress) {
    Alert.alert("No address", "Please select a delivery address.");
    return;
  }

  if (phoneClean.length < 10) {
    Alert.alert("Invalid phone", "Please enter a valid phone number.");
    return;
  }

  try {
  const response = await fetch(
  "https://us-central1-futuristekapp.cloudfunctions.net/createPaymentIntent",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items: items.map((item) => ({
      id: item.id || "",
      name: item.name || "Product",
      price: Number(item.price || 0),
      qty: Number(item.qty || 1),
      cjSku: item.cjSku || item.sku || item.variantSku || "",
      cjProductId: item.cjProductId || item.productId || item.spu || "",
      supplierProductUrl: item.supplierProductUrl || item.productUrl || item.url || "",
    })),
      delivery: Number(deliveryFee || 0),
      email: currentUser.email || "",
      fullName: currentUser.displayName || "",
      phone: currentUser.phoneNumber || "",
    }),
  }
);

    const data = await response.json();

    if (!response.ok) {
      Alert.alert("Server error", data?.error || "Payment intent failed");
      return;
    }

const {
  paymentIntent,
  ephemeralKey,
  customer,
} = data;

const paymentIntentId = paymentIntent.split("_secret")[0];

const { error: initError } = await initPaymentSheet({
  merchantDisplayName: "Futuristek",

  customerId: customer,
  customerEphemeralKeySecret: ephemeralKey,

  paymentIntentClientSecret: paymentIntent,

  allowsDelayedPaymentMethods: true,

  defaultBillingDetails: {
    name: fullName,
    email: currentUser?.email || "",
    phone,
    address: {
      country: "GB",
      line1: addressLine1,
      city,
      postalCode: postcode,
    },
  },
});

    if (initError) {
      Alert.alert("Error", initError.message);
      return;
    }

    if (!fullName.trim()) return Alert.alert("Enter your name");
    if (!phone.trim()) return Alert.alert("Enter your phone");
    if (!addressLine1.trim()) return Alert.alert("Enter your address");
    if (!city.trim()) return Alert.alert("Enter your city");
    if (!postcode.trim()) return Alert.alert("Enter your postcode");

    const { error: paymentError } = await presentPaymentSheet();

    if (paymentError) {
      Alert.alert("Payment failed", paymentError.message);
      return;
    }

    console.log("🛒 CHECKOUT ITEMS:", items);

    const verifyResponse = await fetch(
      "https://us-central1-futuristekapp.cloudfunctions.net/verifyPaymentAndCreateOrder",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          paymentIntentId,
          userId: currentUser.uid,
          email: currentUser.email || "",
          fullName,
          phone,

          addressLine1,
          city,
          postcode,
          country,

          address: `${addressLine1}, ${city}, ${postcode}, ${country}`,
          items: items.map((it: any) => ({
            id: String(it.id ?? it.productId ?? it.title ?? ""),
            name: String(it.title ?? it.name ?? "Item"),
            title: String(it.title ?? it.name ?? "Item"),
            price: Number(it.price ?? 0),
            qty: Number(it.qty ?? it.quantity ?? 1),
            image: String(it.image ?? ""),
            cjSku: String(it.cjSku || ""),
            cjProductId: String(it.cjProductId || ""),
          })),
          subtotal: Number(totalPrice),
          deliveryFee: Number(deliveryFee),
          totalPrice: Number(grandTotal),
          paymentMethod: "stripe",
        }),
      }
    );
    const verifyData = await verifyResponse.json();

    if (!verifyResponse.ok) {
      Alert.alert(
        "Order verification failed",
        verifyData?.error || "Could not verify payment and create order."
      );
      return;
    }

    const orderId = verifyData.orderId;

    await AsyncStorage.setItem(
      "checkout_details",
      JSON.stringify({
        fullName,
        phone,
        addressLine1,
      })
    );

    clearCart();

    Alert.alert(
      "Order placed 🎉",
      `Thanks ${fullName.split(" ")[0] || ""}! Your order total is £${grandTotal.toFixed(2)}.`,
      [
        {
          text: "OK",
          onPress: () =>
            router.replace({
              pathname: "/success",
              params: {
                orderId,
                total: grandTotal.toFixed(2),
                name: fullName.split(" ")[0] || "",
              },
            }),
        },
      ]
    );

      } catch (err: any) {
        console.log("Checkout error:", err);
        Alert.alert("Error", err?.message || "Something went wrong");
      }
    };


  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <Text style={styles.title}>Checkout</Text>
        <Text style={styles.muted}>Your cart is empty.</Text>

        <Pressable onPress={() => router.replace("/(tabs)/store")
        } style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>Go to Store</Text>
        </Pressable>
      </SafeAreaView>
    );
  }


return (
  <SafeAreaView style={styles.container} edges={["bottom"]}>
    <ScrollView style={{ flex: 1}}
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 170 }}
      showsVerticalScrollIndicator={false} 
    >

      <View
        style={{
          backgroundColor: "#0f172a",
          padding: 16,
          borderRadius: 14,
          marginBottom: 20,
          borderWidth: 1,
          borderColor: "#1e293b",
        }}
      >
        <Text style={{ color: "#cbd5e1", marginBottom: 6 }}>
          Delivery Address
        </Text>

        {loadingAddress ? (
          <Text style={{ color: "white" }}>Loading...</Text>
        ) : selectedAddress ? (
          <>
      <Text style={{ color: "white", fontWeight: "700" }}>
        {selectedAddress.fullName}
      </Text>

      <Text style={{ color: "#cbd5e1" }}>
        {selectedAddress.phone}
      </Text>

      {!!selectedAddress.addressLine1 && (
        <Text style={{ color: "#cbd5e1" }}>
          {selectedAddress.addressLine1}
        </Text>
      )}

      <Text style={{ color: "#cbd5e1" }}>
        {[selectedAddress.city, selectedAddress.postcode].filter(Boolean).join(", ")}
      </Text>
      </>
        ) : (
          <Text style={{ color: "#cbd5e1" }}>
            No address found. Please add one.
          </Text>
        )}

        <Pressable
          onPress={() =>
            
      router.push({
        pathname: "/addresses",
        params: { fromCheckout: "true" },
      })
          }
          style={{ marginTop: 10 }}
        >
          <Text style={{ color: "#6da5fa", fontWeight: "700" }}>
            Change Address
          </Text>
        </Pressable>
      </View>

      <Text style={styles.title}>Checkout</Text>
      <View style={styles.card}>

      <Text style={styles.sectionTitle}>Delivery details</Text>

        <TextInput
          value={fullName}
          onChangeText={setFullName}
          placeholder="Full name"
          placeholderTextColor="rgba(255,255,255,0.6)"
          style={styles.input}
        />

        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder="Phone number"
          placeholderTextColor="rgba(255,255,255,0.6)"
          keyboardType="phone-pad"
          maxLength={15}
          style={styles.input}
        />

        <TextInput
          value={`${addressLine1}\n${city}\n${postcode}\n${country}`}
          onChangeText={setAddressLine1}
          placeholder="Delivery address"
          placeholderTextColor="rgba(255,255,255,0.6)"
          style={[styles.input, styles.inputMultiline]}
          multiline
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Order summary</Text>

        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemPrice}>
               £{Number(item.price || 0).toFixed(2)}
              </Text>
            </View>
          )}
        />
      </View>


      </ScrollView>
    <View style={[styles.bottomBar, {paddingBottom: insets.bottom + 18}]}>
      <View>
        <Text style={styles.bottomLabel}>Subtotal</Text>
        <Text style={styles.bottomLabel}>Delivery</Text>
        <Text style={styles.bottomTotalLabel}>Total</Text>
      </View>

      <View style={{ alignItems: "flex-end" }}>
        <Text style={styles.bottomValue}>£{totalPrice.toFixed(2)}</Text>
        <Text style={styles.bottomValue}>£{deliveryFee.toFixed(2)}</Text>
        <Text style={styles.bottomTotalValue}>£{grandTotal.toFixed(2)}</Text>
      </View>

      <Pressable style={styles.placeOrderBtn} onPress={placeOrder}>
        <Text style={styles.placeOrderText}>Place Order</Text>
      </Pressable>
    </View>
  </SafeAreaView>
);
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#071A2A",
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "white",
    marginBottom: 12,
  },
  muted: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 16,
    marginTop: 6,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },
  sectionTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: "white",
    marginBottom: 10,
    fontSize: 15,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sep: {
    height: 10,
  },
  itemName: {
    color: "white",
    fontSize: 15,
    fontWeight: "700",
  },
  itemMeta: {
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
  },
  lineTotal: {
    color: "white",
    fontWeight: "800",
  },
  
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  totalLabel: {
    color: "rgba(255,255,255,0.75)",
  },
  totalValue: {
    color: "white",
    fontWeight: "700",
  },
  grandLabel: {
    color: "white",
    fontWeight: "900",
    fontSize: 16,
  },
  grandValue: {
    color: "white",
    fontWeight: "900",
    fontSize: 16,
  },
  checkoutBtn: {
    backgroundColor: "#2E6BB5",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    minWidth: 140,
    alignItems: "center",
    justifyContent: "center",
  },
  checkoutBtnText: {
    color: "white",
    fontWeight: "900",
    fontSize: 16,
  },
  primaryBtn: {
    marginTop: 16,
    backgroundColor: "#2E6BB5",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
  },
  primaryBtnText: {
    color: "white",
    fontWeight: "900",
    fontSize: 16,
  },

  bottomBar: {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  paddingHorizontal: 18,
  paddingTop: 14,
  backgroundColor: "#0b1620",
  borderTopWidth: 1,
  borderTopColor: "rgba(255,255,255,0.08)",
  flexDirection: "row",
  alignItems: "center",
  gap: 16,
},

placeOrderBtn: {
  marginLeft: "auto",
  backgroundColor: "#2E6BD5",
  paddingHorizontal: 22,
  paddingVertical: 14,
  borderRadius: 16,
},

placeOrderText: {
  color: "#fff",
  fontSize: 16,
  fontWeight: "700",
},

bottomLabel: {
  color: "rgba(255,255,255,0.6)",
  fontSize: 12,
  lineHeight: 18,
},

bottomValue: {
  color: "#fff",
  fontSize: 13,
  lineHeight: 18,
  fontWeight: "600",
},

bottomTotalLabel: {
  color: "#fff",
  fontSize: 13,
  fontWeight: "700",
  marginTop: 4,
},

bottomTotalValue: {
  color: "#fff",
  fontSize: 15,
  fontWeight: "800",
  marginTop: 4,
},

itemPrice: {
  fontSize: 14,
  color: "rgba(255,255,255,0.9)",
  fontWeight: "700",
},

footer: {
  padding: 16,
  paddingBottom: 28,
  backgroundColor: "#0B1E2D"
}

})
