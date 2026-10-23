const { randomUUID } = require("node:crypto");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

async function putEvent(orderId, event) {
  const at = new Date().toISOString();
  await ddb.send(
    new PutCommand({
      TableName: process.env.ORDER_EVENTS_TABLE,
      Item: {
        orderId,
        // Sort key: ISO time keeps events ordered; the suffix stops two events
        // written in the same millisecond from overwriting each other.
        timestamp: `${at}#${randomUUID().slice(0, 8)}`,
        at,
        ...event,
      },
    })
  );
}

module.exports = { ddb, putEvent, PutCommand, GetCommand, UpdateCommand, QueryCommand, ScanCommand };
