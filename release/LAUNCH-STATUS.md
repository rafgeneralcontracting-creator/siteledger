# Store launch status — 2026-10-09

Not ready for store submission. This is an engineering candidate, not an approved or signed release.

## Completed in launch branch

- iOS and Android Capacitor 8.5.3 projects using installed application assets.
- Provisional RAF Construction Management branding and native icons.
- Native jobsite camera action, PDF export sharing, Android back handling, session refresh on return, email connection in the system browser and public invitation links.
- Packaged PDF/ZIP tools, fonts, character maps and PDF worker for mobile; PDF.js 6 compatibility adapter and evaluation disabled.
- Camera permission explanations and iOS filesystem privacy manifest.
- Automated web/drawing tests and mobile package/PDF integration checks.
- Web update reload marker corrected in this branch.
- CI workflows for validation and unsigned native build candidates. They do not publish to either store.

## Production database change applied

Migration `launch_require_active_company_members` makes company identity, role and feature permission checks require an active profile. It preserves existing company data and membership.

Rollback-only probe results: an active owner can access their own project; cannot access a temporary project in another company; after temporary profile deactivation cannot access the project or drawing permission. All probe changes rolled back. All 35 public application tables have RLS enabled. All six storage buckets are private.

Verification scope is limited: this does not prove every table policy, storage URL, Edge Function, public review link and role is correct. Full cross-company/role testing remains required.

A separate rollback-only test using the actual `authenticated` database role passed own-company project reads and denied foreign-company project reads/inserts.

## Required before submission

1. Enroll Apple Developer and Google Play as RAF General Contracting Corp. organization accounts. User confirmed neither account exists. Account holder must complete legal agreements, identity/business verification and fees. Do not use a personal account to avoid organization enrollment work.
2. Resolve final name. Exact business-name match: RAF Construction Management, LLC in Florida records. No trademark clearance or store-name reservation has been performed.
3. Implement and test account deletion in the app and via a public web resource. Define treatment of employee accounts, sole company owners, client records, uploaded files, email credentials and backups. Existing app has account creation but no deletion flow. Do not claim this requirement is satisfied by sign-out or deactivation.
4. Publish accurate privacy, support and deletion pages and finish App Privacy/Data Safety declarations. Review every deployed Edge Function and third-party service, including sign-in-sheet AI processing, email providers and weather service. Confirm retention, subprocessors and support contact.
5. Decide company subscriptions and implement web checkout, subscription status and server-enforced limits. Earlier prices were suggestions and have not been approved or enabled. Native candidate has no checkout. Store payment eligibility must be checked for the actual company-only sales model and launch countries; company billing does not automatically exempt every purchase flow.
6. Native compile and device QA: iPhone/iPad, Android phone/tablet, camera cancellation and app restoration, large drawings, markup/pinch, rotation, files/download/share, email OAuth, invitations, session expiry and poor network. Linux workspace has no Xcode or Android SDK; native compilation/signing has not been verified locally.
7. Review and harden privileged database functions and deployed Edge Functions. Advisors report anonymous invocation warnings for seven SECURITY DEFINER functions and leaked-password protection disabled. Some signed-in helper functions intentionally use elevated privileges to avoid policy recursion; do not indiscriminately remove them. OAuth token tables correctly deny direct browser access.
8. Check backup plan, file backup coverage and a restore exercise. Database backups do not establish that uploaded file contents can be recovered.
9. Create a synthetic store-review company, signed distribution builds, actual device screenshots, age ratings, export declarations and store listings.

## Enrollment links

- Apple: https://developer.apple.com/programs/enroll/
- Google: https://play.google.com/console/signup

Apple Developer Program: $99/year. Google Play: $25 one-time registration. Organization verification requirements apply. The 12-testers/14-days production-access requirement is specifically for qualifying new personal Play accounts; existing web usage does not substitute for that store testing track if applicable.

## Build commands

```sh
npm ci --ignore-scripts
npm run build:mobile
npm test
npx cap sync
```

Use Xcode to build/sign/archive iOS once the Apple team is enrolled. Use JDK 21 and Android SDK 36 for Android. Release keystores, provisioning profiles and store credentials must stay outside source control. The mobile workflow creates unsigned/test artifacts only.

## Sources

- Apple review guidelines: https://developer.apple.com/app-store/review/guidelines/
- Apple organization enrollment: https://developer.apple.com/help/account/membership/program-enrollment/
- Google enrollment: https://support.google.com/googleplay/android-developer/answer/6112435
- Google account deletion: https://support.google.com/googleplay/android-developer/answer/13327111
- Capacitor installation: https://capacitorjs.com/docs/getting-started
- Filesystem privacy manifest: https://capacitorjs.com/docs/apis/filesystem
- Supabase advisor explanations: https://supabase.com/docs/guides/database/database-linter
