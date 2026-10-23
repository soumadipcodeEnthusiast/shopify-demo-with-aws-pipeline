import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, AuthError } from "../api.js";
import { useCart } from "../context/CartContext.jsx";
import PipelineTimeline from "../components/PipelineTimeline.jsx";

const POLL_MS = 1500;
const MAX_POLL_MS = 5 * 60 * 1000; // failures take ~1.5 min to reach the DLQ

// The pipeline is finished once the order failed, or the email step (the last
// stage after SNS) has a final result.
function isFinished(order, timeline) {
  if (order.status === "FAILED") return true;
  return timeline.some((e) => e.stage === "EMAIL_SENT" && e.status !== "RUNNING");
}

export default function OrderStatus() {
  const { orderId } = useParams();
  const { user, logout } = useCart();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [error, setError] = useState(null);
  const [polling, setPolling] = useState(true);

  useEffect(() => {
    if (!user?.idToken) {
      navigate("/login");
      return;
    }
    let timer;
    let stopped = false;
    const startedAt = Date.now();

    async function poll() {
      try {
        const data = await api.getOrder(orderId, user.idToken);
        if (stopped) return;
        setOrder(data.order);
        setTimeline(data.timeline);
        setError(null);
        if (isFinished(data.order, data.timeline) || Date.now() - startedAt > MAX_POLL_MS) {
          setPolling(false);
          return;
        }
      } catch (err) {
        if (stopped) return;
        if (err instanceof AuthError) {
          logout();
          navigate("/login");
          return;
        }
        setError(err.message); // e.g. 404 for a moment before the order row exists
      }
      timer = setTimeout(poll, POLL_MS);
    }
    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [orderId, user?.idToken]);

  if (!order) return <div className="page">{error ? <p className="error">{error}</p> : "Loading order…"}</div>;

  return (
    <div className="page">
      <h1>Order {order.orderId}</h1>
      <p>
        Status: <strong className={`badge status-${order.status.toLowerCase()}`}>{order.status}</strong>
        {order.total != null && <span className="muted"> · Total ${Number(order.total).toFixed(2)}</span>}
      </p>
      <p className="muted">Confirmation email goes to {order.email}</p>

      <div className="banner">
        Live from AWS: every row below was written to DynamoDB by the real service doing the work — API
        Gateway → SQS → Lambda → Step Functions → SNS → SES. {polling ? "Polling for new events…" : "Pipeline finished."}
      </div>

      <h2>Live Order Pipeline</h2>
      <PipelineTimeline timeline={timeline} />
    </div>
  );
}
