// lib/orders.ts
import { addDoc, collection, doc, getDoc, runTransaction, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import type { Order } from "./types";

export type OrderItem = {
  id: string;
  name: string;
  price: number;
  image: any;   
  qty: number;
};

export type CreateOrderInput = {
  userId: string;
  totalItems: number;
  subtotal: number;
  deliveryFee: number;
  totalPrice: number;

  fullName: string;
  phone: string;
  address: string;

  items: {
    id: string;
    title: string;
    price: number;
    qty: number;
    image?: string;
  }[];

  delivery?: {
    name?: string;
    phone?: string;
    address?: string;
  };
  paymentIntentId?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  paid?: boolean;
  paidAt?: string;
  };


export type OrderStatus = "PLACED" | "PAID" | "PROCESSING" | "SHIPPED" | "DELIVERED";

export async function createOrder(input: CreateOrderInput) {
  try{
    const user = auth.currentUser;

    console.log("Saving order for user:", user?.uid);

    if (!user) {
      throw new Error("User not logged in");
    }

    console.log("FINAL ORDER PAYLOAD:", {
      userId: user.uid,
      fullName: input.fullName,
      phone: input.phone,
      address: input.address,
      totalPrice: input.totalPrice,
      totalItems: input.totalItems,
      status: "PLACED",
      });

    const counterRef = doc(db, "meta", "counters");

    const orderNumber = await runTransaction(db, async (transaction) => {
    const counterSnap = await transaction.get(counterRef);

    const current =
    counterSnap.exists() && typeof counterSnap.data()?.orderNumber === "number"
      ? counterSnap.data()!.orderNumber
      : 0;

    const next = current + 1;

    transaction.set(counterRef, { orderNumber: next }, { merge: true });

    return `FUT-${String(next).padStart(6, "0")}`;
  });

  const cleanAddress = (input.address || "").trim();

  const addressParts = cleanAddress
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  const addressLine1 = addressParts[0] || "";
  const city = addressParts[1] || "";
  const postcode = addressParts.slice(2).join(", ") || "";

  const docRef = await addDoc(collection(db, "orders"), {
  ...input,
  orderNumber,
  userId: user.uid,
  email: user.email ?? null,
  subtotal: input.subtotal,
  delivery: input.deliveryFee ?? 0,
  total: (input.totalPrice ?? 0) + (input.deliveryFee ?? 0),
  totalPrice: input.totalPrice,
  totalItems: input.totalItems,

  fullName: input.fullName ?? "",
  phone: input.phone ?? "",
  address: cleanAddress,
  addressLine1,
  city,
  postcode,

  paymentIntentId: input.paymentIntentId || "",
  items: input.items ?? [],
  paymentStatus: "PAID",
  paymentMethod: "stripe",
  status: "PLACED",
  fulfillmentStatus: "PLACED",
  sentToSupplier: false,
  supplierName: "",
  supplierOrderId: "",
  cjOrderId: "",
  cjOrderNumber: "",
  supplierStatus: "",
  paid: true,
  paidAt: new Date().toISOString(),
  createdAt: serverTimestamp(),
  createdAtMs: Date.now(),

  estimatedDeliveryStart: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
  estimatedDeliveryEnd: new Date(Date.now() + 13 * 24 * 60 * 60 * 1000).toISOString(),
});


    console.log("ORDER SAVED TO FIRESTORE");

    console.log("ORDER CREATED:", docRef.id);

  return docRef.id;

} catch (error) {
  console.log("Create Order Error:", error); throw error;
}
}

export async function getOrderById(id: string) {
  const ref = doc(db, "orders", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { ...snap.data(), id: snap.id};
}

export async function upsertOrder(id: string, data: Partial<Order>) {
  const ref = doc(db, "orders", id);
  await setDoc(
    ref,
    { ...data, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function updateOrderStatus(
  id: string,
  status: OrderStatus,
  extraData: any = {}
) {
  const ref = doc(db, "orders", id);

  await updateDoc(ref, {
    status,
    fulfillmentStatus: status,

    trackingNumber: extraData.trackingNumber || "",
    trackingUrl: extraData.trackingUrl || "",
    courier: extraData.courier || "",

    supplierName: extraData.supplierName || "",
    supplierOrderId: extraData.supplierOrderId || "",

    updatedAt: serverTimestamp(),
  });
}
