const { SFNClient, StartSyncExecutionCommand } = require("@aws-sdk/client-sfn");
const { putEvent } = require("../shared/ddb.js");

const sfn = new SFNClient({});
const MAX_RECEIVE_COUNT = Number(process.env.MAX_RECEIVE_COUNT || 3);

// Triggered by OrderProcessingQueue (SQS). Starts the Step Functions Express
// workflow synchronously: if the workflow fails, this handler throws, which
// makes SQS redeliver the message. After maxReceiveCount retries (see the
// queue's RedrivePolicy in template.yaml) SQS moves the message to the DLQ,
// where OrderDlqHandlerFunction records the terminal failure.
exports.handler = async (event) => {
  for (const record of event.Records) {
    const order = JSON.parse(record.body);
    const attempt = Number(record.attributes?.ApproximateReceiveCount || 1);
    if (attempt === 1) {
      await putEvent(order.orderId, { stage: "SQS_ENQUEUE", service: "SQS", status: "SUCCEEDED", message: "Job picked up by consumer Lambda" });
    } else {
      await putEvent(order.orderId, {
        stage: "SQS_RETRY",
        service: "SQS",
        status: "RUNNING",
        message: `Redelivery attempt ${attempt}/${MAX_RECEIVE_COUNT} after previous execution failed`,
      });
    }
    await putEvent(order.orderId, { stage: "STEP_FUNCTIONS", service: "Step Functions", status: "RUNNING", message: "State machine execution started" });

    const result = await sfn.send(
      new StartSyncExecutionCommand({
        stateMachineArn: process.env.STATE_MACHINE_ARN,
        input: JSON.stringify(order),
        name: `${order.orderId}-${Date.now()}`,
      })
    );

    if (result.status === "SUCCEEDED") {
      await putEvent(order.orderId, { stage: "STEP_FUNCTIONS", service: "Step Functions", status: "SUCCEEDED", message: "Execution completed successfully" });
    } else {
      await putEvent(order.orderId, {
        stage: "STEP_FUNCTIONS",
        service: "Step Functions",
        status: "FAILED",
        message: `Execution failed: ${result.error || result.cause || "unknown error"}`,
      });
      // Throwing lets SQS's redrive policy retry this message, then DLQ it.
      throw new Error(`Step Functions execution failed for ${order.orderId}`);
    }
  }
};
