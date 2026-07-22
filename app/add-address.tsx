import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { saveAddress } from "../lib/address";
import { auth } from "../lib/firebase";

export default function AddAddressScreen() {
  const user = auth.currentUser;

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [postcode, setPostcode] = useState("");
  const [isDefault, setIsDefault] = useState(true);
  const [saving, setSaving] = useState(false);

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

  const onSave = async () => {
    if (!fullName || !phone || !addressLine1 || !city || !postcode) {
      Alert.alert("Missing fields", "Please complete all address fields.");
      return;
    }

    try {
      setSaving(true);

      await saveAddress(user.uid, {
        fullName,
        phone,
        addressLine1,
        city,
        postcode,
        isDefault,
      });

      Alert.alert("Saved", "Address added successfully.", [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      console.log("SAVE ADDRESS ERROR:", error);
      Alert.alert("Error", "Could not save address.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#020817" }}
      contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
    >
      <Text
        style={{
          color: "white",
          fontSize: 34,
          fontWeight: "800",
          marginBottom: 24,
        }}
      >
        Add Address
      </Text>

      {[
        { placeholder: "Full Name", value: fullName, setter: setFullName },
        { placeholder: "Phone", value: phone, setter: setPhone },
        {
          placeholder: "Address Line 1",
          value: addressLine1,
          setter: setAddressLine1,
        },
        { placeholder: "City", value: city, setter: setCity },
        { placeholder: "Postcode", value: postcode, setter: setPostcode },
      ].map((field, index) => (
        <TextInput
          key={index}
          placeholder={field.placeholder}
          placeholderTextColor="#64748b"
          value={field.value}
          onChangeText={field.setter}
          style={{
            backgroundColor: "#0f172a",
            color: "white",
            borderWidth: 1,
            borderColor: "#1e293b",
            borderRadius: 14,
            padding: 16,
            marginBottom: 16,
            fontSize: 16,
          }}
        />
      ))}

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "#0f172a",
          borderRadius: 14,
          padding: 16,
          marginBottom: 24,
          borderWidth: 1,
          borderColor: "#1e293b",
        }}
      >
        <Text style={{ color: "white", fontSize: 16 }}>Set as default</Text>
        <Switch value={isDefault} onValueChange={setIsDefault} />
      </View>

      <Pressable
        onPress={onSave}
        disabled={saving}
        style={{
          backgroundColor: saving ? "#334155" : "#6da5fa",
          padding: 16,
          borderRadius: 14,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "white", fontWeight: "700", fontSize: 16 }}>
          {saving ? "Saving..." : "Save Address"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}