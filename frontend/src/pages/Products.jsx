import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { useCart } from "../context/CartContext.jsx";

export default function Products() {
  const [products, setProducts] = useState(null);
  const [error, setError] = useState(null);
  const { addToCart } = useCart();

  useEffect(() => {
    api
      .getProducts()
      .then((items) => setProducts([...items].sort((a, b) => a.id.localeCompare(b.id))))
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="page error">Could not load products: {error}</div>;
  if (!products) return <div className="page muted">Loading products from DynamoDB…</div>;

  return (
    <div className="page">
      <h1>Products</h1>
      <div className="grid">
        {products.map((p) => (
          <div className="card" key={p.id}>
            <div className="card-thumb" aria-hidden="true" />
            <h3>{p.name}</h3>
            <p className="price">${p.price.toFixed(2)}</p>
            <p className="muted small">{p.stock > 0 ? `${p.stock} in stock` : "Sold out"}</p>
            <button className="btn btn-primary" disabled={p.stock === 0} onClick={() => addToCart(p)}>
              Add to cart
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
