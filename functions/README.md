# Kiwify webhook receiver

This Firebase Functions endpoint verifies Kiwify's documented HMAC-SHA1 signature over the exact raw request body and records an idempotent, PII-minimized event in the `kiwifyWebhookEvents` collection.

It intentionally does not mark a site order as paid, associate a sale with a Firebase user, or deliver an account, credit, or access. The current site has no Firebase Auth client, product records, order records, Kiwify product mapping, or delivery inventory. A verified webhook alone does not identify which authenticated site user should receive a benefit.

## Configure and deploy

1. Install the Firebase CLI and authenticate it with the Firebase project owner account.
2. Set `KIWIFY_WEBHOOK_TOKEN` to the same long, random token configured for the Kiwify webhook:

   ```powershell
   firebase functions:secrets:set KIWIFY_WEBHOOK_TOKEN --project hipenox
   ```

3. Install and test the function package:

   ```powershell
   cd functions
   npm install
   npm test
   cd ..
   ```

4. Deploy only the webhook function:

   ```powershell
   firebase deploy --only functions:kiwifyWebhook --project hipenox
   ```

5. In Kiwify, configure the deployed HTTPS function URL directly (the endpoint does not redirect), use the same webhook token, and enable the payment events needed by the store: Pix generated, purchase approved, purchase rejected, purchase refunded, and chargeback.

The endpoint is in `southamerica-east1`. Use the HTTPS URL shown by the Firebase CLI after deployment as the webhook URL; do not guess or add a redirect.

Kiwify's official **Testar Webhook** action sends fictitious order identifiers. It can validate receipt and signature handling, but it does not prove purchase-to-user association or fulfillment.

## Required follow-up before accepting purchases

- Connect the actual Firebase Authentication client and confirm the existing sign-in flow and verified-user policy.
- Provide the existing Firestore product, order, inventory, entitlement, and admin schemas so order creation and customer views can use the current panel without replacing it.
- Configure each product's real Kiwify checkout URL and Kiwify product ID.
- Confirm a Kiwify-supported checkout reference mechanism that returns the site order reference in the signed webhook. The documented webhook receiver contract alone is not enough to safely associate a payment with a Firebase UID.
- Merge explicit deny-client-write rules for payment/order data into the project's existing Firestore rules before deployment. No Firestore rules were found in this workspace, so this change does not replace unknown production rules.
- Use a supported entitlement delivery mechanism. Do not put third-party game credentials in public product data or client-readable event documents.

No Kiwify API credentials are required for receiving signed webhooks. If server-side sale lookups are added later, store the official Kiwify API credentials in Firebase Secret Manager and follow the current Kiwify OAuth and sales API documentation.
