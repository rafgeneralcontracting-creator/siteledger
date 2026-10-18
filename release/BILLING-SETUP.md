# Hamit subscription setup — 2026-10-18

User instruction: 3-day trial that rolls into a subscription unless cancelled. Free pilot was explicitly withdrawn. User authorized cost-based pricing decisions.

## Prepared plans (one company, monthly, USD base price)

| Plan | Price | Members | Active projects | Stored files | AI scans/month |
|---|---:|---:|---:|---:|---:|
| Starter | $99 | 5 | 3 | 25 GB | 20 |
| Team | $199 | 15 | 10 | 100 GB | 50 |
| Business | $399 | 30 | 25 | 250 GB | 100 |

No automatic overage charges. Limits must be enforced and tested before sales are enabled. Download figures in cost-model.json are internal costing scenarios, not advertised contractual quotas or measured egress.

## Store / RevenueCat configuration still required

1. Finish organization enrollment under Hamit Development Inc.; confirm app name availability by creating app records. Bundle/package ID prepared: `com.hamitdevelopment.constructionmanagement`. Check no earlier build was submitted under another bundle ID before reserving this one.
2. Create one Apple subscription group with monthly products `hamit_starter_monthly`, `hamit_team_monthly`, `hamit_business_monthly`. Set US prices $99/$199/$399 or the nearest permitted store price, enable the 3-day free introductory offer for eligible subscribers. Put tiers in upgrade/downgrade order. Do not offer another trial when a customer changes tiers in the same group.
3. Create equivalent Google auto-renewing monthly subscriptions, base plan `monthly`, 3-day free-trial acquisition offer. Store eligibility must prevent repeat trials. No annual commitment.
4. Connect both apps to RevenueCat. Map all three products to entitlement `company_access`; offering must contain the three monthly packages. Disable automatic transfer of purchases between company billing identities unless the verified support transfer process is used; never merge two companies because a device changed accounts.
5. Add the two PUBLIC platform SDK keys to release/billing-config.json. Never add a RevenueCat secret key to the client. Store products supply localized checkout prices; configured USD prices are base commercial prices.
6. Set `REVENUECAT_SECRET_KEY` and a long random `REVENUECAT_WEBHOOK_AUTH` in Supabase function secrets. Configure an authenticated webhook to `https://zgigfgtujebjvoehbrar.supabase.co/functions/v1/billing-sync`. Include the exact Authorization header value from the secret. The function validates that header itself and must be deployed with gateway JWT verification off for webhook delivery. Client requests independently validate their Supabase JWT and active owner profile. Without secrets it fails closed (503); it never fabricates a trial.
7. Configure sandbox verification in a separate test project before production. Production normalization deliberately rejects sandbox subscriptions, unsupported products, unsupported stores and invalid expiry dates. A real sandbox trial/renewal/cancel/restore/refund cycle is a launch gate, not satisfied by mocked normalization tests.
8. Verify independent company isolation, restore on a new device, trial eligibility, pending purchase, billing retry, cancellation without early revocation, expiry and refunds. Authoritative RevenueCat state is fetched for every webhook; client receipts/status are not trusted. Conditional verified-at writes prevent a request started earlier from overwriting a later reconciliation. Test concurrent deliveries, clock skew and purchase transfers in the sandbox; repeated webhook deliveries re-fetch current state.
9. Enroll in Apple's Small Business Program if eligible; 15% is not assumed approved. Costing uses 30% baseline and a 15% sensitivity case. Check actual Google fee terms for launch territories.
10. Finish quota enforcement, deploy hardened functions, confirm backup/restore, monitor the deletion queue, publish policy URLs, finish device QA and paid-app agreements. Only then enable `release_controls.billing_enforced`. Current internal team access remains unchanged while accounts and products are being set up. No new company has an automatic trial yet.

## Why a billing identity exists

Only an active owner can obtain a random company billing ID. Staff cannot manage billing and do not purchase their own subscriptions. The webhook resolves this random ID through a service-only table; it cannot accept an arbitrary organization supplied by a client. Entitlement expiry is checked server-side. The base company/project permission checks remain in place.

## Deletion and subscription cancellation

Submitting a deletion request does not cancel Apple/Google billing. The app and public page explicitly tell the user to cancel at the store. No employee may cancel a whole company's subscription simply by deleting their individual login.
