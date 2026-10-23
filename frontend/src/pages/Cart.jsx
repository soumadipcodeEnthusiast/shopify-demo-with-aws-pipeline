import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext.jsx";

export default function Cart() {
  const { items, updateQty, removeFromCart, total } = useCart();
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className="page">
        <h1>Your cart</h1>
        <p className="muted">Cart is empty. <Link to="/">Browse products</Link>.</p>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>Your cart</h1>
      <table className="cart-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Price</th>
            <th>Qty</th>
            <th>Subtotal</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id}>
              <td>{i.name}</td>
              <td>${i.price.toFixed(2)}</td>
              <td>
                <input
                  type="number"
                  min="1"
                  value={i.qty}
                  onChange={(e) => updateQty(i.id, Number(e.target.value))}
                  className="qty-input"
                />
              </td>
              <td>${(i.price * i.qty).toFixed(2)}</td>
              <td>
                <button className="link-button" onClick={() => removeFromCart(i.id)}>
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="total">Total: ${total.toFixed(2)}</p>
      <button className="btn btn-primary" onClick={() => navigate("/checkout")}>
        Proceed to checkout
      </button>
    </div>
  );
}
