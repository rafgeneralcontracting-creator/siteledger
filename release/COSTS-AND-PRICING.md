# Cost-based launch pricing — October 18, 2026

User selected a 3-day auto-renewing trial, then authorized setting prices from costs with room for profit. Base USD monthly company prices prepared: Starter $99, Team $199, Business $399. These are company prices, not a fee per worker. Store products and actual purchases are not enabled yet.

## What is measured

Connected Supabase organization is Pro. Live snapshot: 2 workspaces, 4 active profiles, 6 projects, 1,111 stored objects, 5,741,008,239 bytes (5.74 decimal GB / 5.35 GiB), and a 21,965,971-byte database (~22 MB). Photos account for 3.44 GB, drawings 1.40 GB, generated PDFs 0.53 GB. This is a storage snapshot, not monthly traffic or an invoice audit. Egress, AI token usage, paid compute size, support time, marketing and refund rates were not available as measured monthly bills.

Supabase Pro starts at $25/month with 100 GB storage, 250 GB uncached egress and 250 GB cached egress shared across the organization. Published overages are $0.0213/GB storage, $0.09/GB uncached egress, $0.03/GB cached egress. Included database storage is 8 GB. Shared included quotas are not granted separately to every customer. No new separate Supabase project per customer is assumed.

## Conservative per-company model

All included file storage is costed at marginal overage rates even if the shared Pro allowance absorbs it. Downloads assume 75/250/750 GB monthly for Starter/Team/Business respectively, costed entirely as uncached traffic. These are planning scenarios, not measured egress and not advertised hard limits. Backup reserve is $0.03/GB/month (budget, not a configured backup service); AI reserve is $0.10/scan (budget, not verified model-specific token billing). Support budget $10/$20/$40 and compute/operations allocation $5/$10/$20 are estimates, not existing supplier invoices. A separate $9/paid-company/month reserve models three nonconverting trials at $3 marginal cost each (25% conversion). Onboarding/support could exceed that.

Model includes 30% store commission, 1% RevenueCat allowance and a 3% refund reserve. RevenueCat's published price is free below $2,500 monthly tracked revenue, then 1% of tracked revenue; always reserving 1% is conservative. Apple's 15% Small Business rate requires approval and is not assumed active. Google's current subscription fee documentation lists 15%; actual territory/account terms must be checked. A 30% baseline protects against first-year Apple standard fees and uncertainty. Refund reserve is a planning allowance, not a prediction of fee refunds.

| Plan | Monthly price | Modeled monthly cost incl. trial reserve at 30% fee | Contribution before fixed costs | At 15% fee |
|---|---:|---:|---:|---:|
| Starter | $99 | $67.69 | $31.31 (32%) | $46.16 (47%) |
| Team | $199 | $139.29 | $59.71 (30%) | $89.56 (45%) |
| Business | $399 | $294.99 | $104.02 (26%) | $163.87 (41%) |

This is contribution, not net profit. It excludes development payroll, marketing/customer acquisition, taxes and other general overhead. A $200 shared monthly operating reserve plus a separate illustrative $2,000 maintenance/development budget requires about 71 Starter, 37 Team or 22 Business customers at the conservative commission case, before acquisition costs. The $200 is an adjustable operating reserve that includes the $25 base plan; actual operating spend may differ. It is not another measured bill.

At 10 Team companies: revenue $1,990, modeled variable cost $1,392.90, contribution $597.10; after a $200 shared reserve, $397.10 remains before development, marketing and tax. Including the illustrative $2,000 development budget produces a loss. At 50 Team companies, contribution is ~$2,985.50; after $2,200 shared/development budget, ~$785.50 remains before marketing and tax. Higher customer volume is not itself proof of profit because support and infrastructure may scale nonlinearly.

## Usage sensitivity and controls

Every extra 100 GB of uncached downloads costs about $9. Starter's modeled $31 contribution is exhausted by roughly 348 additional GB/month at this rate. No plan should promise unlimited downloads or AI. Enforce advertised seats, active projects, stored-file space and AI quotas before enabling purchases; monitor per-company download traffic and abnormal sharing before deciding any public download allowance. Unconverted trials should have small upload/AI ceilings rather than full Business allowances. Retained/archived files still count toward stored bytes. No automatic usage overage charges without separate customer consent.

Compress field photos, avoid repeatedly generating the same PDFs, reuse cached drawing bytes and expire unused review links. File backup/restore still needs provisioning and verification; a budget line is not a backup. Compare the model against actual Supabase/OpenAI/RevenueCat invoices and support time after the first billing cycle; do not quietly raise already-consented subscription prices.

## Sources (checked October 18, 2026)

- https://supabase.com/pricing
- https://www.revenuecat.com/pricing
- https://developer.apple.com/app-store/subscriptions/
- https://developer.apple.com/app-store/small-business-program/
- https://support.google.com/googleplay/android-developer/answer/112622
- https://developer.apple.com/help/app-store-connect/manage-subscriptions/set-up-introductory-offers-for-auto-renewable-subscriptions
- https://support.google.com/googleplay/android-developer/answer/140504

Reproduce base costs with `node scripts/cost-model.mjs --write`; the JSON includes the trial reserve explicitly. This is planning, not a guarantee of profitability or an audit of company finances.

## Additional provider issue found during code review

The current weather function uses Open-Meteo and OpenStreetMap Nominatim. Open-Meteo's published free access is for non-commercial/prototype use; a commercial license/customer key is needed for the paid launch, and historical weather requires Professional or higher. The public pricing page retrieved in this session did not expose a reliable numeric subscription price, so no third-party price is presented as a verified invoice. Reserve $100/month of the $200 shared operating budget for weather/geocoding until the actual commercial quote is confirmed; revise the model if the quote exceeds that. Nominatim requires attribution and an absolute 1 request/second cap on its public service; use a commercially supported geocoder or compliant global throttling before public scale. These requirements were discovered from the actual deployed weather source, not hypothetical services.

Sources: https://open-meteo.com/en/pricing and https://operations.osmfoundation.org/policies/nominatim/
