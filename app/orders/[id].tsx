import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { auth, db } from "../../lib/firebase";

type OrderItem = {
  id?: string;
  productId?: string;
  title?: string;
  name?: string;
  productName?: string;
  image?: string | number;
  price?: number | string;
  unitPrice?: number | string;
  qty?: number | string;
  quantity?: number | string;
};

type OrderDoc = {
  id: string;
  orderNumber?: string;
  status?: string;
  trackingUrl?: string;
  fulfillmentStatus?: string;
  createdAt?: any;
  subtotal?: number | string;
  totalPrice?: number | string;
  total?: number | string;
  delivery?: number | string | Record<string, any>;
  deliveryFee?: number | string;
  shippingFee?: number | string;
  paid?: boolean;
  paymentStatus?: string;
  paymentMethod?: string;
  paidAt?: string;
  fullName?: string;
  customerName?: string;
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  items?: OrderItem[];
  city?: string;
  postcode?: string;
  addressLine1?: string;
};

function toNumber(value: any) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toDateSafe(value: any): Date | null {
  if (!value) return null;

  if (typeof value?.toDate === "function") {
    try {
      return value.toDate();
    } catch {
      return null;
    }
  }

  if (value instanceof Date) return value;

  if (typeof value === "number" && Number.isFinite(value)) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (typeof value === "string") {
    const s = value.trim();

    if (/^\d+$/.test(s)) {
      const d = new Date(Number(s));
      return Number.isNaN(d.getTime()) ? null : d;
    }

    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (typeof value?.seconds === "number") {
    const ms =
      value.seconds * 1000 + Math.floor((value.nanoseconds ?? 0) / 1e6);
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
}

function formatDate(value: any) {
  const d = toDateSafe(value);
  if (!d) return "—";

  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatGBP(value: any) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(toNumber(value));
}

function normalizeStatus(status: any) {
  const s = String(status ?? "").trim().toUpperCase();
  if (!s) return "PLACED";
  return s;
}

function getDisplayOrderNumber(order: OrderDoc) {
  if (order.orderNumber) return String(order.orderNumber);
  if (order.id) return `Order #${String(order.id).slice(0, 8).toUpperCase()}`;
  return "Order";
}

function getItemsCount(order: OrderDoc) {
  if (!Array.isArray(order.items)) return 0;

  return order.items.reduce((sum, item) => {
    return sum + Math.max(1, toNumber(item.qty ?? item.quantity ?? 1));
  }, 0);
}

function getSubtotal(order: any) {
  if (order?.subtotal != null) return toNumber(order.subtotal);
  if (order?.totalPrice != null) return toNumber(order.totalPrice);

  if (Array.isArray(order?.items)) {
    return order.items.reduce((sum: number, item: any) => {
      const price = toNumber(item?.price ?? item?.unitPrice);
      const qty = Math.max(1, toNumber(item?.qty ?? item?.quantity ?? 1));
      return sum + price * qty;
    }, 0);
  }

  return 0;
}

function getDelivery(order: any) {
  return toNumber(order?.deliveryFee ?? order?.shippingFee ?? order?.delivery);
}

function getDisplayTotal(order: any) {
  return getSubtotal(order) + getDelivery(order);
}

function getDeliveryAddress(order: OrderDoc) {
  if (typeof order.delivery === "string" && order.delivery.trim()) {
    return order.delivery.trim();
  }

  if (order.delivery && typeof order.delivery === "object") {
    const d = order.delivery as Record<string, any>;
    const parts = [
      d.address,
      d.addressLine1,
      d.addressLine2,
      d.city,
      d.county,
      d.state,
      d.postcode,
      d.zip,
      d.country,
    ]
      .map((x) => String(x ?? "").trim())
      .filter(Boolean);

    if (parts.length) return parts.join(", ");
  }

  if (typeof order.address === "string" && order.address.trim()) {
    return order.address.trim();
  }

  return "No delivery address";
}

export default function OrderDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();

  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<OrderDoc | null>(null);
  const [error, setError] = useState<string>("");

  const subtotal = getSubtotal(order);
  const delivery = getDelivery(order);
  const total = getDisplayTotal(order);



  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (!id) {
          throw new Error("Missing order id.");
        }

        const user = auth.currentUser;
        if (!user) {
          throw new Error("You need to sign in first.");
        }

        const snap = await getDoc(doc(db, "orders", String(id)));

        if (!snap.exists()) {
          throw new Error("Order not found.");
        }

        const data = snap.data() as Omit<OrderDoc, "id">;
        const nextOrder: OrderDoc = {
          id: snap.id,
          ...data,
        };

        const orderEmail = String(nextOrder.email ?? "").trim().toLowerCase();
        const currentEmail = String(user.email ?? "").trim().toLowerCase();


        const isOwner =
          currentEmail &&
          orderEmail &&
          currentEmail === orderEmail;

        const isAdmin =
          currentEmail === "robertchijiokeogo@gmail.com";

        if (!isOwner && !isAdmin) {
          throw new Error("You do not have permission to view this order.");
        }

   
        const steps: string[] = ["placed", "processing", "shipped", "delivered"];
        const currentStatus = String(order?.status ?? "placed").toLowerCase();
        const currentIndex = Math.max(0, steps.indexOf(currentStatus));

        if (!cancelled) {
          setOrder(nextOrder);
          setError("");
        }
      } catch (e: any) {
        if (!cancelled) {
          setOrder(null);
          setError(e?.message ?? "Failed to load order.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const summary = useMemo(() => {
    if (!order) {
      return {
        status: "PLACED",
        paid: false,
        itemCount: 0,
        subtotal: 0,
        delivery: 0,
        total: 0,
        customerName: "",
        phone: "",
        address: "",
      };
    }

    return {
      status: normalizeStatus(order?.fulfillmentStatus || order?.status),
      paid:
        order?.paid === true ||
        String(order?.paymentStatus ?? "").toLowerCase() === "paid",
      itemCount: getItemsCount(order),
      subtotal: getSubtotal(order),
      delivery: getDelivery(order),
      total: getDisplayTotal(order),
      customerName: String(
        order?.customerName ?? order?.fullName ?? order?.name ?? ""
      ).trim(),
      phone: String(order?.phone ?? "").trim(),
      address: getDeliveryAddress(order),
    };
  }, [order]);

  const orderStatus = String(
  order?.fulfillmentStatus || order?.status || "PLACED"
  ).toUpperCase();

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4c7dff" />
        <Text style={styles.mutedText}>Loading order...</Text>
      </View>
    );
  }

  if (error || !order) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Unable to open order</Text>
        <Text style={styles.errorText}>{error || "Order not found."}</Text>

        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

    const steps: string[] = ["placed", "processing", "shipped", "delivered"];
    const currentIndex = Math.max(
      0,
      steps.indexOf(String(orderStatus ?? "placed").toLowerCase())
    );

 <View style={{ flexDirection: "row", justifyContent: "space-between",   marginVertical: 20 }}>
  {steps.map((step: string, index: number) => {
    const active = index <= currentIndex;

    return (
      <View key={step} style={{ alignItems: "center", flex: 1 }}>
        <View
          style={{
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: active ? "#22c55e" : "#374151",
            marginBottom: 6,
          }}
        />
        <Text
          style={{
            fontSize: 12,
            color: "#9ca3af",
            textTransform: "capitalize",
            textAlign: "center",
          }}
        >
          {step}
        </Text>
      </View>
    );
  })}
