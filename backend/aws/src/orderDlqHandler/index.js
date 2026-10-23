const { ddb, UpdateCommand, putEvent } = require("../shared/ddb.js");

// Triggered by the dead-letter queue: the order-processing job failed
// repeatedly and SQS gave up redelivering it. Record the terminal state so
// the frontend's Live Order Pipeline panel reflects what actually happened.
exports.handler = async (event) => {
  for (const record of event.Records) {
    const order = JSON.parse(record.body);
    await putEvent(order.orderId, {
      stage: "SQS_DLQ",
      service: "SQS (DLQ)",
      status: "FAILED",
      message: "Max receive count reached — message moved to dead-letter queue (order-processing-dlq)",
    });
    await ddb.send(
      new UpdateCommand({
        TableName: process.env.ORDERS_TABLE,
        Key: { orderId: order.orderId },
        UpdateExpression: "SET #status = :failed",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":failed": "FAILED" },
      })
    );
  }
};
