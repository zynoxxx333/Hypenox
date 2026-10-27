"use strict";

const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { initializeApp } = require("firebase-admin/app");
const {
  getKiwifyEventDocumentId,
  normalizeKiwifyEvent,
  verifyKiwifySignature
} = require("./kiwify");

initializeApp();

const db = getFirestore();
const kiwifyWebhookToken = defineSecret("KIWIFY_WEBHOOK_TOKEN");

exports.kiwifyWebhook = onRequest(
  {
    region: "southamerica-east1",
    secrets: [kiwifyWebhookToken],
    maxInstances: 10
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.set("Allow", "POST").status(405).send("Method not allowed");
      return;
    }

    const contentType = (req.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (contentType !== "application/json") {
      res.status(415).send("Content-Type must be application/json");
      return;
    }

    const rawBody = req.rawBody;
    if (!Buffer.isBuffer(rawBody) || rawBody.length === 0 || rawBody.length > 1024 * 1024) {
      res.status(400).send("Invalid request body");
      return;
    }

    const signature = typeof req.query.signature === "string" ? req.query.signature : "";
    if (!verifyKiwifySignature(rawBody, signature, kiwifyWebhookToken.value())) {
      res.status(401).send("Invalid webhook signature");
      return;
    }

    let payload;
    try {
      payload = JSON.parse(rawBody.toString("utf8"));
    } catch {
      res.status(400).send("Invalid JSON payload");
      return;
    }

    const event = normalizeKiwifyEvent(payload);
    if (!event) {
      res.status(400).send("Missing or invalid Kiwify event fields");
      return;
    }

    const documentId = getKiwifyEventDocumentId(event.orderId, event.eventType);
    const eventRef = db.collection("kiwifyWebhookEvents").doc(documentId);

    try {
      await db.runTransaction(async (transaction) => {
        const eventSnapshot = await transaction.get(eventRef);
        const receivedAt = Timestamp.now();

        if (eventSnapshot.exists) {
          transaction.update(eventRef, {
            deliveryCount: FieldValue.increment(1),
            lastReceivedAt: receivedAt
          });
          return;
        }

        transaction.create(eventRef, {
          provider: "kiwify",
          orderId: event.orderId,
          eventType: event.eventType,
          reportedOrderStatus: event.orderStatus,
          observedPaymentStatus: event.paymentStatus,
          associationStatus: "unmatched",
          fulfillmentStatus: "not_started",
          deliveryCount: 1,
          firstReceivedAt: receivedAt,
          lastReceivedAt: receivedAt
        });
      });

      res.status(200).send("Webhook received");
    } catch (error) {
      logger.error("Failed to persist a verified Kiwify webhook", {
        eventType: event.eventType
      });
      res.status(500).send("Webhook could not be persisted");
    }
  }
);
