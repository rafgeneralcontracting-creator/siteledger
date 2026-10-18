# Account deletion processing

Implemented: password reauthentication, a server-session freshness check, authenticated initiation in the app and on the public web form, owner-only workspace-deletion requests, private durable queue, duplicate prevention and visible request references. This is asynchronous initiation, not automatic completed deletion.

**Release gate:** Assign an operator, a completion timeframe and an escalation procedure, test actual completion on a synthetic account/workspace, and display the completion timeframe before making the app public. The current app truthfully states that the request is pending and does not invent a processing SLA. This gate is not satisfied merely by the existence of the queue.

Service-only queue review (no client/employee can read another user's request):

```sql
select id,user_id,organization_id,scope,status,requested_at
from public.account_deletion_requests where status<>'completed'
order by requested_at;
```

Completion procedure:

1. Verify the authenticated request and scope; determine which construction records the company controls and which require legal retention. Contact the requester using the account address, never a new unverified address. Do not solicit passwords. Tell the requester what will be retained, why, and expected completion date.
2. For an owner, arrange company ownership transfer or confirmed workspace closure. A personal account-deletion request alone does not authorize destroying teammates' projects. Workspace closure requires verified owner authority and explicit company scope. Export legally retained business records through an authorized company representative.
3. Revoke refresh sessions and disable profile access before removal; existing JWTs remain valid until expiry, so sensitive service functions must validate an active profile and RLS must deny inactive profiles. Disconnect email tokens/states/connections and revoke provider grants where supported. Remove the customer's RevenueCat identity only after verifying paid entitlements and subscription cancellation/ownership transfer.
4. Remove personal profile/auth data using Supabase Admin API, handle storage objects using the Storage API, and test stale-token rejection. Deleting Auth may fail while storage ownership or report/invite/reminder foreign keys remain. Do not delete live accounts by raw SQL or orphan shared files to bypass those safeguards. Shared records retained by the company need authorship/anonymization and an explicit retention basis; deletion is not the same as setting active=false.
5. For company deletion, inventory file objects across all six private buckets BEFORE cascading project data. Clean originals, generated PDFs, photos, AI sheet uploads and orphan objects through Storage API, then relational data and user records in a controlled, retryable job. Revoke public review tokens and remove OAuth credentials. Check cross-company rows/objects remain untouched.
6. Record completion and exceptions, notify the verified requester, and keep only a minimal deletion audit reference. Backups/logs expire according to the provider's configured retention; remove exported copies under operator control. Prove a backup restore does not silently reactivate the deleted account.

No real user account or construction record was deleted during release preparation. Test requests and fixtures use rollback-only transactions.
