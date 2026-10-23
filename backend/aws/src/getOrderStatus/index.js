const { ddb, GetCommand, QueryCommand } = require("../shared/ddb.js");

const cors = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };

exports.handler = async (apiEvent) => {
  const orderId = apiEvent.pathParameters?.orderId;

  const { Item: order } = await ddb.send(new GetCommand({ TableName: process.env.ORDERS_TABLE, Key: { orderId } }));
  if (!order) {
    return { statusCode: 404, headers: cors, body: JSON.stringify({ error: "Order not found" }) };
  }

  const { Items: timeline } = await ddb.send(
    new QueryCommand({
      TableName: process.env.ORDER_EVENTS_TABLE,
      KeyConditionExpression: "orderId = :orderId",
      ExpressionAttributeValues: { ":orderId": orderId },
      ScanIndexForward: true,
    })
  );

  return { statusCode: 200, headers: cors, body: JSON.stringify({ order, timeline: timeline || [] }) };
};
