# SiteLedger direct RFI email provider setup

Direct RFI sending is implemented around a connected mailbox, but Google and Microsoft require one-time OAuth application registration before users can authorize their mailbox. Generic providers require a secure server-side SMTP relay. Do not put provider client secrets, access tokens, refresh tokens, or mailbox passwords in browser JavaScript or public tables.

## Google / Gmail
Register an OAuth web application in Google Cloud, enable Gmail API, and add the SiteLedger OAuth callback URL. Required send scope should be the minimum needed to send mail. Store client secret only in Supabase Edge Function secrets.

## Microsoft 365 / Outlook
Register an application in Microsoft Entra ID, add the SiteLedger OAuth callback URL, and request the minimum Microsoft Graph delegated mail-send scope. Store client secret only in Supabase Edge Function secrets.

## Other email
Use a server-side SMTP relay or provider API. Store credentials only in protected server-side secrets; never persist raw SMTP passwords in browser-accessible tables.

The `public.user_email_connections` table is metadata only. Secret credentials must remain server-side.