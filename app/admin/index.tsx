import { Audio } from "expo-av";
import * as Device from "expo-device";
import * as FileSystem from "expo-file-system/legacy";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDocs, limit, onSnapshot, orderBy, query, setDoc, updateDoc } from "firebase/firestore";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { auth, db } from "../../lib/firebase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});



const ADMIN_EMAIL = "robertchijiokeogo@gmail.com";
const EXPO_PROJECT_ID = "63da351c-8929-46d8-8e0e-c5d1c32e711b";
const ORDER_CHANNEL_ID = "orders_custom_v2";

type OrderStatus = "placed" | "processing" | "shipped" | "delivered";
type FilterTab = "all" | OrderStatus;
type RangeMode = "weekly" | "monthly";

type OrderItem = {
  productId?: string;
  sku?: string;
  title?: string;
  name?: string;
  productName?: string;
  qty?: number;
  quantity?: number;
  price?: number;
  unitPrice?: number;
  total?: number;
  image?: string;
};

type OrderDoc = {
  id: string;
  orderNumber?: string;
  status?: string;
  createdAt?: any;
  createdAtMs?: number;
  trackingNumber?: string;
  trackingUrl?: string;
  courier?: string;
  supplierName?: string;
  supplierOrderId?: string;
  supplierProductUrl?: string;

  total?: number;
  subtotal?: number;
  totalPrice?: number;
  delivery?: number;
  deliveryFee?: number;
  shippingFee?: number;

  customerName?: string;
  fullName?: string;
  name?: string;
  phone?: string;
  address?: string;

  totalItems?: number;
  items?: OrderItem[];

  paid?: boolean;
  paymentStatus?: string;
  paymentMethod?: string;
};

type TopProduct = {
  key: string;
  name: string;
  qty: number;
  revenue: number;
  orders: number;
};

const STATUS_TABS: Array<{ key: FilterTab; label: string }> = [
  { key: "all", label: "All" },
  { key: "placed", label: "Placed" },
  { key: "processing", label: "Processing" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
];

function normalizeStatus(value?: string): OrderStatus {
  const s = String(value ?? "placed").trim().toLowerCase();
  if (s === "processing") return "processing";
  if (s === "shipped") return "shipped";
  if (s === "delivered") return "delivered";
  return "placed";
}

function formatGBP(n: number) {
  const value = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(value);
}

function toNumber(n: any) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

function toDateSafe(v: any): Date | null {
  try {
    if (!v) return null;

    if (typeof v?.toDate === "function") return v.toDate();
    if (typeof v?.toMillis === "function") return new Date(v.toMillis());

    if (typeof v?.seconds === "number") {
      const ms =
        v.seconds * 1000 + Math.floor(Number(v.nanoseconds ?? 0) / 1e6);
      return new Date(ms);
    }

    if (v instanceof Date) return v;

    if (typeof v === "number" && Number.isFinite(v)) return new Date(v);

    if (typeof v === "string") {
      const s = v.trim();
      if (!s) return null;
      if (/^\d+$/.test(s)) return new Date(Number(s));

      const d = new Date(s);
      if (!Number.isNaN(d.getTime())) return d;
    }

    return null;
  } catch {
    return null;
  }
}

function getCreatedAtMs(order: any) {
  const raw = order?.createdAt ?? order?.created_at ?? order?.date ?? null;
  const d = toDateSafe(raw);
  return d ? d.getTime() : 0;
}

function formatDate(v: any) {
  const d = toDateSafe(v);
  if (!d) return "";
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function timeAgo(date: Date) {
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;

  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;

  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;

  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function addMonths(d: Date, months: number) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + months);
  return x;
}

function formatDayLabel(d: Date) {
  return d.toLocaleDateString("en-GB", { weekday: "short" });
}

function formatMonthLabel(d: Date) {
  return d.toLocaleDateString("en-GB", {
    month: "short",
    year: "2-digit",
  });
}

function getDisplayOrderNumber(order: OrderDoc) {
  const value = String(order?.orderNumber ?? "").trim();
  if (value) return value;
  return `Order #${String(order?.id ?? "").slice(0, 8).toUpperCase()}`;
}

function getItemsCount(order: OrderDoc) {
  const explicit = Number(order?.totalItems);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  if (Array.isArray(order?.items)) return order.items.length;
  return 0;
}

function getSubtotal(order: OrderDoc) {
  if (Array.isArray(order?.items) && order.items.length) {
    return order.items.reduce((sum, item) => {
      const price = toNumber(item?.price ?? item?.unitPrice);
      const qty = Math.max(1, toNumber(item?.qty ?? item?.quantity ?? 1));
      return sum + price * qty;
    }, 0);
  }

  if (order?.subtotal != null) return toNumber(order.subtotal);
  if (order?.totalPrice != null) return toNumber(order.totalPrice);

  return 0;
}

function getDelivery(order: OrderDoc) {
  const raw = order?.deliveryFee ?? order?.shippingFee ?? order?.delivery;

  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;

  if (typeof raw === "string") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }

  return 0;
}