</View>

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      <Pressable onPress={() => router.back()} style={styles.topBack}>
        <Text style={styles.topBackText}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>Order Details</Text>

      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.orderNumber}>{getDisplayOrderNumber(order)}</Text>
          <Text style={styles.totalBig}>{formatGBP(summary.total)}</Text>
        </View>

        <Text style={styles.dateText}>{formatDate(order?.createdAt)}</Text>

        <View style={[styles.rowBetween, { marginTop: 18 }]}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{orderStatus}</Text>
          </View>

          <Text style={styles.itemCount}>{summary.itemCount} item(s)</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Payment</Text>
        <Text style={styles.infoLine}>
          Status:{" "}
          <Text style={summary.paid ? styles.goodText : styles.warnText}>
            {summary.paid ? "PAID" : "UNPAID"}
          </Text>
        </Text>

        {!!order?.paymentMethod && (
          <Text style={styles.infoLine}>
            Method: {String(order?.paymentMethod)}
          </Text>
        )}

        {!!order?.paidAt && (
          <Text style={styles.infoLine}>Paid at: {String(order?.paidAt)}</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Delivery</Text>

        {!!summary.customerName && (
          <Text style={styles.customerName}>{summary.customerName}</Text>
        )}

        {!!summary.phone && <Text style={styles.infoLine}>{summary.phone}</Text>}

        <Text style={styles.deliveryText}>
      {order?.address || [order?.addressLine1, order?.city, order?.postcode].filter(Boolean).join(", ")}
    </Text>
      </View>

      <View style={styles.card}>
    <Text style={styles.sectionTitle}>Order Tracking</Text>

    
         {order?.trackingUrl && ["SHIPPED", "DELIVERED"].includes(orderStatus) ? (
      <Pressable
        onPress={() => Linking.openURL(String(order?.trackingUrl))}
        style={{
          backgroundColor: "#111",
          padding: 10,
          borderRadius: 8,
          marginTop: 8,
        }}
      >
        <Text style={{ color: "#4ade80", textAlign: "center" }}>
          Track Package
        </Text>
      </Pressable>
    ) : (
        <Text style={{ color: "#9ca3af", textAlign: "center", marginTop: 8 }}>
          {["SHIPPED", "DELIVERED"].includes(orderStatus)
            ? "Tracking not available"
            : "Tracking will be available after shipping"}
        </Text>
    )}

      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginTop: 16,
        }}
      >
        {steps.map((step: string, index: number) => {
          const active = index <= currentIndex;

          return (
            <View key={step} style={{ alignItems: "center", flex: 1 }}>
              <View
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 8,
                  backgroundColor: active ? "#22c55e" : "#374151",
                  marginBottom: 8,
                }}
              />
              <Text
                style={{
                  color: active ? "#22c55e" : "#9ca3af",
                  fontSize: 12,
                  textTransform: "capitalize",
                  textAlign: "center",
                }}
              >
                {step}
              </Text>
            </View>
          );
        })}
      </View>
    </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Items</Text>

        {Array.isArray(order?.items) && order?.items.length > 0 ? (
          order?.items.map((it, index) => {
            const itemTitle = String(
              it.title ?? it.name ?? it.productName ?? "Product"
            ).trim();

            const qty = Math.max(1, toNumber(it.qty ?? it.quantity ?? 1));
            const unitPrice = toNumber(it.price ?? it.unitPrice);
            const imageSource =
              typeof it.image === "string" && it.image.trim()
                ? { uri: it.image }
                : require("../../assets/images/icon.png");

            return (
              <View
                key={`${it.id ?? it.productId ?? itemTitle}-${index}`}
                style={[
                  styles.itemRow,
                  index === 0 ? null : { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)" },
                ]}
              >
                <Image source={imageSource} style={styles.itemImage} />
                <View style={styles.itemMid}>
                  <Text style={styles.itemTitle}>{itemTitle}</Text>
                  <Text style={styles.itemMeta}>
                    {formatGBP(unitPrice)} x {qty}
                  </Text>
                </View>
                <Text style={styles.itemMoney}>{formatGBP(unitPrice * qty)}</Text>
              </View>
            );
          })
        ) : (
          <Text style={styles.mutedText}>No items found.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Totals</Text>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Subtotal</Text>
          <Text style={styles.totalValue}>{formatGBP(summary.subtotal)}</Text>
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Delivery</Text>
          <Text style={styles.totalValue}>{formatGBP(summary.delivery)}</Text>
        </View>

        <View style={[styles.totalRow, { marginTop: 10 }]}>
          <Text style={styles.totalLabelStrong}>Total</Text>
          <Text style={styles.totalValueStrong}>{formatGBP(summary.total)}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#07152b",
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  centered: {
    flex: 1,
    backgroundColor: "#07152b",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  topBack: {
    alignSelf: "flex-start",
    marginBottom: 12,
  },
  topBackText: {
    color: "#c8d3f5",
    fontSize: 16,
    fontWeight: "600",
  },
  title: {
    color: "white",
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 18,
  },
  card: {
    backgroundColor: "#0f1d3a",
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderNumber: {
    color: "white",
    fontSize: 20,
    fontWeight: "800",
    flex: 1,
    marginRight: 12,
  },
  totalBig: {
    color: "white",
    fontSize: 20,
    fontWeight: "800",
  },
  dateText: {
    color: "#9ca3af",
    fontSize: 14,
    marginTop: 10,
  },
  badge: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(76,125,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(76,125,255,0.45)",
  },
  badgeText: {
    color: "#9bb8ff",
    fontSize: 13,
    fontWeight: "800",
  },
  itemCount: {
    color: "#cfd7e6",
    fontSize: 14,
  },
  sectionTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 14,
  },
  infoLine: {
    color: "#d7deea",
    fontSize: 16,
    marginBottom: 8,
  },
  customerName: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  addressText: {
    color: "#cfd7e6",
    fontSize: 16,
    lineHeight: 24,
    marginTop: 4,
  },
  goodText: {
    color: "#7ee787",
    fontWeight: "700",
  },
  warnText: {
    color: "#f87171",
    fontWeight: "700",
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
  },
  itemImage: {
    width: 58,
    height: 58,
    borderRadius: 14,
    backgroundColor: "#1f2937",
    marginRight: 12,
  },
  itemMid: {
    flex: 1,
    marginRight: 10,
  },
  itemTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
  },
  itemMeta: {
    color: "#9ca3af",
    fontSize: 14,
    marginTop: 6,
  },
  itemMoney: {
    color: "white",
    fontSize: 15,
    fontWeight: "700",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  totalLabel: {
    color: "#cfd7e6",
    fontSize: 16,
  },
  totalValue: {
    color: "#e5e7eb",
    fontSize: 16,
    fontWeight: "600",
  },
  totalLabelStrong: {
    color: "white",
    fontSize: 20,
    fontWeight: "800",
  },
  totalValueStrong: {
    color: "white",
    fontSize: 22,
    fontWeight: "800",
  },
  mutedText: {
    color: "#9ca3af",
    fontSize: 15,
    marginTop: 10,
    textAlign: "center",
  },
  errorTitle: {
    color: "white",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 10,
  },
  errorText: {
    color: "#cbd5e1",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  backBtn: {
    marginTop: 20,
    backgroundColor: "#3157e1",
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  backBtnText: {
    color: "white",
    fontWeight: "700",
    fontSize: 15,
  },

  deliveryText: {
  color: "#cbd5e1",
  fontSize: 16,
  lineHeight: 24,
},
});