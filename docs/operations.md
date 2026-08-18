# Operations

## Admin Access

The verified owner email in the server `ADMIN_EMAILS` environment value can bootstrap the Firebase Auth `admin` custom claim. Production can override the fallback with a comma-separated list in its Functions environment.

Admin reads and writes use callable Functions. Firestore rules do not expose reports, audit records, payment details, rate limits, or admin collections to browser clients.

## Moderation

Public profile reports are stored in `contentReports`. A reporter can submit up to five reports per 24-hour window. Admin actions for usernames, user status, creator status, and report resolution are recorded in `adminAuditLogs`.

Disabling an account also revokes refresh tokens and suspends its creator profile. Re-enabling the account does not automatically reactivate a separately moderated profile.

## Transactional Email

Firebase Authentication sends verification and password-reset email. Stripe Checkout collects or prefills the payer email, and Stripe Connect handles account and payout notices.

In each Stripe environment, enable **Customer emails > Successful payments** and **Refunds** so Stripe sends payment receipts. Test mode records delivery settings but does not send live receipts.
