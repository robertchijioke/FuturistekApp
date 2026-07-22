import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { deleteAddress, getAddresses, setDefaultAddress, UserAddress } from "../lib/address";
import { auth } from "../lib/firebase";

import AsyncStorage from "@react-native-async-storage/async-storage";

export default function AddressesScreen() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const router = useRouter();
  const { fromCheckout } = useLocalSearchParams<{ fromCheckout?: string }>();
  const selectingForCheckout = fromCheckout === "true";
  const user = auth.currentUser;
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSelectAddress = async (address: any) => {
  if (from === "checkout") {
    await AsyncStorage.setItem("selected_checkout_address", JSON.stringify(address));
    router.back();
    return;
  }
};

  const loadAddresses = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const data = await getAddresses(user.uid);
      setAddresses(data);
    } catch (error) {
      console.log("LOAD ADDRESSES ERROR:", error);
      Alert.alert("Error", "Could not load addresses.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadAddresses();
    }, [loadAddresses])
  );

  if (!user) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#020817",
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
        }}
      >
        <Text style={{ color: "white", fontSize: 18 }}>
          Please sign in first.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#020817" }}
      contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
    >
      <Text
        style={{
          color: "white",
          fontSize: 36,
          fontWeight: "800",
          marginBottom: 12,
        }}
      >
        My Addresses
      </Text>

      <Text
        style={{
          color: "#cbd5e1",
          fontSize: 16,
          marginBottom: 24,
        }}
      >
        Save and manage your delivery addresses.
      </Text>

      <Pressable
        onPress={() => router.push("/add-address")}
        style={{
          backgroundColor: "#6da5fa",
          padding: 16,
          borderRadius: 14,
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <Text style={{ color: "white", fontWeight: "700", fontSize: 16 }}>
          Add New Address
        </Text>
      </Pressable>

      {loading ? (
        <Text style={{ color: "#cbd5e1" }}>Loading addresses...</Text>
      ) : addresses.length === 0 ? (
        <Text style={{ color: "#cbd5e1" }}>No saved addresses yet.</Text>
      ) : (
        addresses.map((address) => (
          <View
            key={address.id}
            style={{
              backgroundColor: "#0f172a",
              borderRadius: 16,
              padding: 18,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: address.isDefault ? "#6da5fa" : "#1e293b",
            }}
          >
            <Text
              style={{
                color: "white",
                fontSize: 18,
                fontWeight: "700",
                marginBottom: 8,
              }}
            >
              {address.fullName}
            </Text>

            <Text style={{ color: "#cbd5e1", marginBottom: 4 }}>
              {address.phone}
            </Text>
            <Text style={{ color: "#cbd5e1", marginBottom: 4 }}>
              {address.addressLine1}
            </Text>
            <Text style={{ color: "#cbd5e1", marginBottom: 10 }}>
              {address.city}, {address.postcode}
            </Text>

            {address.isDefault && (
              <Text
                style={{
                  color: "#6da5fa",
                  fontWeight: "700",
                  marginBottom: 12,
                }}
              >
                Default address
              </Text>
            )}

            <View style={{ flexDirection: "row", gap: 10 }}>
              {!address.isDefault && (
                <Pressable
                  onPress={async () => {
                    try {
                      await setDefaultAddress(user.uid, address.id!);
                      loadAddresses();
                    } catch {
                      Alert.alert("Error", "Could not set default address.");
                    }
                  }}
                  style={{
                    backgroundColor: "#1d4ed8",
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    borderRadius: 10,
                  }}
                >
                  <Text style={{ color: "white", fontWeight: "700" }}>
                    Set Default
                  </Text>
                </Pressable>
              )}

              {selectingForCheckout && (
                <Pressable
                  onPress={() =>
                    router.replace({
                      pathname: "/checkout",
                      params: {
                        selectedAddress: JSON.stringify(address),
                      },
                    })
                  }
                  style={{
                    backgroundColor: "#6fa5fa",
                    paddingVertical: 12,
                    paddingHorizontal: 18,
                    borderRadius: 12,
                    marginTop: 12,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: "white", fontWeight: "700" }}>Select</Text>
                </Pressable>
              )}

              <Pressable
                onPress={() => {
                  Alert.alert(
                    "Delete Address",
                    "Are you sure you want to delete this address?",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: async () => {
                          try {
                            await deleteAddress(user.uid, address.id!);
                            loadAddresses();
                          } catch {
                            Alert.alert("Error", "Could not delete address.");
                          }
                        },
                      },
                    ]
                  );
                }}
                style={{
                  backgroundColor: "#1e293b",
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: 10,
                }}
              >
                <Text style={{ color: "white", fontWeight: "700" }}>
                  Delete
                </Text>
              </Pressable>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}