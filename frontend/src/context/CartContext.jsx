import React, { createContext, useContext, useMemo, useState } from "react";

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState([]); // [{ id, name, price, qty }]
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem("demo_user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  function login(email, idToken) {
    const u = { email, idToken };
    localStorage.setItem("demo_user", JSON.stringify(u));
    setUser(u);
  }

  function logout() {
    localStorage.removeItem("demo_user");
    setUser(null);
  }

  function addToCart(product) {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        return prev.map((i) => (i.id === product.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...prev, { id: product.id, name: product.name, price: product.price, qty: 1 }];
    });
  }

  function updateQty(id, qty) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, qty: Math.max(1, qty) } : i)));
  }

  function removeFromCart(id) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function clearCart() {
    setItems([]);
  }

  const total = useMemo(() => items.reduce((sum, i) => sum + i.price * i.qty, 0), [items]);

  const value = { items, addToCart, updateQty, removeFromCart, clearCart, total, user, login, logout };
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
