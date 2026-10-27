"use strict";

const crypto = require("node:crypto");

const PAYMENT_EVENTS = new Map([
  ["pix_created", "pending"],
  ["order_approved", "paid"],
  ["order_rejected", "rejected"],
  ["order_refunded", "refunded"],
  ["chargeback", "charged_back"]
]);

function verifyKiwifySignature(rawBody, receivedSignature, token) {
  if (!Buffer.isBuffer(rawBody) || typeof token !== "string" || token.length === 0) {
    return false;
  }

  if (typeof receivedSignature !== "string" || !/^[a-f0-9]{40}$/.test(receivedSignature)) {
    return false;
  }

  const expected = crypto.createHmac("sha1", token).update(rawBody).digest();
  const received = Buffer.from(receivedSignature, "hex");
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

function normalizeKiwifyEvent(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const { order_id: orderId, order_status: orderStatus, webhook_event_type: eventType } = payload;
  if (
    typeof orderId !== "string" || orderId.trim().length === 0 || orderId.length > 200 ||
    typeof eventType !== "string" || eventType.trim().length === 0 || eventType.length > 80 ||
    typeof orderStatus !== "string" || orderStatus.trim().length === 0 || orderStatus.length > 80
  ) {
    return null;
  }

  return {
    orderId: orderId.trim(),
    eventType: eventType.trim(),
    orderStatus: orderStatus.trim(),
    paymentStatus: PAYMENT_EVENTS.get(eventType.trim()) || "review_required"
  };
}

function getKiwifyEventDocumentId(orderId, eventType) {
  return crypto.createHash("sha256").update(orderId + "\0" + eventType).digest("hex");
}

module.exports = {
  getKiwifyEventDocumentId,
  normalizeKiwifyEvent,
  verifyKiwifySignature
};
