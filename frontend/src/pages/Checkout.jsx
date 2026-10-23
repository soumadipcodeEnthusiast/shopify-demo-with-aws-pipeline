import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext.jsx";
import { api, AuthError } from "../api.js";

// Requesting far more than any product's stock makes ValidateInventory fail
// for real in the Step Functions workflow.
const INVENTORY_FAILURE_QTY = 9999;

export default function Checkout() {
  const { items, total, user, clearCart, logout } = useCart();
  const navigate = useNavigate();
  const [email, setEmail] = useState(user?.email || "");
  const [card, setCard] = useState("4242 4242 4242 4242");
  const [simulateFailure, setSimulateFailure] = useState("none");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user?.idToken) navigate("/login", { state: { from: "/checkout" } });
  }, [user]);

  if (items.length === 0) {
    return (
      <div className="page">
        <h1>Checkout</h1>
        <p className="muted">Your cart is empty.</p>
      </div>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { orderId } = await api.checkout(
        {
          email,
          card: card.replace(/\s+/g, ""),
          items: items.map((i) => ({
            id: i.id,
            qty: simulateFailure === "inventory" ? INVENTORY_FAILURE_QTY : i.qty,
          })),
          simulateFailure: simulateFailure === "none" ? null : simulateFailure,
        },
        user.idToken
      );
      clearCart();
      navigate(`/orders/${orderId}`);
    } catch (err) {
      if (err instanceof AuthError) {
        logout();
        navigate("/login");
        return;
      }
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="page page-narrow">
      <h1>Checkout</h1>
      <form onSubmit={handleSubmit} className="form">
        <label>
          Email (order confirmation is sent here via SES)
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Card number (mock payment — no real charge, only the last 4 digits are stored)
          <input value={card} onChange={(e) => setCard(e.target.value)} />
        </label>
        <p className="muted small">Tip: a card number ending in 0000 is declined by the mock payment step.</p>
        <label>
          Failure demonstration
          <select value={simulateFailure} onChange={(e) => setSimulateFailure(e.target.value)}>
            <option value="none">None — normal checkout</option>
            <option value="inventory">Insufficient inventory (fails validation → SQS retries → DLQ)</option>
            <option value="payment">Payment declined (compensation → SQS retries → DLQ)</option>
          </select>
        </label>
        <p className="total">Total: ${total.toFixed(2)}</p>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? "Sending to API Gateway…" : "Place order"}
        </button>
      </form>
    </div>
  );
}
