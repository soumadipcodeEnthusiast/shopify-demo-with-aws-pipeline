const { randomUUID } = require("node:crypto");
const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");
const { ddb, PutCommand, putEvent } = require("../shared/ddb.js");

const sqs = new SQSClient({});
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const cors = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };

exports.handler = async (apiEvent) => {
  const body = JSON.parse(apiEvent.body || "{}");
  const { email, card, items, simulateFailure } = body;

  if (!email || !EMAIL_RE.test(email)) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "A valid email address is required." }) };
  }
  if (!Array.isArray(items) || items.length === 0) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Cart is empty." }) };
  }

  const orderId = `ORD-${randomUUID().slice(0, 8).toUpperCase()}`;
  const order = {
    orderId,
    email,
    // Mock payment only — keep just the last 4 digits, never the full number.
    cardLast4: String(card || "4242424242424242").replace(/\D/g, "").slice(-4),
    items,
    status: "PROCESSING",
    simulateFailure: simulateFailure || null,
    createdAt: new Date().toISOString(),
  };

  await ddb.send(new PutCommand({ TableName: process.env.ORDERS_TABLE, Item: order }));
  await putEvent(orderId, { stage: "CART_RECEIVED", service: "API", status: "SUCCEEDED", message: "Checkout request received" });
  await putEvent(orderId, { stage: "SQS_ENQUEUE", service: "SQS", status: "RUNNING", message: "Order job queued (order-processing-queue)" });

  await sqs.send(
    new SendMessageCommand({
      QueueUrl: process.env.ORDER_QUEUE_URL,
      MessageBody: JSON.stringify(order),
    })
  );

  return { statusCode: 202, headers: cors, body: JSON.stringify({ orderId, status: order.status }) };
};
