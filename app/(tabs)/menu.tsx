import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import {
  doc,
  getDoc,
} from "firebase/firestore";
import type { ComponentProps } from "react";
import {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  stopAutomationEngine,
} from "../../lib/automationEngine";
import { auth, db } from "../../lib/firebase";


type MenuMode =
  | "checking"
  | "signedOut"
  | "customer"
  | "siteManager"
  | "enterpriseAdmin"
  | "error";

type MenuIconName =
  ComponentProps<typeof Ionicons>["name"];

type MenuCardProps = {
  title: string;
  icon: MenuIconName;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
};

function MenuCard({
  title,
  icon,
  onPress,
  danger = false,
  disabled = false,
}: MenuCardProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.card,
        danger && styles.dangerCard,
        disabled && styles.disabledCard,
        pressed && !disabled && styles.cardPressed,
      ]}
    >
      <Ionicons
        name={icon}
        size={32}
        color={danger ? "#fca5a5" : "#7cc8ff"}
      />

      <Text
        style={[
          styles.cardText,
          danger && styles.dangerText,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

export default function MenuScreen() {
  const router = useRouter();

  const menuScrollRef =
    useRef<ScrollView>(null);

  const [menuMode, setMenuMode] =
    useState<MenuMode>("checking");

  const [signingOut, setSigningOut] =
    useState(false);

  useEffect(() => {
    let checkVersion = 0;

    const unsubscribeAuth = onAuthStateChanged(
      auth,
      (user) => {
        checkVersion += 1;

        setSigningOut(false);

        menuScrollRef.current?.scrollTo({
          y: 0,
          animated: false,
        });

        const currentVersion = checkVersion;

        if (!user) {
          setMenuMode("signedOut");
          return;
        }

        setMenuMode("checking");

        void (async () => {
          try {
            const accessProfileSnapshot =
              await getDoc(
                doc(
                  db,
                  "userAccessProfiles",
                  user.uid
                )
              );

            if (currentVersion !== checkVersion) {
              return;
            }

            if (!accessProfileSnapshot.exists()) {
              setMenuMode("customer");
              return;
            }

            const accessData =
              accessProfileSnapshot.data();

            const role = String(
              accessData.role ?? ""
            )
              .trim()
              .toUpperCase();

            const enabled =
              accessData.enabled === true;

            if (
              enabled &&
              role === "SITE_MANAGER"
            ) {
              setMenuMode("siteManager");
              return;
            }

            if (
              enabled &&
              role === "ENTERPRISE_ADMIN"
            ) {
              setMenuMode("enterpriseAdmin");
              return;
            }

            setMenuMode("customer");
          } catch (error) {
            console.error(
              "MENU ACCESS CHECK ERROR:",
              error
            );

            if (currentVersion === checkVersion) {
              setMenuMode("error");
            }
          }
        })();
      },
      (error) => {
        console.error(
          "MENU AUTH STATE ERROR:",
          error
        );

        setMenuMode("error");
      }
    );

    return () => {
      checkVersion += 1;
      unsubscribeAuth();
    };
  }, []);

  const onMenuSignOut = async () => {
    if (signingOut) {
      return;
    }

    setSigningOut(true);

    try {
      stopAutomationEngine();

      router.replace("/(tabs)/home" as any);

      await new Promise<void>((resolve) => {
        setTimeout(resolve, 350);
      });

      await signOut(auth);

      setMenuMode("signedOut");
      console.log("MENU SIGN OUT SUCCESS");
    } catch (error: any) {
      console.error("MENU SIGN OUT ERROR:", error);
    } finally {
      setSigningOut(false);
    }
  };
  

  if (menuMode === "checking") {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.statusTitle}>
          Checking account access...
        </Text>

        <Text style={styles.statusText}>
          Preparing the correct menu for your account.
        </Text>
      </View>
    );
  }

  if (menuMode === "error") {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.statusTitle}>
          Unable to load Menu
        </Text>

        <Text style={styles.statusText}>
          Your account permissions could not be
          verified. Reload the screen and try again.
        </Text>
      </View>
    );
  }

  const isSiteManager =
    menuMode === "siteManager";

  const isEnterpriseAdmin =
    menuMode === "enterpriseAdmin";

  const isStaff =
    isSiteManager || isEnterpriseAdmin;

  return (
    <ScrollView
      ref={menuScrollRef}
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>
        {isSiteManager
          ? "Staff Menu"
          : isEnterpriseAdmin
            ? "Enterprise Menu"
            : "Menu"}
      </Text>

      {isStaff && (
        <Text style={styles.subtitle}>
          {isSiteManager
            ? "Site Manager • assigned-site care access"
            : "Enterprise Admin • full operational access"}
        </Text>
      )}

      {isStaff ? (
        <>
          <MenuCard
            title="Mission Control"
            icon="earth-outline"
            onPress={() =>
              router.push(
                "/mission-control" as any
              )
            }
          />

          {isEnterpriseAdmin && (
            <MenuCard
              title="Global Incident Operations"
              icon="warning-outline"
              onPress={() =>
                router.push(
                  "/global-incident-operations" as any
                )
              }
            />
          )}

          {isEnterpriseAdmin && (
            <MenuCard
              title="Manage Care Sites"
              icon="business-outline"
              onPress={() =>
                router.push("/manage-care-sites" as any)
              }
            />
          )}

          <MenuCard
            title="Staff Profile"
            icon="person-circle-outline"
            onPress={() =>
              router.push("/profile" as any)
            }
          />

          {isEnterpriseAdmin && (
            <>
              <MenuCard
                title="Orders"
                icon="receipt-outline"
                onPress={() =>
                  router.push("/orders" as any)
                }
              />

              <MenuCard
                title="My Designs"
                icon="images-outline"
                onPress={() =>
                  router.push(
                    "/my-designs" as any
                  )
                }
              />
            </>
          )}

          <MenuCard
            title={
              signingOut
                ? "Signing out..."
                : "Sign Out"
            }
            icon="log-out-outline"
            onPress={onMenuSignOut}
            danger
            disabled={signingOut}
          />
        </>
      ) : (
        <>
          <MenuCard
            title="Orders"
            icon="receipt-outline"
            onPress={() =>
              router.push("/orders" as any)
            }
          />

          <MenuCard
            title={
              menuMode === "signedOut"
                ? "Sign In / Profile"
                : "Profile"
            }
            icon="person-outline"
            onPress={() =>
              router.push("/profile" as any)
            }
          />

          <MenuCard
            title="My Designs"
            icon="images-outline"
            onPress={() =>
              router.push("/my-designs" as any)
            }
          />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#071827",
  },

  centeredContainer: {
    flex: 1,
    backgroundColor: "#071827",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },

  title: {
    color: "#ffffff",
    fontSize: 42,
    fontWeight: "900",
    marginBottom: 8,
  },

  subtitle: {
    color: "#93c5fd",
    fontSize: 17,
    lineHeight: 25,
    marginBottom: 24,
  },

  card: {
    minHeight: 136,
    backgroundColor: "#102b40",
    borderRadius: 26,
    paddingHorizontal: 34,
    marginBottom: 28,
    flexDirection: "row",
    alignItems: "center",
  },

  dangerCard: {
    backgroundColor: "#3f1d26",
    borderColor: "#ef4444",
    borderWidth: 1,
  },

  disabledCard: {
    opacity: 0.55,
  },

  cardPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.99 }],
  },

  cardText: {
    color: "#ffffff",
    fontSize: 27,
    fontWeight: "900",
    marginLeft: 24,
    flexShrink: 1,
  },

  dangerText: {
    color: "#fecaca",
  },

  statusTitle: {
    color: "#ffffff",
    fontSize: 27,
    fontWeight: "900",
    textAlign: "center",
  },

  statusText: {
    color: "#cbd5e1",
    fontSize: 18,
    lineHeight: 28,
    textAlign: "center",
    marginTop: 16,
  },

  content: {
    paddingTop: 70,
    paddingHorizontal: 28,
    paddingBottom: 150,
  },
});