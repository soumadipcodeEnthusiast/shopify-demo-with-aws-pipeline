// In-memory stand-in for DynamoDB (Orders table + per-order pipeline events)
// in local demo mode. Real AWS mode uses actual DynamoDB — see backend/aws.

export const orders = new Map(); // orderId -> order record
export const events = new Map(); // orderId -> [{ stage, service, status, message, timestamp }]

export function appendEvent(orderId, event) {
  const list = events.get(orderId) || [];
  list.push({ ...event, timestamp: new Date().toISOString() });
  events.set(orderId, list);
}

export function getTimeline(orderId) {
  return events.get(orderId) || [];
}
