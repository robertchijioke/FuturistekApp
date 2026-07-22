// lib/types.ts
export type OrderStatus = "PAID" | "PLACED" | "PROCESSING" | "SHIPPED" | "DELIVERED";

export type OrderItem = {
  id: string;
  title: string;
  price: number;
  qty: number;
  image?: string;
  cjSku?: string;
  cjProductId?: string;
};

export type Order = {
  id: string;
  status: OrderStatus;
  createdAt?: any;

  fullName?: string;
  phone?: string;
  address?: string;

  items?: OrderItem[];

  subtotal?: number;
  delivery?: number;     // ✅ THIS is the key line
  total?: number;
};