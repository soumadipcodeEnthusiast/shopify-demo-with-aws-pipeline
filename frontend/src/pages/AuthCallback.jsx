import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext.jsx";

// Cognito Hosted UI implicit-grant callback: the id_token lands in the URL
// fragment (#id_token=...). This is a demo simplification — a production
// app should use the Authorization Code + PKCE flow instead.
export default function AuthCallback() {
  const { login } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const idToken = params.get("id_token");
    if (idToken) {
      try {
        const payload = JSON.parse(atob(idToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
        login(payload.email || "cognito-user", idToken);
      } catch {
        login("cognito-user", idToken);
      }
    }
    navigate("/", { replace: true });
  }, []);

  return <div className="page">Signing you in…</div>;
}
