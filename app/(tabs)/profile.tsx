import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import {
  stopAutomationEngine,
} from "../../lib/automationEngine";
import { auth, db } from "../../lib/firebase";
import { registerForPushNotificationsAsync } from "../../lib/notifications";
import { getUserProfile, updateUserProfile } from "../../lib/user";


export default function ProfileScreen() {
  const user = auth.currentUser;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [signingOut, setSigningOut] =
    useState(false);
  const [staffRole, setStaffRole] =
    useState<string | null>(null);

  const isSiteManager =
    staffRole === "SITE_MANAGER";

  const isEnterpriseAdmin =
    staffRole === "ENTERPRISE_ADMIN";

  const isStaffAccount =
    isSiteManager || isEnterpriseAdmin;

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const accessProfileSnapshot = await getDoc(
          doc(
            db,
            "userAccessProfiles",
            user.uid
          )
        );

        if (accessProfileSnapshot.exists()) {
          const accessData =
            accessProfileSnapshot.data();

          const role = String(
            accessData.role ?? ""
          )
            .trim()
            .toUpperCase();

          const isStaffAccount =
            role === "ENTERPRISE_ADMIN" ||
            role === "SITE_MANAGER";

          if (isStaffAccount) {
            if (!cancelled) {
              setStaffRole(role);

              setFullName(
                String(
                  accessData.fullName ??
                    accessData.displayName ??
                    accessData.name ??
                    user.displayName ??
                    user.email ??
                    "Staff account"
                ).trim()
              );

              setPhone(
                String(
                  accessData.phone ?? ""
                ).trim()
              );
            }

            console.log(
              "STAFF PROFILE LOADED:",
              {
                role,
                uid: user.uid,
              }
            );

            return;
          }
        }

        if (!cancelled) {
          setStaffRole(null);
        }

        const profile = await getUserProfile(
          user.uid
        );

        if (profile && !cancelled) {
          setFullName(
            profile.fullName ?? ""
          );

          setPhone(profile.phone ?? "");
        }
      } catch (error) {
        console.error(
          "PROFILE LOAD ERROR:",
          error
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  useEffect(() => {
    let cancelled = false;

    const savePushToken = async () => {
      const currentUser = auth.currentUser;

      if (!currentUser?.uid) {
        return;
      }

      try {
        const accessProfileSnapshot = await getDoc(
          doc(
            db,
            "userAccessProfiles",
            currentUser.uid
          )
        );

        if (accessProfileSnapshot.exists()) {
          const accessData =
            accessProfileSnapshot.data();

          const role = String(
            accessData.role ?? ""
          )
            .trim()
            .toUpperCase();

          const isStaffAccount =
            accessData.enabled === true &&
            (
              role === "ENTERPRISE_ADMIN" ||
              role === "SITE_MANAGER"
            );

          if (isStaffAccount) {
            console.log(
              "STAFF PUSH TOKEN SAVE SKIPPED:",
              {
                uid: currentUser.uid,
                role,
              }
            );

            return;
          }
        }

        const token =
          await registerForPushNotificationsAsync();

        if (!token || cancelled) {
          return;
        }

        await setDoc(
          doc(
            db,
            "users",
            currentUser.uid
          ),
          {
            email: currentUser.email ?? "",
            expoPushToken: token,
            updatedAt: new Date().toISOString(),
          },
          {
            merge: true,
          }
        );

        console.log(
          "Saved expo push token:",
          token
        );
      } catch (error) {
        console.error(
          "PUSH TOKEN SAVE ERROR:",
          error
        );
      }
    };

    void savePushToken();

    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const onSave = async () => {

    if (staffRole) {
      Alert.alert(
        "Staff profile",
        "Staff profile details are managed through the staff access system."
      );

      return;
    }

    if (!user) return;

    try {
      setSaving(true);

      await updateUserProfile(user.uid, {
        fullName: fullName.trim(),
        phone: phone.trim(),
      });

      Alert.alert("Saved", "Your profile has been updated.");
    } catch (error: any) {
      Alert.alert("Error", error?.message ?? "Could not save profile.");
    } finally {
      setSaving(false);
    }
  };

  const onSignOut = async () => {
    if (signingOut) return;

    setSigningOut(true);

    try {
      stopAutomationEngine();

      router.dismissAll();
      router.replace("/(tabs)/home" as any);

      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      });

      await signOut(auth);

      console.log("PROFILE SIGN OUT SUCCESS");
    } catch (error: any) {
      console.error("PROFILE SIGN OUT ERROR:", error);

      setSigningOut(false);

      Alert.alert(
        "Sign out failed",
        error?.message ?? "Please try again."
      );
    }
  };

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
        <Text
          style={{
            color: "white",
            fontSize: 24,
            fontWeight: "700",
            marginBottom: 16,
          }}
        >
          Welcome
        </Text>

        <Text
          style={{
            color: "#cbd5e1",
            fontSize: 16,
            textAlign: "center",
            marginBottom: 24,
          }}
        >
          Sign in to manage your profile, saved details, and account settings.
        </Text>

        <Pressable
          onPress={() => router.push("/(auth)/login?redirectTo=/(tabs)/profile")}
          style={{
            backgroundColor: "#6da5fa",
            paddingVertical: 14,
            paddingHorizontal: 32,
            borderRadius: 14,
          }}
        >
          <Text style={{ color: "white", fontWeight: "700", fontSize: 18 }}>
            Sign In
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#020817",
        paddingHorizontal: 24,
        paddingTop: 80,
      }}
    >
      <Text
        style={{
          color: "#ffffff",
          fontSize: 42,
          fontWeight: "900",
          marginBottom: 18,
        }}
      >
        {isStaffAccount
          ? "Staff Profile"
          : "My Profile"}
      </Text>

      <Text
        style={{
          color: "#cbd5e1",
          fontSize: 16,
          marginBottom: 24,
        }}
      >
        Signed in as {user.email}
      </Text>

      {isStaffAccount && (
        <Text
          style={{
            color: "#93c5fd",
            fontSize: 18,
            lineHeight: 27,
            marginTop: 10,
            marginBottom: 24,
          }}
        >
          {isSiteManager
            ? "Site Manager • assigned-site care access"
            : "Enterprise Admin • full operational access"}
        </Text>
      )}

      {!isStaffAccount && (
     <>
      <TextInput
        value={fullName}
        onChangeText={setFullName}
        placeholder="Full name"
        placeholderTextColor="#64748b"
        style={{
          backgroundColor: "#0f172a",
          color: "white",
          borderWidth: 1,
          borderColor: "#334155",
          borderRadius: 14,
          padding: 14,
          marginBottom: 16,
        }}
      />

      <TextInput
        value={phone}
        onChangeText={setPhone}
        placeholder="Phone number"
        placeholderTextColor="#64748b"
        keyboardType="phone-pad"
        style={{
          backgroundColor: "#0f172a",
          color: "white",
          borderWidth: 1,
          borderColor: "#334155",
          borderRadius: 14,
          padding: 14,
          marginBottom: 20,
        }}
      />

      <Pressable
        onPress={onSave}
        disabled={saving || loading}
        style={{
          backgroundColor: "#6da5fa",
          paddingVertical: 16,
          borderRadius: 14,
          alignItems: "center",
          marginBottom: 16,
          opacity: saving ? 0.7 : 1,
        }}
      >
        <Text style={{ color: "white", fontWeight: "700", fontSize: 18 }}>
          {saving ? "Saving..." : "Save Profile"}
        </Text>
      </Pressable>

      <Pressable
        onPress={() => router.push("/addresses")}
        style={{
          backgroundColor: "#0f172a",
          padding: 16,
          borderRadius: 14,
          alignItems: "center",
          marginTop: 12,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: "#1e293b",
    }}
        >
          <Text style={{ color: "white", fontWeight: "700", fontSize: 16 }}>
            Manage Addresses
          </Text>
        </Pressable>
        </>
    )}

    {isStaffAccount && (
      <Pressable
        onPress={() =>
          router.push(
            "/mission-control" as any
          )
        }
        style={{
          backgroundColor: "#2563eb",
          paddingVertical: 18,
          borderRadius: 16,
          alignItems: "center",
          marginBottom: 18,
        }}
      >
        <Text
          style={{
            color: "#ffffff",
            fontSize: 20,
            fontWeight: "900",
          }}
        >
          🌍 Open Mission Control
        </Text>
      </Pressable>
    )}
      {isEnterpriseAdmin && (
  <>
      <Pressable
        onPress={() => router.push("/admin")}
        style={{
          backgroundColor: "#101a33",
          paddingVertical: 18,
          borderRadius: 18,
          alignItems: "center",
          marginTop: 18,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.06)",
        }}
      >
        <Text
          style={{
            color: "white",
            fontSize: 18,
            fontWeight: "700",
          }}
        >
          Admin Dashboard
        </Text>
      </Pressable>
      </>
    )}

      {!isStaffAccount && (
        <Pressable
          onPress={onSignOut}
          disabled={signingOut}
          style={{
          backgroundColor: "#1e293b",
          paddingVertical: 16,
          borderRadius: 14,
          alignItems: "center",
          opacity: signingOut ? 0.6 : 1,
        }}
      >
        <Text style={{ color: "white", fontWeight: "700", fontSize: 18 }}>
          {signingOut ? "Signing out..." : "Sign out"}
        </Text>
      </Pressable>
    )}

    {isStaffAccount && (
      <Pressable
        onPress={() =>
          router.push(
            "/(tabs)/menu" as any
          )
        }
        style={{
          backgroundColor: "#1e293b",
          paddingVertical: 17,
          borderRadius: 15,
          alignItems: "center",
        }}
      >
        <Text
          style={{
            color: "#ffffff",
            fontSize: 18,
            fontWeight: "800",
          }}
        >
          ← Back to Staff Menu
        </Text>
      </Pressable>
    )}
    </View>
  );
}