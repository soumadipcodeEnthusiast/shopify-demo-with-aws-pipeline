const { ddb, GetCommand, UpdateCommand, putEvent } = require("../shared/ddb.js");

exports.handler = async (event) => {
  const { orderId, items } = event;
  await putEvent(orderId, { stage: "CREATE_ORDER", service: "Step Functions / Lambda", status: "RUNNING", message: "Persisting order record" });

  const enrichedItems = [];
  let total = 0;
  for (const item of items) {
    const { Item: product } = await ddb.send(new GetCommand({ TableName: process.env.PRODUCTS_TABLE, Key: { id: item.id } }));
    const price = product?.price ?? 0;
    total += price * item.qty;
    enrichedItems.push({ id: item.id, name: product?.name ?? item.id, qty: item.qty, price });
  }

  await ddb.send(
    new UpdateCommand({
      TableName: process.env.ORDERS_TABLE,
      Key: { orderId },
      // status, items and total are all DynamoDB reserved words — alias them.
      UpdateExpression: "SET #status = :confirmed, #items = :items, #total = :total",
      ExpressionAttributeNames: { "#status": "status", "#items": "items", "#total": "total" },
      ExpressionAttributeValues: { ":confirmed": "CONFIRMED", ":items": enrichedItems, ":total": total },
    })
  );

  await putEvent(orderId, { stage: "CREATE_ORDER", service: "Step Functions / Lambda", status: "SUCCEEDED", message: `Order ${orderId} persisted with status CONFIRMED` });
  return { ...event, items: enrichedItems, total };
};
