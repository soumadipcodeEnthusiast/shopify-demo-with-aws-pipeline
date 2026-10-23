const { ddb, UpdateCommand, putEvent } = require("../shared/ddb.js");

// Called twice from the state machine with different `action` values:
// "reserve" after inventory is validated, and "release" as compensation if
// a later step (payment, order creation) fails after stock was reserved.
exports.handler = async (event) => {
  const { orderId, items, action = "reserve" } = event;
  const isRelease = action === "release";

  const stage = isRelease ? "COMPENSATE_RELEASE_INVENTORY" : "RESERVE_INVENTORY";
  await putEvent(orderId, {
    stage,
    service: "Step Functions / Lambda",
    status: "RUNNING",
    message: isRelease ? "Releasing reserved stock (compensation)" : "Reserving stock",
  });

  for (const item of items) {
    const delta = isRelease ? item.qty : -item.qty;
    try {
      await ddb.send(
        new UpdateCommand({
          TableName: process.env.PRODUCTS_TABLE,
          Key: { id: item.id },
          UpdateExpression: "SET stock = stock + :delta",
          ConditionExpression: isRelease ? undefined : "stock >= :qty",
          ExpressionAttributeValues: isRelease ? { ":delta": delta } : { ":delta": delta, ":qty": item.qty },
        })
      );
    } catch (err) {
      if (!isRelease) {
        await putEvent(orderId, { stage, service: "Step Functions / Lambda", status: "FAILED", message: `Could not reserve stock for ${item.id}` });
        const e = new Error("ReservationFailed");
        e.name = "InventoryError";
        throw e;
      }
      throw err;
    }
  }

  await putEvent(orderId, {
    stage,
    service: "Step Functions / Lambda",
    status: "SUCCEEDED",
    message: isRelease ? "Reserved stock released back to inventory" : "Stock reserved for this order",
  });
  return event;
};
