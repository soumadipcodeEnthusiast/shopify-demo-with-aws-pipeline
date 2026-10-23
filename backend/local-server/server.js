import "dotenv/config";
import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import nodemailer from "nodemailer";

import { products, findProduct } from "./data/products.js";
import { orders, getTimeline } from "./store.js";
import { runOrderPipeline } from "./pipeline/orderPipeline.js";

const app = express();
app.use(cors());
app.use(express.json());

const productsById = new Map(products.map((p) => [p.id, p]));

let emailer = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER) {
  emailer = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  console.log("[email] SMTP configured — confirmation emails will be sent for real.");
} else {
  console.log("[email] SMTP not configured — confirmation emails will be skipped and logged instead.");
}

app.get("/api/health", (_req, res) => res.json({ ok: true, mode: "local-demo" }));

app.get("/api/products", (_req, res) => {
  res.json(products.map((p) => ({ ...p })));
});

app.post("/api/checkout", async (req, res) => {
  const { email, card, items, simulateFailure } = req.body || {};

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "A valid email address is required." });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Cart is empty." });
  }

  const resolvedItems = [];
  for (const line of items) {
    const product = findProduct(line.id);
    if (!product) {
      return res.status(400).json({ error: `Unknown product ${line.id}` });
    }
    resolvedItems.push({
      id: product.id,
      name: product.name,
      price: product.price,
      requestedQty:
        simulateFailure === "inventory" ? product.stock + 1000 : line.qty,
    });
  }

  const total = resolvedItems.reduce((sum, i) => sum + i.price * i.requestedQty, 0);
  const orderId = `ORD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

  const order = {
    orderId,
    email,
    card: card || "4242424242424242",
    items: resolvedItems,
    total,
    status: "PROCESSING",
    simulateFailure: simulateFailure || null,
    createdAt: new Date().toISOString(),
  };
  orders.set(orderId, order);

  // Respond immediately with the order id; the pipeline runs asynchronously
  // and the frontend polls GET /api/orders/:id for the live timeline — this
  // mirrors a real checkout Lambda handing off to SQS/Step Functions instead
  // of blocking the HTTP request on the whole workflow.
  runOrderPipeline(order, productsById, emailer).catch((err) => {
    console.error("Pipeline error", err);
    order.status = "FAILED";
  });

  res.status(202).json({ orderId, status: order.status });
});

app.get("/api/orders/:orderId", (req, res) => {
  const order = orders.get(req.params.orderId);
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json({
    order: { ...order, products: undefined },
    timeline: getTimeline(req.params.orderId),
  });
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Local demo backend listening on http://localhost:${port}`);
});
