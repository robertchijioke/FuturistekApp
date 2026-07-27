import {
  Redirect,
  useRouter,
} from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { auth, db } from "../../lib/firebase";


type OrdersAccessState =
  | "checking"
  | "signedOut"
  | "allowed"
  | "redirecting"
  | "restricted"
  | "error";

export default function OrdersScreen() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersAccessState, setOrdersAccessState] =
   useState<OrdersAccessState>("checking");

  

useEffect(() => {
  let cancelled = false;
  let authVersion = 0;

  const unsubscribeAuth = onAuthStateChanged(
    auth,
    (currentUser) => {
      authVersion += 1;

      const currentAuthVersion = authVersion;

      setUser(currentUser);
      setOrders([]);
      setLoading(true);

      if (!currentUser) {
        setOrdersAccessState("signedOut");
        setLoading(false);
        return;
      }

      setOrdersAccessState("checking");

      void (async () => {
        try {
          const accessProfileSnapshot =
            await getDoc(
              doc(
                db,
                "userAccessProfiles",
                currentUser.uid
              )
            );

          if (
            cancelled ||
            currentAuthVersion !== authVersion ||
            auth.currentUser?.uid !== currentUser.uid
          ) {
            return;
          }

          if (accessProfileSnapshot.exists()) {
            const accessData =
              accessProfileSnapshot.data();

            const role = String(
              accessData.role ?? ""
            )
              .trim()
              .toUpperCase();

            const enabled =
              accessData.enabled === true;

            if (role === "SITE_MANAGER") {
              setOrders([]);
              setOrdersAccessState("redirecting");
              setLoading(false);
              return;
            }

            if (
              (
                role === "ENTERPRISE_ADMIN" ||
                role === "SITE_MANAGER"
              ) &&
              !enabled
            ) {
              setOrdersAccessState("restricted");
              setLoading(false);
              return;
            }
          }

          const ordersQuery = query(
            collection(db, "orders"),
            where(
              "userId",
              "==",
              currentUser.uid
            ),
            orderBy("createdAt", "desc")
          );

          const snapshot =
            await getDocs(ordersQuery);

          if (
            cancelled ||
            currentAuthVersion !== authVersion ||
            auth.currentUser?.uid !== currentUser.uid
          ) {
            return;
          }

          const results = snapshot.docs.map(
            (document) => {
              const data =
                document.data() as any;

              const createdAt =
                data.createdAt;

              let createdAtMs = 0;

              if (
                typeof createdAt?.toMillis ===
                "function"
              ) {
                createdAtMs =
                  createdAt.toMillis();
              } else if (
                typeof createdAt?.toDate ===
                "function"
              ) {
                createdAtMs =
                  createdAt
                    .toDate()
                    .getTime();
              } else if (
                typeof createdAt?.seconds ===
                "number"
              ) {
                createdAtMs =
                  createdAt.seconds * 1000;
              } else if (
                typeof createdAt === "string" ||
                typeof createdAt === "number"
              ) {
                const parsedTimestamp =
                  new Date(
                    createdAt
                  ).getTime();

                createdAtMs =
                  Number.isNaN(
                    parsedTimestamp
                  )
                    ? 0
                    : parsedTimestamp;
              }

              return {
                id: document.id,
                ...data,
                createdAtMs,
              };
            }
          );

          results.sort(
            (firstOrder: any, secondOrder: any) =>
              secondOrder.createdAtMs -
              firstOrder.createdAtMs
          );

          setOrders(results);
          setOrdersAccessState("allowed");

          console.log(
            "ORDERS LOADED FOR ACCOUNT:",
            {
              uid: currentUser.uid,
              count: results.length,
            }
          );
        } catch (error) {
          console.error(
            "ORDERS LOAD ERROR:",
            error
          );

          if (
            !cancelled &&
            currentAuthVersion === authVersion
          ) {
            setOrders([]);
            setOrdersAccessState("error");
          }
        } finally {
          if (
            !cancelled &&
            currentAuthVersion === authVersion
          ) {
            setLoading(false);
          }
        }
      })();
    },
    (error) => {
      console.error(
        "ORDERS AUTH STATE ERROR:",
        error
      );

      if (!cancelled) {
        setUser(null);
        setOrders([]);
        setOrdersAccessState("error");
        setLoading(false);
      }
    }
  );

  return () => {
    cancelled = true;
    authVersion += 1;
    unsubscribeAuth();
  };
}, [router]);

if (ordersAccessState === "redirecting") {
  return (
    <Redirect href="/mission-control" />
  );
}

if (ordersAccessState === "checking") {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#020817",
        alignItems: "center",
        justifyContent: "center",
        padding: 28,
      }}
    >
      <Text
        style={{
          color: "#ffffff",
          fontSize: 25,
          fontWeight: "900",
          textAlign: "center",
        }}
      >
        Checking order access...
      </Text>
    </View>
  );
}

if (ordersAccessState === "restricted") {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#020817",
        alignItems: "center",
        justifyContent: "center",
        padding: 28,
      }}
    >
      <Text
        style={{
          color: "#f87171",
          fontSize: 28,
          fontWeight: "900",
          textAlign: "center",
        }}
      >
        🔒 Account Access Restricted
      </Text>

      <Text
        style={{
          color: "#cbd5e1",
          fontSize: 18,
          lineHeight: 28,
          textAlign: "center",
          marginTop: 18,
        }}
      >
        This staff access profile is not currently
        enabled.
      </Text>
    </View>
  );
}

