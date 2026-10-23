const { ddb, GetCommand, putEvent } = require("../shared/ddb.js");

exports.handler = async (event) => {
  const { orderId, items } = event;
  await putEvent(orderId, { stage: "VALIDATE_INVENTORY", service: "Step Functions / Lambda", status: "RUNNING", message: "Checking stock for all line items" });

  for (const item of items) {
    const result = await ddb.send(new GetCommand({ TableName: process.env.PRODUCTS_TABLE, Key: { id: item.id } }));
    const product = result.Item;
    if (!product || product.stock < item.qty) {
      const available = product ? product.stock : 0;
      await putEvent(orderId, {
        stage: "VALIDATE_INVENTORY",
        service: "Step Functions / Lambda",
        status: "FAILED",
        message: `Insufficient stock for ${item.id} (requested ${item.qty}, available ${available})`,
      });
      const err = new Error("InventoryUnavailable");
      err.name = "InventoryError";
      throw err;
    }
  }

  await putEvent(orderId, { stage: "VALIDATE_INVENTORY", service: "Step Functions / Lambda", status: "SUCCEEDED", message: "All line items in stock" });
  return event;
};