function getDisplayTotal(order: OrderDoc) {
  const subtotal = getSubtotal(order);
  const delivery = getDelivery(order);

  // safest path: if we can build subtotal from items, add delivery once
  if (Array.isArray(order?.items) && order.items.length) {
    return subtotal + delivery;
  }

  // fallback for older orders without items array
  if (order?.total != null && Number.isFinite(Number(order.total))) {
    return Number(order.total);
  }

  if (order?.totalPrice != null && Number.isFinite(Number(order.totalPrice))) {
    const tp = Number(order.totalPrice);

    // if totalPrice looks like subtotal-only, add delivery once
    if (delivery > 0 && Math.abs(tp - subtotal) < 0.01) {
      return tp + delivery;
    }

    return tp;
  }

  return subtotal + delivery;
}

function csvEscape(value: any) {
  const s = String(value ?? "");
  const escaped = s.replace(/"/g, '""');
  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

async function playOrderAlertSound() {
  try {
    const { sound } = await Audio.Sound.createAsync(
      require("../../assets/images/sounds/order_alert.wav")
    );
    await sound.playAsync();

    sound.setOnPlaybackStatusUpdate((status: any) => {
      if ("didJustFinish" in status && status.didJustFinish) {
        sound.unloadAsync();
      }
    });
  } catch (error) {
    console.log("Sound error:", error);
  }
}

async function setupNotifications() {
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(ORDER_CHANNEL_ID, {
        name: "Orders Custom V2",
        importance: Notifications.AndroidImportance.MAX,
        sound: "order_alert.wav",
        vibrationPattern: [0, 250, 250, 250],
      });
    }
  } catch (error) {
    console.log("setupNotifications error:", error);
  }
}

async function registerForPushNotificationsAsync() {
  try {
    if (!Device.isDevice) {
      console.log("Push notifications require a physical device");
      return null;
    }

    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();

    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("Notification permission not granted");
      return null;
    }

    const token = (
      await Notifications.getExpoPushTokenAsync({
        projectId: EXPO_PROJECT_ID,
      })
    ).data;

    console.log("Expo push token:", token);
    return token;
  } catch (error) {
    console.log("registerForPushNotificationsAsync error:", error);
    return null;
  }
}

