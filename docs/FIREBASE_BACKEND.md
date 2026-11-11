# Firebase backend

Firebase Authentication and Firestore are the active cloud services for individual user data. Photo uploads and Cloud Functions are paused so the app can stay on the no-cost plan. There is no active Supabase SDK or endpoint in the app.

## Free Firebase setup

1. Enable Google sign-in and create the Firestore database in the Firebase project.
2. Set the Firebase web app values in `.env.local` using `.env.example` as the template.
3. Deploy Firestore rules from the project root with `firebase deploy --only firestore:rules`.

Cloud Storage and Cloud Functions need Firebase's pay-as-you-go plan. Until the app moves to that plan, photo uploads, Stripe billing, server-side playlist import, and callable ClassSpace/admin actions remain paused.

## Legacy data transfer

`functions/scripts/migrate-legacy-data.mjs` is an optional one-time importer. It defaults to a dry run and never edits or deletes source records. It transfers supported user tracker, ClassSpace, subscription, admin, and webhook ledger rows to Firestore, but leaves photo records and files out. It maps old account IDs by email to Firebase Auth accounts, so every person whose records should be preserved must first sign in to Firebase with the same email. If any account cannot be matched, the script stops before writing.

The importer requires temporary `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` environment variables, Firebase Admin Application Default Credentials, and `FIREBASE_PROJECT_ID`. Keep the source service key private. Review the dry-run counts, back up Firestore, then run from `functions/` with `npm run migrate:legacy:apply`. Do not decommission the source project until the imported records have been checked.

Local-first data and Firebase records remain untouched by the dry run.

## Data layout

- `user_trackers/{firebaseUid}` stores each account's complete synced app state.
- ClassSpace collections store workspaces, memberships, channels, schedule rules/overrides, attendance, messages, reactions, saved messages, and notifications.
- `user_subscriptions/{firebaseUid}` is writable only by the signed Stripe webhook. Users can read only their own entitlement record.
- Admin-only mutations and cross-user searches run in callable Functions. Firestore client rules deny direct writes to billing and admin audit collections.
- Fitness progress photos are local to the device and omitted from cloud transfer while uploads are paused.
