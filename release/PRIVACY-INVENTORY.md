# Privacy declaration inventory — draft for review

Do not publish this inventory as a privacy policy. It documents items to verify before completing store declarations and public policy.

Operator for proposed launch: RAF General Contracting Corp. Confirm final support contact and postal address.

| Data | Purpose | Implementation / verification |
| --- | --- | --- |
| Name, email, company membership, role | Authentication and team access | Supabase Auth and profiles; linked to an account |
| Project addresses and site coordinates | Organize jobsites and weather | User-entered project data; no native device-location permission added |
| Reports, manpower, signatures, photos and captions | Field reporting and client PDFs | Private database/storage; can contain employee and client information |
| Drawings, markups, measurements, RFIs, submittals and attachments | Project coordination | Private database/storage plus authorized review/share workflows |
| Mailbox identity and provider authorization | Send project emails | Connected Google/Microsoft providers; verify OAuth scopes and token storage in deployed functions |
| Sign-in sheets and AI extraction | Manpower data entry | Inspect `read-signin-sheet` provider, data sent, retention and user disclosure before making claims |
| Offline drawings, session tokens and exported PDFs | On-device access and sharing | WebView local storage/IndexedDB; export cache files removed after native sharing returns; verify logout clears persistent drawings |
| Server logs and diagnostics | Service operation | Verify provider log retention and access |

No advertising/tracking SDK was added in this launch branch. Verify deployed services before declaring no tracking in store forms. The iOS required-reason manifest covers local file timestamps; it is not a substitute for App Privacy labels.

Resolve retention periods, deletion processing, sole-owner company treatment, shared business records, email token revocation, backup expiry and any required statutory retention. Verify file backup coverage separately from Postgres backups.

Public policy must match implemented behavior. Account deletion and published policy URLs are release blockers, not completed features.