if (ordersAccessState === "error") {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#020817",
        alignItems: "center",
        justifyContent: "center",
        padding: 28,
      }}
    >
      <Text
        style={{
          color: "#ffffff",
          fontSize: 27,
          fontWeight: "900",
          textAlign: "center",
        }}
      >
        Unable to load Orders
      </Text>

      <Text
        style={{
          color: "#cbd5e1",
          fontSize: 18,
          lineHeight: 28,
          textAlign: "center",
          marginTop: 16,
        }}
      >
        Your account access or order records could not
        be verified.
      </Text>
    </View>
  );
}

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
            fontSize: 28,
            fontWeight: "800",
            marginBottom: 16,
            textAlign: "center",
          }}
        >
          Sign in to view your orders
        </Text>

        <Text
          style={{
            color: "#cbd5e1",
            fontSize: 16,
            textAlign: "center",
            marginBottom: 28,
            lineHeight: 24,
          }}
        >
          Track purchases, check delivery updates, and manage past orders.
        </Text>

        <Pressable
          onPress={() =>
            router.push({
              pathname: "/(auth)/login",
              params: {
                redirectTo: "/orders",
              },
            } as any)
          }
          style={{
            backgroundColor: "#60a5fa",
            paddingVertical: 14,
            paddingHorizontal: 32,
            borderRadius: 14,
          }}
        >
          <Text style={{ color: "white", fontSize: 18, fontWeight: "700" }}>
            Sign In
          </Text>
        </Pressable>
      </View>
    );
  }

  if (user && orders.length === 0) {
  return (
    <View style={{ flex: 1, backgroundColor: "#020817", padding: 24 }}>
      <Text style={{ color: "white", fontSize: 28, fontWeight: "800", marginTop: 40 }}>
        My Orders
      </Text>
      <Text style={{ color: "#cbd5e1", fontSize: 16, marginTop: 20 }}>
        No orders yet.
      </Text>
    </View>
  );
}

  if (loading) {
  return (
    <View style={{ flex: 1, backgroundColor: "#020817", justifyContent: "center", alignItems: "center" }}>
      <Text style={{ color: "white" }}>Loading orders...</Text>
    </View>
  );
}

  const formatCreatedAt = (createdAt: any) => {
    if (!createdAt?.seconds) return "Just now";

    const date = new Date(createdAt.seconds * 1000);

    return date.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

return (
  <ScrollView
    style={{ flex: 1, backgroundColor: "#020817" }}
    contentContainerStyle={{ padding: 24, paddingBottom: 120 }}
  >
    <Text
      style={{
        color: "white",
        fontSize: 28,
        fontWeight: "800",
        marginBottom: 20,
      }}
    >
      My Orders
    </Text>

    {!user ? (
      <View style={{ marginTop: 80 }}>
        <Text
          style={{
            color: "white",
            fontSize: 22,
            fontWeight: "800",
            marginBottom: 12,
            textAlign: "center",
          }}
        >
          Sign in to view your orders
        </Text>

        <Text
          style={{
            color: "#cbd5e1",
            fontSize: 16,
            textAlign: "center",
            lineHeight: 24,
            marginBottom: 24,
          }}
        >
          Track purchases, check delivery updates, and manage past orders.
        </Text>
      </View>
    ) : orders.length === 0 ? (
      <Text
        style={{
          color: "#cbd5e1",
          fontSize: 16,
          marginTop: 20,
        }}
      >
        You have no orders yet.
      </Text>
    ) : (
      orders.map((order) => (
        <Pressable
          key={order.id}
       onPress={() =>
      router.push({
        pathname: "/orders/[id]",
        params: { id: String(order.id) },
      })
    }
          style={{
            backgroundColor: "#0f172a",
            borderRadius: 24,
            padding: 20,
            marginBottom: 18,
            borderWidth: 1,
            borderColor: "#1e293b",
          }}
        >
          <Text
            style={{
              color: "white",
              fontSize: 20,
              fontWeight: "800",
              marginBottom: 12,
            }}
          >
            {order.orderNumber || "Order"}
          </Text>

          <Text
            style={{
              color: "#cbd5e1",
              fontSize: 16,
              marginBottom: 8,
            }}
          >
            Status: {String(order.fulfillmentStatus || order.status || "PLACED").toUpperCase()}
          </Text>

          <Text
            style={{
              color: "#cbd5e1",
              fontSize: 16,
              marginBottom: 8,
            }}
          >
            Total: £{Number(order.totalPrice ?? order.total ?? 0).toFixed(2)}
          </Text>

          <Text
            style={{
              color: "#cbd5e1",
              fontSize: 16,
              marginBottom: 8,
            }}
          >
            Items: {order.totalItems ?? order.items?.length ?? 0}
          </Text>

          <Text
            style={{
              color: "#94a3b8",
              fontSize: 14,
            }}
          >
            Created: {formatCreatedAt(order.createdAt)}
          </Text>
        </Pressable>
      ))
    )}
  </ScrollView>
);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#071726", padding: 16, paddingTop: 24 },
  title: { fontSize: 34, fontWeight: "800", color: "#fff", marginBottom: 10 },
  muted: { color: "rgba(255,255,255,0.6)", marginTop: 8 },
  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },
  row:
  { flexDirection: "row",
    justifyContent: "space-between" },
  orderId: { color: "#fff", fontWeight: "800", fontSize: 16 },
  total: { color: "#fff", fontWeight: "800", fontSize: 16 },
  small: { color: "rgba(255,255,255,0.65)", marginTop: 4 },

});
