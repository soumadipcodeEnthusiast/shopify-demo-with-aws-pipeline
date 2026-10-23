const { putEvent } = require("../shared/ddb.js");

// Mock payment processor — no real charge, no real payment network call.
exports.handler = async (event) => {
  const { orderId, cardLast4, simulateFailure } = event;
  await putEvent(orderId, { stage: "PROCESS_PAYMENT", service: "Step Functions / Lambda", status: "RUNNING", message: "Charging mock payment method" });

  const declined = simulateFailure === "payment" || cardLast4 === "0000";
  if (declined) {
    await putEvent(orderId, { stage: "PROCESS_PAYMENT", service: "Step Functions / Lambda", status: "FAILED", message: "Mock payment declined" });
    const err = new Error("PaymentDeclined");
    err.name = "PaymentError";
    throw err;
  }

  await putEvent(orderId, { stage: "PROCESS_PAYMENT", service: "Step Functions / Lambda", status: "SUCCEEDED", message: "Payment authorized and captured" });
  return event;
};
