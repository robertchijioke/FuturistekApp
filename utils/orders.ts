import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Order } from "../lib/types";

export type OrderItem = {
  id: string;
  title: string;
  price: number;
  qty: number;
  image?: string;
};

export type LocalOrder = {
  id: string; 
  createdAt: string;
  fullName: string;
  phone: string;
  address: string;
  items: OrderItem[];
  subtotal: number;
  delivery: number;
  total: number;
  status: "PAID" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED";
};

const STORAGE_KEY = "orders";

export async function getOrders(): Promise<Order[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);

  if (!raw) return [];

  try {
    return JSON.parse(raw) as Order[];
  } catch {
    return [];
  }
}

export function generateOrderId(prefix = "FUT") {
  const rnd = Math.floor(100000 + Math.random() * 900000); // 6 digits
  return `${prefix}-${rnd}`;
}


// ✅ Get one order by id
export async function getOrderById(id: string): Promise<Order | null> {
  const orders = await getOrders();
  return orders.find((o) => o.id === id) ?? null;
}

// ✅ Add order
export async function addOrder(order: LocalOrder): Promise<void> {
  const existing = await getOrders();
  const next = [order, ...existing];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

// ✅ Clear orders
export async function clearOrders(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export async function updateOrderStatus(id: string, status: Order["status"]) {
  const orders = await getOrders();
  const next = orders.map((o) => (o.id === id ? { ...o, status } : o));
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

