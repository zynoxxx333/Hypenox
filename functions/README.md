# Kiwify webhook receiver

This Firebase Functions endpoint verifies Kiwify's documented HMAC-SHA1 signature over the exact raw request body and records an idempotent, PII-minimized event in the `kiwifyWebhookEvents` collection.

The website now uses Firebase Authentication for the administrator and Firestore for public product metadata. Customers do not need an account to browse the public catalog. The product checkout button opens the Kiwify URL saved with the product.

The webhook still does not mark a site order as paid, associate a sale with a product or buyer, or deliver a product, credit, account, or access. A verified webhook alone does not establish a safe link between a purchase and the site catalog. Do not treat checkout return pages or webhook events as proof of delivery.

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

## Site and administrator setup

- Enable **Email/Password** in Firebase Authentication and create/verify `tronux27@gmail.com` in **Authentication → Users** if it does not already exist. The client does not provide sign-up.
- Add the exact Vercel production domain in **Authentication → Settings → Authorized domains** if it is not already present.
- Type `x26admin` in the site search and submit to reveal the administrator sign-in form. The shortcut is only a UI entry; the verified Firebase account and Firestore rules enforce access.
- Published `products` documents are public and include only display metadata and an optional HTTPS checkout URL. Never store game credentials, recovery codes, buyer PII, or private delivery data in that collection.
- Rules are defined in the root `firestore.rules`; deploy only with `firebase deploy --only firestore:rules --project hipenox`.

## Required follow-up for automated fulfillment

- Add the real Kiwify checkout URL to each product.
- Confirm a Kiwify-supported checkout reference mechanism that returns a trusted site order reference in the signed webhook. The current event receiver does not associate products or buyers.
- Implement server-side order creation, transaction idempotency, purchase/refund state transitions, and a delivery mechanism before advertising automatic fulfillment.
- Use a supported, secure entitlement delivery mechanism. Do not put third-party game credentials in public product data or client-readable event documents.

No Kiwify API credentials are required for receiving signed webhooks. If server-side sale lookups are added later, store the official Kiwify API credentials in Firebase Secret Manager and follow the current Kiwify OAuth and sales API documentation.