export default function AdminDashboard() {
  const router = useRouter();
  const seenOrderIds = useRef<Set<string>>(new Set());

  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [orders, setOrders] = useState<OrderDoc[]>([]);
  const [liveOrders, setLiveOrders] = useState<OrderDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<RangeMode>("weekly");

  const handleUpdateStatus = async (orderId: string, nextStatus: string) => {
    try {
      const orderRef = doc(db, "orders", orderId);
      const input = orders.find((o) => o.id === orderId);

      if (!input) {
        Alert.alert("Error", "Order not found.");
        return;
      }

      await updateDoc(orderRef, {
        status: nextStatus,
        fulfillmentStatus: nextStatus,

        trackingNumber: input.trackingNumber || "",
        trackingUrl: input.trackingUrl || "",
        courier: input.courier || "",

        supplierName: input.supplierName || "",
        supplierOrderId: input.supplierOrderId || "",
        supplierProductUrl: input.supplierProductUrl || "",

        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.log("Quick status update error:", error);
      Alert.alert("Error", "Failed to update order status.");
    }
  };

  useEffect(() => {
    setupNotifications().catch(console.error);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      const email = (user?.email ?? "").toLowerCase().trim();
      setIsAdmin(email === ADMIN_EMAIL.toLowerCase());
      setCheckingAuth(false);
    });

    return unsub;
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        if (checkingAuth || !isAdmin || !auth.currentUser) return;

        const token = await registerForPushNotificationsAsync();
        if (!mounted || !token) return;

        await setDoc(
          doc(db, "adminDevices", auth.currentUser.uid),
          {
            uid: auth.currentUser.uid,
            email: auth.currentUser.email ?? "",
            expoPushToken: token,
            updatedAt: Date.now(),
          },
          { merge: true }
        );

        console.log("Saved expo push token:", token);
      } catch (error) {
        console.log("Failed to save admin device:", error);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [checkingAuth, isAdmin]);

  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log("Notification received:", notification);
        playOrderAlertSound();
      }
    );

    const responseSub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log("Notification tapped:", response.notification.request.content.data);
      }
    );

    return () => {
      sub.remove();
      responseSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!isAdmin) return;

    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(10));

    const unsub = onSnapshot(q, (snap) => {
      const items: OrderDoc[] = snap.docs.map((d) => {
        const data: any = d.data();
        return {
          id: d.id,
          ...data,
          createdAtMs: getCreatedAtMs(data),
        };
      });

      setLiveOrders(items);

      const currentIds = new Set(items.map((item) => item.id));

      if (seenOrderIds.current.size === 0) {
        seenOrderIds.current = currentIds;
        return;
      }

      const hasNewOrder = items.some((item) => !seenOrderIds.current.has(item.id));
      if (hasNewOrder) {
        playOrderAlertSound();
      }

      seenOrderIds.current = currentIds;
    });

    return () => unsub();
  }, [isAdmin]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (!isAdmin) {
          if (!cancelled) {
            setOrders([]);
            setLoading(false);
          }
          return;
        }

        setLoading(true);

        const q = query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(500));
        const snap = await getDocs(q);

        const items: OrderDoc[] = snap.docs
          .map((d) => {
            const data: any = d.data();

            return {
              id: d.id,
              ...data,
              createdAtMs: getCreatedAtMs(data),
            };
          })
          .sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0));

        if (!cancelled) {
          setOrders(items);
        }
      } catch (e) {
        console.log("Orders fetch error:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const filtered = useMemo(() => {
    let result = [...orders];

    if (tab !== "all") {
      result = result.filter((o) => normalizeStatus(o.status) === tab);
    }

    if (search.trim()) {
      const s = search.trim().toLowerCase();

      result = result.filter((o) => {
        const orderNumber = String(o.orderNumber ?? "").toLowerCase();
        const rawId = String(o.id ?? "").toLowerCase();
        const fallbackOrderId = `order #${String(o.id ?? "").slice(0, 8)}`.toLowerCase();
        const customerName = String(
          o.customerName ?? o.fullName ?? o.name ?? ""
        ).toLowerCase();
        const phone = String(o.phone ?? "").toLowerCase();

        return (
          orderNumber.includes(s) ||
          rawId.includes(s) ||
          fallbackOrderId.includes(s) ||
          customerName.includes(s) ||
          phone.includes(s)
        );
      });
    }

    return result.sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0));
  }, [orders, tab, search]);

  const stats = useMemo(() => {
    const all = orders ?? [];

    const revenue = all.reduce((acc, o) => acc + getDisplayTotal(o), 0);

    const deliveredOrders = all.filter(
      (o) => String(o.status ?? "").toUpperCase() === "DELIVERED"
    );

    const pendingOrders = all.filter(
      (o) => String(o.status ?? "").toUpperCase() !== "DELIVERED"
    );

    const deliveredRevenue = deliveredOrders.reduce(
      (acc, o) => acc + getDisplayTotal(o),
      0
    );

    return {
      revenue,
      ordersCount: all.length,
      deliveredRevenue,
      deliveredCount: deliveredOrders.length,
      pendingCount: pendingOrders.length,
    };
  }, [orders]);

  const smartStats = useMemo(() => {
    const now = new Date();

    const currStart =
      range === "weekly" ? startOfDay(addDays(now, -6)) : startOfDay(addDays(now, -29));
    const currEnd = endOfDay(now);

    const prevEnd = endOfDay(addDays(currStart, -1));
    const prevStart =
      range === "weekly"
        ? startOfDay(addDays(prevEnd, -6))
        : startOfDay(addDays(prevEnd, -29));

    const inRange = (o: OrderDoc, a: Date, b: Date) => {
      const ms = Number(o.createdAtMs ?? 0);
      if (!ms) return false;
      return ms >= a.getTime() && ms <= b.getTime();
    };

    const currOrders = (orders ?? []).filter((o) => inRange(o, currStart, currEnd));
    const prevOrders = (orders ?? []).filter((o) => inRange(o, prevStart, prevEnd));

    const currRevenue = currOrders.reduce((sum, o) => sum + getDisplayTotal(o), 0);
    const prevRevenue = prevOrders.reduce((sum, o) => sum + getDisplayTotal(o), 0);

    const currCount = currOrders.length;
    const prevCount = prevOrders.length;

    const currAOV = currCount ? currRevenue / currCount : 0;
    const prevAOV = prevCount ? prevRevenue / prevCount : 0;

    const currDeliveredRevenue = currOrders
      .filter((o) => normalizeStatus(o.status) === "delivered")
      .reduce((sum, o) => sum + getDisplayTotal(o), 0);

    const prevDeliveredRevenue = prevOrders
      .filter((o) => normalizeStatus(o.status) === "delivered")
      .reduce((sum, o) => sum + getDisplayTotal(o), 0);

    function pctChange(curr: number, prev: number, minPrev = 1) {
      if (prev < minPrev) {
        if (prev === 0 && curr === 0) return { pct: 0, label: "--" };
        return { pct: 0, label: "NEW" };
      }

      const pct = ((curr - prev) / prev) * 100;
      return {
        pct,
        label: `${Math.abs(pct).toFixed(1)}%`,
      };
    }

    const rev = pctChange(currRevenue, prevRevenue, 50);
    const ord = pctChange(currCount, prevCount, 3);
    const aov = pctChange(currAOV, prevAOV, 10);
    const del = pctChange(currDeliveredRevenue, prevDeliveredRevenue, 50);

    return {
      currRevenue,
      prevRevenue,
      revenuePct: rev.pct,
      revenueLabel: rev.label,

      currCount,
      prevCount,
      ordersPct: ord.pct,
      ordersLabel: ord.label,

      currAOV,
      prevAOV,
      aovPct: aov.pct,
      aovLabel: aov.label,

      currDeliveredRevenue,
      prevDeliveredRevenue,
      deliveredRevenuePct: del.pct,
      deliveredRevenueLabel: del.label,
    };
  }, [orders, range]);

  const topProducts = useMemo<TopProduct[]>(() => {
    const safeOrders = orders ?? [];
    const now = new Date();
    const daysBack = range === "weekly" ? 7 : 30;
    const cutoff = startOfDay(addDays(now, -(daysBack - 1)));

    const delivered = safeOrders.filter(
      (o) => normalizeStatus(o.status) === "delivered"
    );

    const inWindow = delivered.filter((o) => {
      const d = toDateSafe(o.createdAt);
      if (!d) return false;
      return d >= cutoff;
    });

    const map = new Map<string, TopProduct>();

    for (const o of inWindow) {
      const items = Array.isArray(o.items) ? o.items : [];

      for (const it of items) {
        const name = String(
          it?.title || it?.name || it?.productName || "Unknown item"
        ).trim();

        const qty = Math.max(1, toNumber(it?.qty ?? it?.quantity ?? 1));
        const price = toNumber(it?.price ?? it?.unitPrice ?? 0);
        const revenue = price * qty;
        const key = String(it?.productId ?? it?.sku ?? name).toLowerCase();

        const prev = map.get(key) ?? {
          key,
          name,
          qty: 0,
          revenue: 0,
          orders: 0,
        };

        prev.qty += qty;
        prev.revenue += revenue;
        prev.orders += 1;

        map.set(key, prev);
      }
    }

    return Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [orders, range]);

  const analytics = useMemo(() => {
    const safeOrders = orders ?? [];
    const delivered = safeOrders.filter(
      (o) => normalizeStatus(o.status) === "delivered"
    );

    const safeTotal = (o: OrderDoc) => getDisplayTotal(o);

    if (range === "weekly") {
      const now = new Date();

      const days = Array.from({ length: 7 }).map((_, i) =>
        startOfDay(addDays(now, -6 + i))
      );

      const buckets = days.map((d) => ({
        label: formatDayLabel(d),
        revenue: 0,
        count: 0,
        key: d.getTime(),
      }));

      for (const o of delivered) {
        const dt = toDateSafe(o.createdAt);
        if (!dt) continue;

        const dayKey = startOfDay(dt).getTime();
        const idx = buckets.findIndex((b) => b.key === dayKey);

        if (idx >= 0) {
          buckets[idx].revenue += safeTotal(o);
          buckets[idx].count += 1;
        }
      }

      const current = buckets[buckets.length - 1]?.revenue ?? 0;
      const previous = buckets[buckets.length - 2]?.revenue ?? 0;

      let trend = 0;
      if (previous > 0) {
        trend = ((current - previous) / previous) * 100;
      } else if (previous === 0 && current > 0) {
        trend = 100;
      }

      return {
        mode: "weekly" as const,
        trend,
        buckets,
        maxRevenue: Math.max(1, ...buckets.map((b) => b.revenue)),
        maxCount: Math.max(1, ...buckets.map((b) => b.count)),
      };
    }

    const now = new Date();
    const months = Array.from({ length: 6 }).map((_, i) =>
      startOfMonth(addMonths(now, -5 + i))
    );

    const buckets = months.map((d) => ({
      label: formatMonthLabel(d),
      revenue: 0,
      count: 0,
      key: d.getTime(),
    }));

    for (const o of delivered) {
      const dt = toDateSafe(o.createdAt);
      if (!dt) continue;

      const monthKey = startOfMonth(dt).getTime();
      const idx = buckets.findIndex((b) => b.key === monthKey);

      if (idx >= 0) {
        buckets[idx].revenue += safeTotal(o);
        buckets[idx].count += 1;
      }
    }

    const current = buckets[buckets.length - 1]?.revenue ?? 0;
    const previous = buckets[buckets.length - 2]?.revenue ?? 0;

    let trend = 0;
    if (previous > 0) {
      trend = ((current - previous) / previous) * 100;
    } else if (previous === 0 && current > 0) {
      trend = 100;
    }

    return {
      mode: "monthly" as const,
      trend,
      buckets,
      maxRevenue: Math.max(1, ...buckets.map((b) => b.revenue)),
      maxCount: Math.max(1, ...buckets.map((b) => b.count)),
    };
  }, [orders, range]);

  async function exportOrdersCsv(rows: OrderDoc[]) {
    try {
      const headers = [
        "id",
        "orderNumber",
        "status",
        "customerName",
        "phone",
        "subtotal",
        "delivery",
        "total",
        "createdAt",
      ];

      const lines = [
        headers.join(","),
        ...rows.map((r) => {
          const created = (() => {
            const d = toDateSafe(r.createdAt);
            return d ? d.toISOString() : String(r.createdAt ?? "");
          })();

          const subtotal = getSubtotal(r);
          const delivery = getDelivery(r);
          const total = getDisplayTotal(r);

          const values = [
            r.id ?? "",
            getDisplayOrderNumber(r),
            r.status ?? "",
            r.customerName ?? r.fullName ?? r.name ?? "",
            r.phone ?? "",
            subtotal,
            delivery,
            total,
            created,
          ];

          return values.map(csvEscape).join(",");
        }),
      ];

      const csv = lines.join("\n");
      const fileName = `orders_${new Date().toISOString().slice(0, 10)}.csv`;

      const baseDir =
        FileSystem.cacheDirectory ?? FileSystem.documentDirectory;

      if (!baseDir) {
        Alert.alert(
          "Export failed",
          "No writable directory available on this device."
        );
        return;
      }

      const fileUri = baseDir + fileName;

      await FileSystem.writeAsStringAsync(fileUri, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "text/csv",
          dialogTitle: "Export Orders CSV",
        });
      } else {
        Alert.alert("Exported", `Saved to: ${fileUri}`);
      }
    } catch (e: any) {
      console.log("CSV export error:", e);
      Alert.alert("Export failed", e?.message ?? "Could not generate CSV");
    }
  }

  if (checkingAuth) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Checking admin access...</Text>
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={styles.centered}>
        <Text style={styles.denied}>Access denied. Admin only.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: 28 }}
    >
      <View style={styles.ordersHeaderRow}>
        <Text style={styles.title}>Admin Dashboard</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Revenue</Text>
          <Text style={styles.statValue}>{formatGBP(stats.revenue)}</Text>
          <Text
            style={[
              styles.statSub,
              smartStats.revenueLabel === "NEW"
                ? styles.upText
                : smartStats.revenuePct > 0
                ? styles.upText
                : smartStats.revenuePct < 0
                ? styles.downText
                : styles.muted,
            ]}
          >
            {smartStats.revenueLabel === "NEW"
              ? "↑ NEW"
              : `${smartStats.revenuePct >= 0 ? "↑" : "↓"} ${smartStats.revenueLabel}`}{" "}
            vs last {range === "weekly" ? "week" : "month"}
          </Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Orders</Text>
          <Text style={styles.statValue}>{stats.ordersCount}</Text>
          <Text
            style={[
              styles.statSub,
              smartStats.ordersLabel === "NEW"
                ? styles.upText
                : smartStats.ordersPct > 0
                ? styles.upText
                : smartStats.ordersPct < 0
                ? styles.downText
                : styles.muted,
            ]}
          >
            {smartStats.ordersLabel === "NEW"
              ? "↑ NEW"
              : `${smartStats.ordersPct >= 0 ? "↑" : "↓"} ${smartStats.ordersLabel}`}{" "}
            vs last {range === "weekly" ? "week" : "month"}
          </Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Delivered</Text>
          <Text style={styles.statValue}>
            {formatGBP(stats.deliveredRevenue)}
          </Text>
          <Text style={styles.statSub}>{stats.deliveredCount} delivered</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Pending</Text>
          <Text style={styles.statValue}>{stats.pendingCount}</Text>
          <Text style={styles.statSub}>not delivered</Text>
        </View>
      </View>

      <View style={styles.analyticsHeader}>
        <Text style={styles.sectionTitle}>Analytics</Text>

        <View style={styles.rangeRow}>
          <Pressable
            onPress={() => setRange("weekly")}
            style={[
              styles.rangePill,
              range === "weekly" && styles.rangePillActive,
            ]}
          >
            <Text
              style={[
                styles.rangePillText,
                range === "weekly" && styles.rangePillTextActive,
              ]}
            >
              Weekly
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setRange("monthly")}
            style={[
              styles.rangePill,
              range === "monthly" && styles.rangePillActive,
            ]}
          >
            <Text
              style={[
                styles.rangePillText,
                range === "monthly" && styles.rangePillTextActive,
              ]}
            >
              Monthly
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Revenue (Delivered)</Text>

        <View style={styles.chartBars}>
          {analytics.buckets.map((b) => {
            const h = Math.max(
              4,
              Math.round((b.revenue / analytics.maxRevenue) * 80)
            );

            return (
              <View key={b.key} style={styles.barCol}>
                <View style={[styles.bar, { height: h }]} />
                <Text style={styles.barLabel} numberOfLines={1}>
                  {b.label}
                </Text>
              </View>
            );
          })}
        </View>

        <Text style={styles.chartSub}>
          Total:{" "}
          {formatGBP(
            analytics.buckets.reduce((acc, x) => acc + x.revenue, 0)
          )}
        </Text>
      </View>

      <View style={styles.topCard}>
        <View style={styles.topHeaderRow}>
          <Text style={styles.topTitle}>Top Products</Text>
          <Text style={styles.topSub}>
            {range === "monthly" ? "Last 30 days" : "Last 7 days"}
          </Text>
        </View>

        {topProducts.length === 0 ? (
          <Text style={styles.topEmpty}>No delivered sales in this period.</Text>
        ) : (
          topProducts.map((p, idx) => (
            <View key={p.key} style={styles.topRow}>
              <Text style={styles.topRank}>{idx + 1}</Text>

              <View style={styles.topMid}>
                <Text style={styles.topName} numberOfLines={1}>
                  {p.name}
                </Text>
                <Text style={styles.topMeta}>
                  {p.qty} sold • {p.orders} order{p.orders === 1 ? "" : "s"}
                </Text>
              </View>

              <Text style={styles.topMoney}>{formatGBP(p.revenue)}</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.chartTitle}>Live Orders</Text>

        {liveOrders.length === 0 ? (
          <Text style={[styles.muted, { marginTop: 8 }]}>No recent orders</Text>
        ) : (
          liveOrders.map((o) => {
            const paid = o.paid === true || o.paymentStatus === "paid";
            const created = toDateSafe(o.createdAt);
            const name = String(o.customerName ?? o.fullName ?? o.name ?? "Customer");
            const total = getDisplayTotal(o);

            return (
              <View
                key={o.id}
                style={{
                  paddingVertical: 10,
                  borderTopWidth: 1,
                  borderTopColor: "rgba(255,255,255,0.06)",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  <Text
                    style={{ color: "white", fontWeight: "600", flex: 1, marginRight: 10 }}
                    numberOfLines={1}
                  >
                    {name}
                  </Text>

                  <Text style={{ color: "white", fontWeight: "700" }}>
                    {formatGBP(total)}
                  </Text>
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginTop: 4,
                  }}
                >
                  <Text style={{ color: "#9ca3af" }} numberOfLines={1}>
                    {String(o.status ?? "PLACED").toUpperCase()}
                  </Text>

                  <Text
                    style={{
                      color: paid ? "#4ade80" : "#f87171",
                      fontSize: 12,
                      fontWeight: "700",
                    }}
                  >
                    {paid ? "PAID" : "UNPAID"}
                  </Text>
                </View>

                <Text style={{ color: "#9ca3af", marginTop: 4 }}>
                  {created ? timeAgo(created) : ""}
                </Text>
              </View>
            );
          })
        )}
      </View>

      <View style={styles.ordersHeaderRow}>
        <Text style={styles.title}>Orders</Text>

        <Pressable
          onPress={() => exportOrdersCsv(filtered)}
          style={styles.exportBtn}
        >
          <Text style={styles.exportBtnText}>Export CSV</Text>
        </Pressable>
      </View>

      <TouchableOpacity
        onPress={() => router.push("/admin/orders")}
        style={{
          backgroundColor: "#2563eb",
          paddingVertical: 10,
          paddingHorizontal: 14,
          borderRadius: 8,
          alignSelf: "flex-start",
          marginTop: 10,
          marginBottom: 10,
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "600" }}>
          Manage Orders (Advanced)
        </Text>
      </TouchableOpacity>

      <TextInput
        placeholder="Search order number, order ID, name, phone..."
        placeholderTextColor="#888"
        value={search}
        onChangeText={setSearch}
        style={styles.searchInput}
      />

      <View style={styles.tabsRow}>
        {STATUS_TABS.map((t) => {
          const active = tab === t.key;

          return (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={{ paddingTop: 24 }}>
          <ActivityIndicator />
        </View>
      ) : filtered.length === 0 ? (
        <Text style={styles.muted}>No orders found.</Text>
      ) : (
        filtered.map((o) => {
          const status = normalizeStatus(o.status);
          const name = String(o.fullName ?? o.name ?? o.customerName ?? "").trim();
          const itemsCount = getItemsCount(o);
          const paid = o.paid === true || o.paymentStatus === "paid";
          const paymentLabel = paid ? "PAID" : "UNPAID";
          
          const displayTotal = getDisplayTotal(o);

          return (
              <View key={o.id} style={styles.card}>
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: `/admin/orders/${String(o.id)}` as any,
                    })
                  }
                >
                  <View style={styles.cardTopRow}>
                    <Text style={styles.orderId} numberOfLines={1}>
                      {getDisplayOrderNumber(o)}
                    </Text>

                    <Text style={styles.total}>{formatGBP(displayTotal)}</Text>
                  </View>

                  <Text style={styles.dateText}>{formatDate(o.createdAt)}</Text>
                </Pressable>

                <View style={styles.cardBottomRow}>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{status.toUpperCase()}</Text>
                  </View>

                  <View
                    style={[
                      styles.badge,
                      {
                        marginLeft: 8,
                        backgroundColor: paid
                          ? "rgba(34,197,94,0.15)"
                          : "rgba(239,68,68,0.15)",
                        borderColor: paid
                          ? "rgba(34,197,94,0.35)"
                          : "rgba(239,68,68,0.35)",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        { color: paid ? "#4ade80" : "#f87171" },
                      ]}
                    >
                      {paymentLabel}
                    </Text>
                  </View>
                </View>

                <View style={styles.quickActionsRow}>
                  {["PROCESSING", "SHIPPED", "DELIVERED"]
                    .filter((st) => status !== st)
                    .map((st) => (
                      <Pressable
                        key={st}
                        onPress={() => handleUpdateStatus(String(o.id), st)}
                        style={styles.quickBtn}
                      >
                        <Text style={styles.quickBtnText}>
                          {st.charAt(0) + st.slice(1).toLowerCase()}
                        </Text>
                      </Pressable>
                    ))}
                </View>

                <Text style={styles.small}>
                  {itemsCount} item{itemsCount === 1 ? "" : "s"}
                  {name ? ` • ${name}` : ""}
                </Text>
              </View>
            );
                    })
                  )}
                </ScrollView>
              );
            }

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0b1523",
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  centered: {
    flex: 1,
    backgroundColor: "#0b1523",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  denied: {
    color: "#f87171",
    fontSize: 16,
    fontWeight: "700",
  },
  muted: {
    color: "#9ca3af",
    fontSize: 14,
  },
  title: {
    color: "white",
    fontSize: 30,
    fontWeight: "800",
  },
  sectionTitle: {
    color: "white",
    fontSize: 22,
    fontWeight: "800",
  },
  ordersHeaderRow: {
    marginTop: 10,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  exportBtn: {
    backgroundColor: "#1d4ed8",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  exportBtnText: {
    color: "white",
    fontWeight: "700",
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#122033",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  statLabel: {
    color: "#9ca3af",
    fontSize: 13,
    marginBottom: 8,
  },
  statValue: {
    color: "white",
    fontSize: 24,
    fontWeight: "800",
  },
  statSub: {
    fontSize: 13,
    marginTop: 6,
    color: "#9ca3af",
  },
  upText: {
    color: "#22c55e",
  },
  downText: {
    color: "#f87171",
  },
  analyticsHeader: {
    marginTop: 14,
    marginBottom: 12,
  },
  rangeRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  rangePill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#122033",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  rangePillActive: {
    backgroundColor: "#1d4ed8",
    borderColor: "#3b82f6",
  },
  rangePillText: {
    color: "#cbd5e1",
    fontWeight: "700",
  },
  rangePillTextActive: {
    color: "white",
  },
  chartCard: {
    backgroundColor: "#122033",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  chartTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 14,
  },
  chartBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    minHeight: 110,
    gap: 8,
  },
  barCol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  bar: {
    width: 18,
    borderRadius: 8,
    backgroundColor: "#3b82f6",
    marginBottom: 8,
  },
  barLabel: {
    color: "#9ca3af",
    fontSize: 11,
  },
  chartSub: {
    color: "#9ca3af",
    marginTop: 12,
    fontSize: 13,
  },
  topCard: {
    backgroundColor: "#122033",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  topHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    alignItems: "center",
  },
  topTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "800",
  },
  topSub: {
    color: "#9ca3af",
    fontSize: 13,
  },
  topEmpty: {
    color: "#9ca3af",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  topRank: {
    width: 26,
    color: "#60a5fa",
    fontWeight: "800",
    fontSize: 16,
  },
  topMid: {
    flex: 1,
    paddingRight: 10,
  },
  topName: {
    color: "white",
    fontWeight: "700",
  },
  topMeta: {
    color: "#9ca3af",
    fontSize: 12,
    marginTop: 3,
  },
  topMoney: {
    color: "white",
    fontWeight: "800",
  },
  card: {
    backgroundColor: "#101a33",
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
  },
  orderId: {
    color: "white",
    fontWeight: "800",
    fontSize: 18,
    flex: 1,
    marginRight: 10,
  },
  total: {
    color: "white",
    fontWeight: "800",
    fontSize: 18,
  },
  dateText: {
    color: "#9ca3af",
    marginTop: 10,
    fontSize: 15,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(59,130,246,0.15)",
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.35)",
  },
  badgeText: {
    color: "#93c5fd",
    fontWeight: "800",
    fontSize: 12,
  },
  small: {
    color: "#9ca3af",
    marginTop: 12,
    fontSize: 13,
  },
  searchInput: {
    backgroundColor: "#101a33",
    color: "white",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  tabsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#122033",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  tabActive: {
    backgroundColor: "#1d4ed8",
    borderColor: "#3b82f6",
  },
  tabText: {
    color: "#cbd5e1",
    fontWeight: "700",
  },
  tabTextActive: {
    color: "white",
  },

cardBottomRow: {
  flexDirection: "row",
  alignItems: "center",
  marginTop: 12,
},

quickActionsRow: {
  flexDirection: "row",
  flexWrap: "wrap",
  gap: 8,
  marginTop: 12,
},

quickBtn: {
  paddingHorizontal: 14,
  paddingVertical: 8,
  borderRadius: 18,
  borderWidth: 1,
  borderColor: "#2a3b4d",
  backgroundColor: "#162334",
},

quickBtnText: {
  color: "#cbd5e1",
  fontWeight: "600",
  fontSize: 13,
},
});