# Next release: estimates, invoices and AI

User explicitly chose to finish the existing launch first on 2026-10-18. Do not add these modules to first-launch scope or advertise them as available.

## Estimate and invoice workflow

Moderate implementation scope: company clients and addresses, project-linked line items, quantity/unit/rate, labor/material breakdown, overhead/profit, optional tax, versioned proposals, PDF output and estimate-to-invoice conversion. Store money in integer minor units, calculate totals server-side, and snapshot client/line-item/tax details when issuing a document. Use tenant-specific numbering and role permissions. Drafts can be revised; issued financial records require revision/void/credit workflows. Deposits, partial payments, retainage and change orders need explicit treatment, especially for construction pay applications. Invoice status must come from actual payments or an authorized manual record, never from opening an email or PDF.

QuickBooks is already used by the owner. Decide whether this app drafts and syncs into QuickBooks or owns separate invoices before implementing accounting. The ChatGPT QuickBooks connector is not an embedded integration for every SaaS customer. An embedded integration needs its own Intuit app/OAuth, per-company tokens, account mappings, idempotent sync, webhook/reconciliation and disconnect/export behavior. Online payment collection is a separate merchant integration; never mix contractor-client invoice payments with Hamit's app subscription billing.

## AI rollout

1. Reviewed drafting: turn entered job details, notes or voice transcripts into scopes, daily-report narratives, RFIs and estimate descriptions. Preserve original input, identify AI suggestions and require a user to accept before saving or issuing.
2. Company cost assistance: use verified rate libraries and recent company estimate lines. AI suggests scope/quantities; deterministic arithmetic computes prices and markup. Cite the source rate and flag assumptions/missing quantities. Never invent vendor quotes or claim an estimate is final without review.
3. Drawing-assisted takeoff: larger engineering effort. Require calibrated scale, sheet/revision references, measurable geometry, confidence/coverage checks and human verification. A vision model reading a PDF is not a certified quantity survey.

AI retrieval must enforce the caller's company/project/file permissions before selecting content. Treat drawing text and attachments as untrusted data, never instructions. Log model usage without retaining unnecessary client document contents, enforce per-company budget limits and obtain appropriate disclosure/consent before transmitting documents. No autonomous issue/send, QuickBooks posting, payment collection or pricing commitments.

Current AI feature: optional sign-in-sheet extraction. Its source hardening includes active access, image size limits, `store:false`, and company attempt quotas; production deployment and runtime tests must be verified before claiming those protections live.
