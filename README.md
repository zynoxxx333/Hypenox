# HIPENOX

## Firebase

The static website uses the Firebase Web SDK from Google's CDN. Its web app
configuration is public client configuration; no private service-account key or
payment secret belongs in the frontend.

The project uses the existing Firestore `(default)` Standard database in
`southamerica-east1`. The `products` collection contains public display data
only. Published products can be read by visitors; writes are limited by
`firestore.rules` to the verified administrator `tronux27@gmail.com`. Customer
accounts are not required to browse the catalog.

### Prepare the administrator

1. In Firebase Console, open **Authentication → Sign-in method** and keep
   **Email/Password** enabled.
2. In **Authentication → Users**, create `tronux27@gmail.com` if it does not
   already exist, then verify its email before signing in to the site.
3. In **Authentication → Settings → Authorized domains**, ensure the site's
   exact Vercel production domain is present. Add any custom domain used for the
   site as well; do not include a protocol or port.
4. On the site, type `x26admin` into the search field and submit it. This only
   reveals the login form; Firebase Authentication and Firestore rules enforce
   access.

There is no public administrator sign-up. The panel can publish products,
provide a Kiwify checkout URL, mark a product sold, or hide it from the public
catalog. Do not store game passwords, recovery codes, buyer details, or other
credentials in product documents.

### Deploy rules

The temporary open Firestore rules were replaced with the restricted rules in
this repository. To publish future rule changes:

```powershell
firebase deploy --only firestore:rules --project hipenox
```

The public catalog reads only documents where `published` is `true`. Unknown
collections, including webhook event records, remain inaccessible to clients.

## Kiwify status

Product checkout buttons open the configured Kiwify URL. The Cloud Function
verifies and records signed Kiwify webhook events, but it does not yet associate
an event with a site product or buyer and does not automatically mark orders
paid or deliver purchases. Do not advertise automatic fulfillment until a
verified order-association and delivery workflow is implemented and tested.