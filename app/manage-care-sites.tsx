import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { auth, db } from "../lib/firebase";

type CareSite = {
  id: string;
  code: string;
  name: string;
  location: string;
  contactEmail: string;
  contactPhone: string;
  enabled: boolean;
};

const normaliseSiteId = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export default function ManageCareSitesScreen() {
  const router = useRouter();

  const [checkingAccess, setCheckingAccess] = useState(true);
  const [isEnterpriseAdmin, setIsEnterpriseAdmin] = useState(false);

  const [sites, setSites] = useState<CareSite[]>([]);
  const [loadingSites, setLoadingSites] = useState(true);
  const [saving, setSaving] = useState(false);

  const [siteCode, setSiteCode] = useState("");
  const [siteName, setSiteName] = useState("");
  const [location, setLocation] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  // Confirm that only an enabled Enterprise Admin can open this screen.
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setIsEnterpriseAdmin(false);
        setCheckingAccess(false);
        router.replace("/(tabs)/menu" as any);
        return;
      }

      try {
        const profileSnapshot = await getDoc(
          doc(db, "userAccessProfiles", user.uid)
        );

        if (!profileSnapshot.exists()) {
          setIsEnterpriseAdmin(false);
          setCheckingAccess(false);
          router.replace("/(tabs)/menu" as any);
          return;
        }

        const profile = profileSnapshot.data();

        const allowed =
          profile.enabled === true &&
          String(profile.role ?? "")
            .trim()
            .toUpperCase() === "ENTERPRISE_ADMIN";

        setIsEnterpriseAdmin(allowed);
        setCheckingAccess(false);

        if (!allowed) {
          Alert.alert(
            "Access restricted",
            "Only an Enterprise Admin can manage care sites."
          );

          router.replace("/(tabs)/menu" as any);
        }
      } catch (error) {
        console.error("CARE SITE ACCESS CHECK ERROR:", error);

        setIsEnterpriseAdmin(false);
        setCheckingAccess(false);

        router.replace("/(tabs)/menu" as any);
      }
    });

    return unsubscribeAuth;
  }, [router]);

  // Load care sites only after Enterprise Admin access is confirmed.
  useEffect(() => {
    if (!isEnterpriseAdmin) {
      return;
    }

    const unsubscribeSites = onSnapshot(
      collection(db, "careSites"),
      (snapshot) => {
        const loadedSites: CareSite[] = snapshot.docs
          .map((siteDocument) => {
            const data = siteDocument.data();

            return {
              id: siteDocument.id,
              code: String(data.code ?? siteDocument.id).trim(),
              name:
                String(data.name ?? "Unnamed Care Site").trim() ||
                "Unnamed Care Site",
              location:
                String(data.location ?? "Location not provided").trim() ||
                "Location not provided",
              contactEmail: String(data.contactEmail ?? "").trim(),
              contactPhone: String(data.contactPhone ?? "").trim(),
              enabled: data.enabled !== false,
            };
          })
          .sort((firstSite, secondSite) =>
            firstSite.name.localeCompare(secondSite.name)
          );

        setSites(loadedSites);
        setLoadingSites(false);

        console.log("MANAGE CARE SITES LOADED:", {
          count: loadedSites.length,
        });
      },
      (error) => {
        console.error("MANAGE CARE SITES LISTENER ERROR:", error);
        setLoadingSites(false);
      }
    );

    return unsubscribeSites;
  }, [isEnterpriseAdmin]);

  const clearForm = () => {
    setSiteCode("");
    setSiteName("");
    setLocation("");
    setContactEmail("");
    setContactPhone("");
  };

  const addCareSite = async () => {
    if (saving) {
      return;
    }

    const currentUser = auth.currentUser;
    const normalisedCode = normaliseSiteId(siteCode);
    const trimmedName = siteName.trim();
    const trimmedLocation = location.trim();

    if (!currentUser) {
      Alert.alert("Session expired", "Please sign in again.");
      return;
    }

    if (!normalisedCode) {
      Alert.alert(
        "Site code required",
        "Enter a unique code such as site-4."
      );
      return;
    }

    if (!trimmedName) {
      Alert.alert("Site name required", "Enter the care site's name.");
      return;
    }

    if (!trimmedLocation) {
      Alert.alert("Location required", "Enter the town or city.");
      return;
    }

    setSaving(true);

    try {
      const siteReference = doc(db, "careSites", normalisedCode);
      const existingSite = await getDoc(siteReference);

      if (existingSite.exists()) {
        Alert.alert(
          "Site code already exists",
          `A care site already uses the code "${normalisedCode}".`
        );

        setSaving(false);
        return;
      }

      const auditReference = doc(
        collection(db, "siteAdministrationAudit")
      );

      const batch = writeBatch(db);

      batch.set(siteReference, {
        code: normalisedCode,
        name: trimmedName,
        location: trimmedLocation,
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone.trim(),
        enabled: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: currentUser.uid,
        createdByEmail: currentUser.email ?? "",
      });

      batch.set(auditReference, {
        action: "CARE_SITE_CREATED",
        siteId: normalisedCode,
        siteName: trimmedName,
        siteLocation: trimmedLocation,
        performedBy: currentUser.uid,
        performedByEmail: currentUser.email ?? "",
        performedByRole: "ENTERPRISE_ADMIN",
        createdAt: serverTimestamp(),
      });

      await batch.commit();

      clearForm();

      Alert.alert(
        "Care site added",
        `${trimmedName} has been added successfully.`
      );
    } catch (error: any) {
      console.error("ADD CARE SITE ERROR:", error);

      Alert.alert(
        "Could not add care site",
        error?.message ?? "Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  if (checkingAccess) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>
          Checking Enterprise Admin access...
        </Text>
      </View>
    );
  }

  if (!isEnterpriseAdmin) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.deniedTitle}>Access restricted</Text>
        <Text style={styles.loadingText}>
          Enterprise Admin access is required.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable
        style={styles.backButton}
        onPress={() => router.back()}
      >
        <Ionicons name="arrow-back" size={24} color="#ffffff" />
        <Text style={styles.backButtonText}>Enterprise Menu</Text>
      </Pressable>

      <Text style={styles.title}>Manage Care Sites</Text>

      <Text style={styles.subtitle}>
        Add and administer the organisation&apos;s connected care
        locations.
      </Text>

      <View style={styles.formCard}>
        <Text style={styles.sectionTitle}>Add Care Site</Text>

        <Text style={styles.label}>Unique site code</Text>
        <TextInput
          value={siteCode}
          onChangeText={setSiteCode}
          placeholder="Example: site-4"
          placeholderTextColor="#64748b"
          autoCapitalize="none"
          style={styles.input}
        />

        <Text style={styles.label}>Site name</Text>
        <TextInput
          value={siteName}
          onChangeText={setSiteName}
          placeholder="Example: Futuristek North Care Home"
          placeholderTextColor="#64748b"
          style={styles.input}
        />

        <Text style={styles.label}>Town or city</Text>
        <TextInput
          value={location}
          onChangeText={setLocation}
          placeholder="Example: Leeds"
          placeholderTextColor="#64748b"
          style={styles.input}
        />

        <Text style={styles.label}>Contact email — optional</Text>
        <TextInput
          value={contactEmail}
          onChangeText={setContactEmail}
          placeholder="manager@example.com"
          placeholderTextColor="#64748b"
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
        />

        <Text style={styles.label}>Contact telephone — optional</Text>
        <TextInput
          value={contactPhone}
          onChangeText={setContactPhone}
          placeholder="Telephone number"
          placeholderTextColor="#64748b"
          keyboardType="phone-pad"
          style={styles.input}
        />

        <Pressable
          onPress={addCareSite}
          disabled={saving}
          style={[
            styles.addButton,
            saving && styles.disabledButton,
          ]}
        >
          <Ionicons
            name="business-outline"
            size={24}
            color="#ffffff"
          />

          <Text style={styles.addButtonText}>
            {saving ? "Adding Care Site..." : "Add Care Site"}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.sectionHeading}>
        Connected Care Sites ({sites.length})
      </Text>

      {loadingSites ? (
        <View style={styles.siteLoadingCard}>
          <ActivityIndicator size="small" />
          <Text style={styles.loadingText}>Loading care sites...</Text>
        </View>
      ) : sites.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No care sites found</Text>
          <Text style={styles.emptyText}>
            Add the organisation&apos;s first care site above.
          </Text>
        </View>
      ) : (
        sites.map((site) => (
          <View key={site.id} style={styles.siteCard}>
            <View style={styles.siteHeader}>
              <View style={styles.siteTitleContainer}>
                <Text style={styles.siteName}>{site.name}</Text>
                <Text style={styles.siteCode}>{site.code}</Text>
              </View>

              <View
                style={[
                  styles.statusBadge,
                  site.enabled
                    ? styles.activeBadge
                    : styles.disabledBadge,
                ]}
              >
                <Text style={styles.statusText}>
                  {site.enabled ? "ACTIVE" : "DISABLED"}
                </Text>
              </View>
            </View>

            <Text style={styles.siteDetail}>
              📍 {site.location}
            </Text>

            {site.contactEmail ? (
              <Text style={styles.siteDetail}>
                ✉️ {site.contactEmail}
              </Text>
            ) : null}

            {site.contactPhone ? (
              <Text style={styles.siteDetail}>
                ☎️ {site.contactPhone}
              </Text>
            ) : null}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#061b29",
  },
  content: {
    paddingTop: 60,
    paddingHorizontal: 28,
    paddingBottom: 80,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#061b29",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  loadingText: {
    color: "#cbd5e1",
    fontSize: 17,
    marginTop: 14,
    textAlign: "center",
  },
  deniedTitle: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "900",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginBottom: 24,
  },
  backButtonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
    marginLeft: 10,
  },
  title: {
    color: "#ffffff",
    fontSize: 44,
    fontWeight: "900",
  },
  subtitle: {
    color: "#93c5fd",
    fontSize: 19,
    lineHeight: 29,
    marginTop: 12,
    marginBottom: 28,
  },
  formCard: {
    backgroundColor: "#12324b",
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: "#2563eb",
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "900",
    marginBottom: 18,
  },
  label: {
    color: "#cbd5e1",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#071827",
    borderColor: "#475569",
    borderWidth: 1,
    borderRadius: 14,
    color: "#ffffff",
    fontSize: 17,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  addButton: {
    backgroundColor: "#2563eb",
    borderRadius: 16,
    paddingVertical: 17,
    marginTop: 24,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  disabledButton: {
    opacity: 0.55,
  },
  addButtonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
    marginLeft: 10,
  },
  sectionHeading: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "900",
    marginTop: 38,
    marginBottom: 18,
  },
  siteLoadingCard: {
    backgroundColor: "#12324b",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
  },
  emptyCard: {
    backgroundColor: "#12324b",
    borderRadius: 20,
    padding: 24,
  },
  emptyTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
  },
  emptyText: {
    color: "#cbd5e1",
    fontSize: 17,
    lineHeight: 26,
    marginTop: 8,
  },
  siteCard: {
    backgroundColor: "#0d2639",
    borderRadius: 22,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#22c55e",
  },
  siteHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  siteTitleContainer: {
    flex: 1,
    paddingRight: 12,
  },
  siteName: {
    color: "#ffffff",
    fontSize: 23,
    fontWeight: "900",
  },
  siteCode: {
    color: "#93c5fd",
    fontSize: 15,
    marginTop: 5,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  activeBadge: {
    backgroundColor: "#14532d",
  },
  disabledBadge: {
    backgroundColor: "#7f1d1d",
  },
  statusText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
  },
  siteDetail: {
    color: "#cbd5e1",
    fontSize: 17,
    marginTop: 12,
  },
});