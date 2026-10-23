import { appendEvent } from "../store.js";

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// Simulates an SQS consumer retrying a failed job up to maxReceiveCount
// times before the message is moved to the dead-letter queue — mirroring
// the redrive policy on the real AWS queue (see backend/aws/template.yaml).
async function simulateSqsRetryThenDlq(orderId, reason, maxReceiveCount = 3) {
  for (let attempt = 1; attempt <= maxReceiveCount; attempt++) {
    appendEvent(orderId, {
      stage: "SQS_RETRY",
      service: "SQS",
      status: "RUNNING",
      message: `Retry attempt ${attempt}/${maxReceiveCount} after failure: ${reason}`,
    });
    await delay(300);
  }
  appendEvent(orderId, {
    stage: "SQS_DLQ",
    service: "SQS (DLQ)",
    status: "FAILED",
    message: "Max receive count reached — message moved to dead-letter queue (order-processing-dlq)",
  });
}

async function sendConfirmationEmail(order, emailer) {
  const lines = order.items
    .map((i) => `  - ${i.name} x${i.requestedQty} ($${(i.price * i.requestedQty).toFixed(2)})`)
    .join("\n");
  const body =
    `Order ${order.orderId} confirmed.\n\n` +
    `Items:\n${lines}\n\n` +
    `Total: $${order.total.toFixed(2)}\n` +
    `Status: ${order.status}`;

  if (!emailer) {
    return { sent: false, reason: "SMTP not configured" };
  }
  await emailer.sendMail({
    from: process.env.SMTP_FROM || "orders@example.com",
    to: order.email,
    subject: `Order confirmation — ${order.orderId}`,
    text: body,
  });
  return { sent: true };
}

// Drives every stage of the pipeline for one order and records a timestamped
// event per stage so the frontend's Live Order Pipeline panel can render it.
// This function is the local-demo stand-in for: SQS consumer -> Step
// Functions state machine -> SNS publish -> SES notification Lambda.
export async function runOrderPipeline(order, productsById, emailer) {
  const orderId = order.orderId;

  appendEvent(orderId, { stage: "CART_RECEIVED", service: "API", status: "SUCCEEDED", message: "Checkout request received" });

  appendEvent(orderId, { stage: "SQS_ENQUEUE", service: "SQS", status: "RUNNING", message: "Order job queued (order-processing-queue)" });
  await delay(350);
  appendEvent(orderId, { stage: "SQS_ENQUEUE", service: "SQS", status: "SUCCEEDED", message: "Job picked up by consumer Lambda" });

  appendEvent(orderId, { stage: "STEP_FUNCTIONS", service: "Step Functions", status: "RUNNING", message: "State machine execution started" });
  await delay(200);

  appendEvent(orderId, { stage: "VALIDATE_INVENTORY", service: "Step Functions / Lambda", status: "RUNNING", message: "Checking stock for all line items" });
  await delay(500);

  const insufficient = order.items.find((i) => i.requestedQty > productsById.get(i.id).stock);
  if (insufficient) {
    appendEvent(orderId, {
      stage: "VALIDATE_INVENTORY",
      service: "Step Functions / Lambda",
      status: "FAILED",
      message: `Insufficient stock for ${insufficient.name} (requested ${insufficient.requestedQty}, available ${productsById.get(insufficient.id).stock})`,
    });
    await simulateSqsRetryThenDlq(orderId, "inventory validation failed");
    appendEvent(orderId, { stage: "STEP_FUNCTIONS", service: "Step Functions", status: "FAILED", message: "Execution failed before reservation — no compensation required" });
    order.status = "FAILED";
    return;
  }
  appendEvent(orderId, { stage: "VALIDATE_INVENTORY", service: "Step Functions / Lambda", status: "SUCCEEDED", message: "All line items in stock" });

  appendEvent(orderId, { stage: "RESERVE_INVENTORY", service: "Step Functions / Lambda", status: "RUNNING", message: "Reserving stock" });
  await delay(400);
  for (const item of order.items) {
    productsById.get(item.id).stock -= item.requestedQty;
  }
  appendEvent(orderId, { stage: "RESERVE_INVENTORY", service: "Step Functions / Lambda", status: "SUCCEEDED", message: "Stock reserved for this order" });

  appendEvent(orderId, { stage: "PROCESS_PAYMENT", service: "Step Functions / Lambda", status: "RUNNING", message: "Charging mock payment method" });
  await delay(600);
  const paymentFails = order.simulateFailure === "payment" || order.card?.endsWith("0000");
  if (paymentFails) {
    appendEvent(orderId, { stage: "PROCESS_PAYMENT", service: "Step Functions / Lambda", status: "FAILED", message: "Mock payment declined" });

    appendEvent(orderId, { stage: "COMPENSATE_RELEASE_INVENTORY", service: "Step Functions / Lambda", status: "RUNNING", message: "Releasing reserved stock (compensation)" });
    for (const item of order.items) {
      productsById.get(item.id).stock += item.requestedQty;
    }
    await delay(300);
    appendEvent(orderId, { stage: "COMPENSATE_RELEASE_INVENTORY", service: "Step Functions / Lambda", status: "SUCCEEDED", message: "Reserved stock released back to inventory" });

    await simulateSqsRetryThenDlq(orderId, "payment declined");
    appendEvent(orderId, { stage: "STEP_FUNCTIONS", service: "Step Functions", status: "FAILED", message: "Execution failed at payment stage" });
    order.status = "FAILED";
    return;
  }
  appendEvent(orderId, { stage: "PROCESS_PAYMENT", service: "Step Functions / Lambda", status: "SUCCEEDED", message: "Payment authorized and captured" });

  appendEvent(orderId, { stage: "CREATE_ORDER", service: "Step Functions / Lambda", status: "RUNNING", message: "Persisting order record" });
  await delay(300);
  order.status = "CONFIRMED";
  appendEvent(orderId, { stage: "CREATE_ORDER", service: "Step Functions / Lambda", status: "SUCCEEDED", message: `Order ${orderId} persisted with status CONFIRMED` });

  appendEvent(orderId, { stage: "SNS_PUBLISH", service: "SNS", status: "RUNNING", message: "Publishing order.confirmed event to order-events topic" });
  await delay(250);
  appendEvent(orderId, { stage: "SNS_PUBLISH", service: "SNS", status: "SUCCEEDED", message: "Event published" });

  appendEvent(orderId, { stage: "EMAIL_SENT", service: "SNS subscriber / Email", status: "RUNNING", message: "Notification handler invoked" });
  const result = await sendConfirmationEmail(order, emailer);
  if (result.sent) {
    appendEvent(orderId, { stage: "EMAIL_SENT", service: "SNS subscriber / Email", status: "SUCCEEDED", message: `Confirmation email sent to ${order.email}` });
  } else {
    appendEvent(orderId, {
      stage: "EMAIL_SENT",
      service: "SNS subscriber / Email",
      status: "SKIPPED",
      message: `Email not sent — ${result.reason}. Configure SMTP_* in backend/local-server/.env to enable real sending.`,
    });
  }

  appendEvent(orderId, { stage: "STEP_FUNCTIONS", service: "Step Functions", status: "SUCCEEDED", message: "Execution completed successfully" });
}
