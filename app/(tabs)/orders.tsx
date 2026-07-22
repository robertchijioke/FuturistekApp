import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { auth, db } from "../../lib/firebase";




export default function OrdersScreen() {
  const [user, setUser] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const router = useRouter();

useEffect(() => {
  const currentUser = auth.currentUser;
  setUser(currentUser);

  const loadOrders = async () => {
    if (!currentUser) {
      setOrders([]);
      setLoading(false);
      return;
    }

    try {
      const q = query(
        collection(db, "orders"),
        where("userId", "==", currentUser.uid),
        orderBy("createdAt", "desc")
      );

      const snap = await getDocs(q);

      const results = snap.docs.map((doc) => {
        const data = doc.data() as any;

        let createdAtMs = 0;

        if (data?.createdAt?.seconds) {
          createdAtMs = data.createdAt.seconds * 1000;
        } else if (typeof data?.createdAt === "string") {
          createdAtMs = new Date(data.createdAt).getTime() || 0;
        } else if (typeof data?.createdAt?.toDate === "function") {
          createdAtMs = data.createdAt.toDate().getTime();
        }

        return {
          id: doc.id,
          ...data,
          createdAtMs,
        };
      });

      results.sort((a: any, b: any) => b.createdAtMs - a.createdAtMs);

      console.log(
        "SORTED ORDER LIST:",
        results.map((o: any) => ({
          orderNumber: o.orderNumber,
          createdAt: o.createdAt,
          createdAtMs: o.createdAtMs,
        }))
      );

      setOrders(results);
    } catch (error) {
      console.log("loadOrders error:", error);
    } finally {
      setLoading(false);
    }
  };

  loadOrders();
}, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (!currentUser) {
        setOrders([]);
        setLoading(false);
        return;
      }

      try {
       const q = query(
        collection(db, "orders"),
        where("userId", "==", currentUser.uid)
      );

        const snap = await getDocs(q);

        const results = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        results.sort((a: any, b: any) => {
          const aNum = Number(String(a.orderNumber || "").replace("FUT-", ""));
          const bNum = Number(String(b.orderNumber || "").replace("FUT-", ""));
          return bNum - aNum;
        });

        setOrders(results);
      } catch (error) {
        console.log("loadOrders error:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

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
          onPress={() => router.push("/login?redirectTo=/orders")}
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
