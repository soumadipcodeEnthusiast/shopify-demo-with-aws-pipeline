// Thin client for the deployed API Gateway stage (backend/aws). The base URL
// comes from frontend/.env (VITE_API_BASE = the stack's ApiUrl output).
const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

export class AuthError extends Error {}

async function request(path, { token, ...options } = {}) {
  if (!API_BASE) throw new Error("VITE_API_BASE is not set in frontend/.env");
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: token } : {}),
      ...options.headers,
    },
  });
  // Cognito authorizer rejects missing/expired ID tokens with 401.
  if (res.status === 401) throw new AuthError("Your session expired — please log in again.");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || `Request failed (${res.status})`);
  return data;
}

export const api = {
  getProducts: () => request("/products"),
  checkout: (payload, token) => request("/checkout", { method: "POST", body: JSON.stringify(payload), token }),
  getOrder: (orderId, token) => request(`/orders/${encodeURIComponent(orderId)}`, { token }),
};
