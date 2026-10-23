import React from "react";
import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext.jsx";

export default function Navbar() {
  const { items, user, logout } = useCart();
  const count = items.reduce((sum, i) => sum + i.qty, 0);

  return (
    <header className="navbar">
      <Link to="/" className="brand">
        shop-pipeline-demo
      </Link>
      <nav className="nav-links">
        <Link to="/">Products</Link>
        <Link to="/cart">Cart ({count})</Link>
        {user ? (
          <>
            <span className="muted">{user.email}</span>
            <button className="link-button" onClick={logout}>
              Log out
            </button>
          </>
        ) : (
          <Link to="/login">Log in</Link>
        )}
      </nav>
    </header>
  );
}
