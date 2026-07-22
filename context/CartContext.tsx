import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

const CART_STORAGE_KEY = "futuristek_cart_v2";

export type CartItem = {
  id: string;
  name: string;
  price: number;
  image: any;
  qty: number;
  supplierProductUrl?: string;
  productUrl?: string;
  url?: string;
  cjSku?: string;
  cjProductId?: string;
  sku?: string;
  spu?: string;
  variantSku?: string;
  productId?: string;
};

type AddProduct = {
  id: string;
  name: string;
  price: number;
  image: any;
  cjSku?: string;
  cjProductId?: string;
  quantity?: number;
};

type CartContextType = {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
  addToCart: (product: AddProduct) => void;
  removeFromCart: (id: string) => void;
  increaseQty: (id: string) => void;
  decreaseQty: (id: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  // ✅ state MUST be here (not inside clearCart, not inside useCart)
  const [items, setItems] = useState<CartItem[]>([]);
  const hasLoaded = useRef(false);

  // ✅ LOAD from storage once
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(CART_STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          if (Array.isArray(saved)) setItems(saved);
        }
      } catch (e) {
        console.log("Failed to load cart:", e);
      } finally {
        hasLoaded.current = true;
      }
    })();
  }, []);

  // ✅ SAVE anytime items changes (but only after load)
  useEffect(() => {
    if (!hasLoaded.current) return;
    (async () => {
      try {
        await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
      } catch (e) {
        console.log("Failed to save cart:", e);
      }
    })();
  }, [items]);

  const addToCart = (product: AddProduct) => {
    setItems((prev) => {
      const existing = prev.find((p) => p.id === product.id);
      if (existing) {
        return prev.map((p) =>
          p.id === product.id ? { ...p, qty: p.qty + 1 } : p
        );
      }
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setItems((prev) => prev.filter((p) => p.id !== id));
  };

  const increaseQty = (id: string) => {
    setItems((prev) =>
      prev.map((p) => (p.id === id ? { ...p, qty: p.qty + 1 } : p))
    );
  };

  const decreaseQty = (id: string) => {
    setItems((prev) =>
      prev
        .map((p) => (p.id === id ? { ...p, qty: p.qty - 1 } : p))
        .filter((p) => p.qty > 0)
    );
  };

  const clearCart = () => setItems([]);

  const totalItems = useMemo(
    () => items.reduce((sum, p) => sum + p.qty, 0),
    [items]
  );

  const totalPrice = useMemo(
    () => items.reduce((sum, p) => sum + p.qty * p.price, 0),
    [items]
  );

  const value: CartContextType = {
    items,
    totalItems,
    totalPrice,
    addToCart,
    removeFromCart,
    increaseQty,
    decreaseQty,
    clearCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}