# Hamit Construction Management release status — 2026-10-18

Engineering candidate; NOT ready to submit or charge subscribers yet. User chose Hamit branding under Hamit Development Inc., a 3-day auto-renewing trial, and authorized cost-based pricing. Free pilot is superseded.

## Prepared

- Latest main drawing downloads/sharing merged into launch branch; previous HTML merge conflict resolved.
- Hamit Construction Management name (29 characters), H monogram icons, native display names, bundle/package ID `com.hamitdevelopment.constructionmanagement`, store listing drafts.
- iOS/Android installed asset builds with local PDF tools, camera, share sheet, session refresh and safe areas.
- Monthly company plans: Starter $99 / Team $199 / Business $399, with explicit cost model, measured storage snapshot and conservative fee/support/trial reserves. Prices are not live store products.
- Native subscription UI, store-localized price display, verified eligibility before advertising a 3-day free trial, restore and management links. Empty SDK keys deliberately prevent purchases. Account creation does not start a trial.
- Service-verified RevenueCat subscriber normalization and webhook endpoint source. Random owner-only billing identities; no browser write access to entitlements. Production rejects sandbox receipts, invalid expiry and unsupported products/stores.
- Public privacy/support/terms/deletion HTML and web deletion form; in-app Account & subscription settings. Password verification and fresh server session required before recording deletion. Private request queue and rollback-tested isolation/idempotency. This initiates asynchronous deletion; it is NOT an automatic deletion processor.
- Offline drawing records scoped to account/company; offline cache cleared before sign-out. Existing legacy unscoped records are not returned to another user.
- Authenticated data/storage subscription policies prepared behind a server activation switch. Existing team access is not changed by billing while store setup remains incomplete.
- Seat/project/AI quota guards and conservative storage quota checks prepared/tested. Storage requires atomic reservations/concurrency testing before a strict cap can be advertised. Download traffic needs monitoring and abuse protection; internal cost scenarios are not enforced egress quotas.
- Source snapshots and hardening for authenticated Edge Functions: active company/subscription check, explicit project/report/feature checks for privileged PDF/weather endpoints, image size limit and OpenAI `store:false`. These modifications must pass deployment/runtime tests before replacing production functions.
- Anonymous execution revoked for seven previously exposed elevated functions; profile guard prevents admin self-promotion to owner or cross-company reassignment. Intentional authenticated elevated helper warnings remain documented.

## Live backend changes in this session

`schema/hamit-release-services.sql` applied successfully; rollback-only fixture passed request privacy/idempotency, billing-owner isolation, admin self-promotion prevention, paid/disabled access and denied client billing writes. Subscription enforcement remains OFF. The new billing-sync endpoint is deployed and fails closed without RevenueCat credentials. Existing authenticated Edge Function replacements remain prepared, not deployed. No real account or project was deleted. Quota SQL application must be verified in database before claiming deployed; a tool request-state error occurred on the first attempt.

## Required before submission

1. Finish Apple and Google organization accounts, legal/paid-app agreements, tax/bank details. Confirm Hamit name availability by creating app records; public search found no indexed exact-name app match but does not reserve a name or establish trademark rights.
2. Create store products/offers, connect RevenueCat, supply PUBLIC SDK keys and server-only secrets. Run real sandbox trial/renew/cancel/restore/refund tests in an isolated test environment. Current production verification rejects sandbox purchases by design.
3. Test conditional entitlement reconciliation under concurrent webhooks and purchase-transfer isolation. Finish hard quotas/reservations, trial upload limits, tenant egress monitoring and abuse controls. Only enable billing enforcement after the end-to-end purchase path is proven; preserve authorized internal company access explicitly.
4. Assign deletion operations ownership/timeframe, show that timeframe to users, and prove actual account/workspace deletion, stale-token denial, retained shared-record handling and file cleanup using synthetic data. A queue alone is not a completed deletion service.
5. Publish and verify public policy URLs after retention/support details are approved. Finish store privacy/Data Safety forms from the actual providers. Draft policy names Supabase, optional OpenAI processing, mailbox providers and subscription processing. Verify retention/backups/logs; never assume database backups include file contents.
6. Configure commercial weather service before monetization: existing Open-Meteo prototype endpoints are not commercial licensing. Historical weather requires the appropriate paid plan. Add provider attribution and production geocoding/rate controls. These costs belong in shared overhead; see cost notes.
7. Enable Supabase leaked-password protection in dashboard. Review remaining intentional authenticated elevated functions and public token review endpoints, and verify backup + file restore. Advisor warnings are not claimed cleared merely because RLS exists.
8. Signed iOS archive/TestFlight, signed Android bundle/internal testing, actual phone/tablet QA, native screenshots and review company with synthetic project data. No reviewer credentials or real customer data in source control.

## Validation

Local mobile bundle build and cap sync pass. Application/drawing/PDF/download tests and subscription normalization/cost tests pass. Production dependency audit reported zero vulnerabilities. Rollback-only database fixtures pass access/deletion and Starter project/storage/AI quota scenarios. No store transaction, signed release or real-device pass is claimed.

Local Playwright visual QA was attempted but browser installation returned a truncated download; browser screenshots were NOT verified. Re-run policy/deletion UI checks in an available browser before publishing. Prior October 9 native compilation applies to the earlier RAF candidate, not proof that this Hamit/RevenueCat candidate compiles; inspect new CI native artifacts.

## Build

```
npm ci --ignore-scripts
npm run build:mobile
npm test
npx cap sync
```

Use Node 24, JDK 21/Android SDK 36 and current Xcode. Distribution credentials/keystores stay out of source control. Mobile CI only creates unsigned/test candidates.
