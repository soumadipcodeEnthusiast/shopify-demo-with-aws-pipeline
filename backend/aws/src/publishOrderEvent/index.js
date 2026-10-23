const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");
const { putEvent } = require("../shared/ddb.js");

const sns = new SNSClient({});

exports.handler = async (event) => {
  const { orderId } = event;
  await putEvent(orderId, { stage: "SNS_PUBLISH", service: "SNS", status: "RUNNING", message: "Publishing order.confirmed event to order-events topic" });

  await sns.send(
    new PublishCommand({
      TopicArn: process.env.ORDER_EVENTS_TOPIC_ARN,
      Message: JSON.stringify(event),
      MessageAttributes: {
        eventType: { DataType: "String", StringValue: "order.confirmed" },
      },
    })
  );

  await putEvent(orderId, { stage: "SNS_PUBLISH", service: "SNS", status: "SUCCEEDED", message: "Event published" });
  return event;
};
