import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { db } from "../../../lib/firebase";
import { sendPushNotification } from "../../../lib/sendPush";
import type { OrderStatus } from "../../../lib/types";





type Order = {
  userId?: string;
  id: string;
  orderNumber?: string;
  email?: string;

  status: OrderStatus;
  createdAt?: any;

  total?: number;
  subtotal?: number;
  delivery?: number; 

  fullName?: string;
  phone?: string;
  address?: string;

  deliveryDetails?: {
    name?: string;
    phone?: string;
    address?: string;
  };

  items?: {
    id?: string;
    name?: string;
    price?: number;
    quantity?: number;
    image?: string;
  }[];
  
  paid?: boolean;
  paymentStatus?: string;
  paymentMethod?: string;
  paidAt?: string;
};


function formatDateTime(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}


function formatGBP(value: any) {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  return `£${safe.toFixed(2)}`;
}

export default function OrderDetailsScreen() {
  const DOT = 12;
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  function getDisplayOrderNumber(order: any) {
  return (
    String(order?.orderNumber ?? "").trim() ||
    `Order #${String(order?.id ?? "").slice(0, 8).toUpperCase()}`
  );
}

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminMode, setAdminMode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paid = order?.paid === true || order?.paymentStatus === "paid";
  const paymentMethod = order?.paymentMethod || "N/A";
  const paidAt = order?.paidAt || "";

  useEffect(() => {
      const checkAdmin = async () => {
    try {
      const docRef = doc(db, "users", "admin");
      const snap = await getDoc(docRef);

      if (snap.exists()) {
        const data = snap.data();

        if (
          data.role === "admin" &&
          data.email === "robertchijiokeogo@gmail.com"
        ) {
          setAdminMode(true);
        }
      }
    } catch (e) {
      console.log("Admin check error", e);
    }
  };

  checkAdmin();
}, []);

const handleUpdateStatus = async (nextStatus: OrderStatus) => {
  if (!order?.id) return;

  try {
    const orderRef = doc(db, "orders", order.id);

    await updateDoc(orderRef, {
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    });

    setOrder((prev) =>
      prev
        ? {
            ...prev,
            status: nextStatus,
          }
        : prev
    );

    if (order.userId) {
      const userRef = doc(db, "users", order.userId);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        const expoPushToken = userData?.expoPushToken;

        if (expoPushToken) {
          await sendPushNotification(
            expoPushToken,
            "Order Update",
            `Your order ${order.orderNumber ?? order.id} is now ${nextStatus}.`,
            {
              orderId: order.id,
              orderNumber: order.orderNumber ?? "",
              status: nextStatus,
            }
          );
        } else {
          console.log("No expoPushToken found for user");
        }
      }
    }
  } catch (error) {
    console.log("handleUpdateStatus error:", error);
    Alert.alert("Error", "Failed to update order status.");
  }
};

type OrderStatus =  "PLACED" | "PROCESSING" | "SHIPPED" | "DELIVERED";

const steps: { key: OrderStatus; label: string }[] = [
  { key: "PLACED", label: "Placed" },
  { key: "PROCESSING", label: "Processing" },
  { key: "SHIPPED", label: "Shipped" },
  { key: "DELIVERED", label: "Delivered" },
] as const;

const orderStatus = order?.status as OrderStatus | undefined;

