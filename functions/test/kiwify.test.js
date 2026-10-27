"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  getKiwifyEventDocumentId,
  normalizeKiwifyEvent,
  verifyKiwifySignature
} = require("../kiwify");

const knownToken = "kiwify-token-de-teste";
const knownBody = Buffer.from(
  '{"order_id":"9b1c2d3e-0000-4000-8000-000000000001","order_status":"paid","webhook_event_type":"order_approved"}'
);
const knownSignature = "bf18f352a4f981b91dfa3f6d8742a81080ab8c86";

test("validates the official Kiwify HMAC-SHA1 test vector", () => {
  assert.equal(verifyKiwifySignature(knownBody, knownSignature, knownToken), true);
});

test("rejects altered bodies, malformed signatures, and empty tokens", () => {
  assert.equal(verifyKiwifySignature(Buffer.from(knownBody.toString() + " "), knownSignature, knownToken), false);
  assert.equal(verifyKiwifySignature(knownBody, "not-a-signature", knownToken), false);
  assert.equal(verifyKiwifySignature(knownBody, knownSignature, ""), false);
});

test("normalizes documented payment events without trusting browser state", () => {
  assert.deepEqual(normalizeKiwifyEvent({
    order_id: "sale-123",
    order_status: "paid",
    webhook_event_type: "order_approved"
  }), {
    orderId: "sale-123",
    eventType: "order_approved",
    orderStatus: "paid",
    paymentStatus: "paid"
  });
});

test("keeps unknown signed events for review rather than granting benefits", () => {
  const event = normalizeKiwifyEvent({
    order_id: "sale-456",
    order_status: "unknown",
    webhook_event_type: "future_event"
  });

  assert.equal(event.paymentStatus, "review_required");
});

test("rejects incomplete or oversized event identifiers", () => {
  assert.equal(normalizeKiwifyEvent({ order_status: "paid", webhook_event_type: "order_approved" }), null);
  assert.equal(normalizeKiwifyEvent({
    order_id: "x".repeat(201),
    order_status: "paid",
    webhook_event_type: "order_approved"
  }), null);
});

test("generates stable idempotency keys per order and event type", () => {
  const eventId = getKiwifyEventDocumentId("sale-123", "order_approved");

  assert.equal(eventId, getKiwifyEventDocumentId("sale-123", "order_approved"));
  assert.notEqual(eventId, getKiwifyEventDocumentId("sale-123", "order_refunded"));
  assert.match(eventId, /^[a-f0-9]{64}$/);
});