function formatOrderDate(timestamp: any) {
  if (!timestamp) return "No date";

  try {
    if (timestamp.toDate) {
      return timestamp.toDate().toLocaleString();
    }

    if (timestamp.seconds) {
      return new Date(timestamp.seconds * 1000).toLocaleString();
    }

    return "No date";
  } catch {
    return "No date";
  }
}

  const currentIndex = steps.findIndex((s) => s.key === orderStatus);

 useEffect(() => {
  if (!id) return;

  const orderRef = doc(db, "orders", String(id));

  const unsubscribe = onSnapshot(
    orderRef,
    (snap) => {
      if (!snap.exists()) {
        setError("Order not found.");
        setOrder(null);
        setLoading(false);
        return;
      }

    const data = snap.data() as Order;
    const { id: _ignoredId, ...rest } = data;

    setOrder({
      ...rest,
      id: snap.id,
    });
    setError(null);
    setLoading(false);
    },
    (err) => {
      console.log("Order listener error:", err);
      setError("Failed to load order.");
      setLoading(false);
    }
  );

  return unsubscribe;
}, [id]);

  if (loading) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: "white", fontSize: 18 }}>Loading order...</Text>
      </View>
    </SafeAreaView>
  );
}

  if (!order) {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Order Details</Text>
      <Text style={styles.small}>Order not found (or you don’t have access).</Text>
    </SafeAreaView>
  );
}

  if (!order) {
    return (
      <SafeAreaView edges={["top"]} style={styles.container}>
        <View style={{ padding: 16 }}>
          <Text style={styles.title}>Order Details</Text>
          <Text style={styles.muted}>Order not found.</Text>

          <Text onPress={() => router.back()} style={styles.link}>
            ← Back
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  function getOrderTotal(order: any) {
  const itemsTotal = (order?.items ?? []).reduce((sum: number, it: any) => {
    const price = Number(it?.price ?? 0);
    const qty = Number(it?.qty ?? it?.quantity ?? 1);
    return sum + price * qty;
  }, 0);

  const deliveryFee = Number(
    order?.deliveryFee ?? order?.delivery ?? order?.shippingFee ?? 0
  );

  return itemsTotal + deliveryFee;
}

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Order Details</Text>

        <View style={styles.card}>

          <View style={styles.row}>
           <Text style={styles.orderId}>
            {getDisplayOrderNumber(order)}
          </Text>
          <Text style={styles.total}>{formatGBP(getOrderTotal(order))}</Text>
        </View>

          <Text style={styles.dateText}>
          {formatDateTime(order?.createdAt?.toDate ? order.createdAt.toDate().toISOString() : order?.createdAt)}
          </Text>

          <View style={{ height: 10 }} />

          <View style={styles.badgeRow}>
            
            <Text style={styles.small}>{order?.items?.length ?? 0} item(s)</Text>
          </View>
        </View>

        <View style={{ marginTop: 20, marginBottom: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {steps.map((st, i) => {
              const done = i < currentIndex;
              const isCurrent = i === currentIndex;

              return (
                <React.Fragment key={st.key}>
                  {/* Step */}
                  <View style={{ flex: 1, alignItems: "center" }}>
                    <View
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 7,
                        backgroundColor: done
                          ? "#22c55e"
                          : isCurrent
                          ? "#3b82f6"
                          : "#334155",
                      }}
                    />

                    <Text
                      numberOfLines={1}
                      style={{
                        marginTop: 8,
                        fontSize: 12,
                        textAlign: "center",
                        color: isCurrent ? "#fff" : "#94a3b8",
                        fontWeight: isCurrent ? "700" : "500",
                      }}
                    >
                      {st.label}
                    </Text>
                  </View>

                  {/* Line */}
                  {i !== steps.length - 1 && (
                    <View
                      style={{
                        flex: 1,
                        height: 2,
                        backgroundColor: done ? "#22c55e" : "#334155",
                      }}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </View>
        </View>

    {/* Delivery */}
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Delivery</Text>

      {(() => {
        const name =
          order?.fullName ??
          order?.deliveryDetails?.name ??
          "";

        const phone =
          order?.phone ??
          order?.deliveryDetails?.phone ??
          "";

        const address =
          order?.address ??
          order?.deliveryDetails?.address ??
          "";

        const hasAny = !!(name || phone || address);

        if (!hasAny) {
          return (
            <Text style={styles.muted}>
              No delivery details saved for this order.
            </Text>
          );
        }

        return (
          <>
            {!!name && <Text style={styles.smallStrong}>{name}</Text>}
            {!!phone && <Text style={styles.small}>{phone}</Text>}
            {!!address && <Text style={styles.small}>{address}</Text>}
          </>
        );
      })()}
    </View>

    {/* Payment */}
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Payment</Text>

      <Text style={styles.detailLine}>
        Status:{" "}
        <Text style={{ color: paid ? "#4ade80" : "#f87171", fontWeight: "700" }}>
          {paid ? "PAID" : "UNPAID"}
        </Text>
      </Text>

      <Text style={styles.detailLine}>
        Method:{" "}
        {paymentMethod
          ? paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)
          : "N/A"}
      </Text>

      {!!paidAt && (
        <Text style={styles.detailLine}>
          Paid at: {formatDateTime(paidAt)}
        </Text>
      )}
    </View>




    {/* Update Status */}
    <View style={styles.card}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={styles.sectionTitle}>Update Status</Text>

        {__DEV__ && (
          <Pressable onPress={() => setAdminMode(v => !v)}>
            <Text style={{ color: adminMode ? "#22c55e" : "#94a3b8" }}>
              {`Admin: ${adminMode ? "ON" : "OFF"}`}
            </Text>
          </Pressable>
        )}
      </View>
 

    {adminMode && (
      <View style={{ marginTop: 16 }}>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 10, marginTop: 10 }}
        >
          {steps.map((st) => {
            const selected = orderStatus === st.key;

            return (
              <Pressable
                key={st.key}
                onPress={() => handleUpdateStatus(st.key as any)}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  borderRadius: 20,
                  backgroundColor: selected ? "#3b82f6" : "#1e293b",
                  borderWidth: 1,
                  borderColor: selected ? "#3b82f6" : "#334155",
                }}
              >
                <Text
                  style={{
                    color: selected ? "#fff" : "#cbd5e1",
                    fontWeight: "600",
                  }}
                >
                  {st.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    )}
    </View>

       <View style={styles.card}>
        <Text style={styles.sectionTitle}>Items</Text>


        {order?.items?.map((it) => (
        <View key={it.id ?? it.name ?? Math.random()} style={styles.itemRow}>

      {it.image ? (
        <Image
          source={
            typeof it.image === "string"
              ? { uri: it.image }
              : require("../../../assets/images/icon.png")
          }
          style={styles.itemImage}
        />
      ) : (
        <View style={[styles.itemImage, styles.imagePlaceholder]} />
      )}

      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.itemName}>
          {it.name ?? "Unnamed item"}
        </Text>

        <Text style={styles.smallMuted}>
          {formatGBP(it.price ?? 0)} x {it.quantity ?? 1}
        </Text>
      </View>

      <Text style={styles.itemTotal}>
        {formatGBP((it.price ?? 0) * (it.quantity ?? 1))}
      </Text>

      </View>
            
        ))}
        </View>

          
    {/* Totals */}
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Totals</Text>

      {(() => {

        const subtotal = (order?.items ?? []).reduce((sum: number, it: any) => {
        const price = Number(it?.price ?? 0);
        const qty = Number(it?.qty ?? it?.quantity ?? 1);
        return sum + price * qty;
        }, 0);

        const delivery = Number(order?.delivery ?? order?.delivery ?? order?? 0);
        const total = subtotal + delivery;



        return (
          <>
            <View style={styles.totalsRow}>
              <Text style={styles.small}>Subtotal</Text>
              <Text style={styles.smallStrong}>
                {formatGBP(subtotal)}
              </Text>
            </View>

            <View style={styles.totalsRow}>
              <Text style={styles.small}>Delivery</Text>
              <Text style={styles.smallStrong}>
                {formatGBP(delivery)}
              </Text>
            </View>

            <View style={[styles.totalsRow, { marginTop: 8 }]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>
                {formatGBP(total)}
              </Text>
            </View>
          </>
        );
      })()}
    </View>


        <Text onPress={() => router.back()} style={styles.link}>
          ← Back to Orders
        </Text>

        <View style={{ height: 18 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#071726" 
  },

  content: { 
    padding: 16, 
    paddingBottom: 28 
  },

  title: { 
    fontSize: 34, 
    fontWeight: "800", 
    color: "#fff", 
    marginBottom: 14 
  },

  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    overflow: "hidden",
  },

  row: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center" 
  },

  orderId: { 
    color: "#fff", 
    fontWeight: "800", 
    fontSize: 16 
  },

  total: { 
   color: "#fff", 
   fontWeight: "800", 
   fontSize: 18 
  },

  sectionTitle: { 
   color: "#fff", 
   fontWeight: "800", 
   fontSize: 16, 
   marginBottom: 10 },

  muted: { 
   color: "rgba(255,255,255,0.65)", 
   marginTop: 8, 
  },
  small: { 
   color: "rgba(255,255,255,0.65)", 
   marginTop: 4, 
  },
  smallMuted: {
  fontSize: 14,
  color: "#D1D5DB",
  opacity: 0.7,
  marginTop: 8,
 },

 dateText: {
  fontSize: 14,
  marginTop: 6,
  color: "white",
  opacity: 0.85,
 },
 smallStrong: { 
  color: "rgba(255,255,255,0.9)", 
  fontWeight: "700", 
  marginTop: 4, 
},

  badgeRow: { 
   flexDirection: "row", 
   justifyContent: "space-between", 
   alignItems: "center", 
  },

  badge: {
   paddingHorizontal: 10,
   paddingVertical: 6,
   borderRadius: 999,
   backgroundColor: "rgba(46,107,213,0.25)",
   borderWidth: 1,
   borderColor: "rgba(46,107,213,0.5)",
  },

  badgeText: { 
   color: "#fff", 
   fontWeight: "800", 
   fontSize: 12, 
  },

  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  itemImage: { width: 46, height: 46, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.08)" },
  imagePlaceholder: { borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  itemTitle: { color: "#fff", fontWeight: "800" },
  itemLineTotal: { color: "#fff", fontWeight: "800" },

  totalsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
  totalLabel: { color: "#fff", fontWeight: "900", fontSize: 16 },
  totalValue: { color: "#fff", fontWeight: "900", fontSize: 16 },

  link: { color: "rgba(255,255,255,0.75)", marginTop: 8, fontWeight: "700" },

  statusBtn: {
  marginTop: 10,
  paddingVertical: 12,
  paddingHorizontal: 14,
  borderRadius: 12,
  backgroundColor: "rgba(255,255,255,0.08)",
},
  statusBtnText: {
  color: "#fff",
  fontWeight: "700",
},

itemName: {
  color: "#F9FAFB",
  fontSize: 15,
  fontWeight: "600",
},

itemTotal: {
  color: "#fff",
  fontSize: 15,
  fontWeight: "700",
},

detailLine: {
  color: "#fff",
  fontSize: 15,
  marginTop: 8,
},

});
