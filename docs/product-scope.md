# Product Scope

## Concept

Tributes is a creator payment platform built on shareable bio-link pages. The bio page ships first, one-time tips follow, and the Twitch streamer wedge called Tributes Spin becomes the differentiated growth feature layered on top.

The bio-page differentiator remains important: the top field on a public profile lets visitors send a one-time tip quickly and without creating an account.

## Tributes Spin

Tributes Spin gives streamers a configurable wheel, viewer spin queue, live money counter, and OBS browser-source overlay. It replaces the disconnected workflow where streamers manually run a spinner, calculate outcomes, collect payments elsewhere, and update counters by hand.

Spin outcomes may include:

- Flat amounts
- Multipliers
- Bonus spins
- Stream actions

The safest MVP payment model is fixed-price spins. Pre-authorized maximum charges or automatic variable charges should wait for payment processor and legal review.

## Accounts

### Creator Accounts

Creator accounts can claim a username, build a public profile, receive tips, manage links, customize appearance, and view analytics.

Creator usernames become public URLs in this format:

```text
tributes.bio/username
```

### Personal Accounts

Personal accounts are optional for visitors. A visitor does not need an account to send a tip. Personal accounts exist mainly so returning users can track spend and maintain a basic profile.

## Payments

- Payments are one-time tips.
- Spin payments start as fixed-price one-time payments.
- Stripe Connect is the payout model for creators.
- Lurk LLC owns the platform Stripe account.
- Platform revenue comes from a 25% upcharge paid by the person sending the tip.
- Visitors should be able to pay without signing up.

Open payment decisions:

- Tip presets and minimum/maximum amounts
- Refund and dispute policy
- Whether visitors can include a short message with a tip
- Whether tips are anonymous, named, or configurable per payment

## Landing Page

The landing page should explain the platform to prospective creators and include:

- Hero with account creation CTA
- How it works
- Example creator profile
- Feature overview
- Pricing and fees
- FAQ
- Trust, safety, and moderation basics
- Links to legal pages

## Auth And Onboarding

Supported sign-in methods:

- Google
- Email

After first sign-up, users are routed to onboarding:

1. Choose personal or creator account.
2. Creator account users get an auto-populated username suggestion.
3. Creator account users claim a username.
4. Creator account users continue to page creation.

## Creator Dashboard

The dashboard should include:

- Spin wheel editor
- Spin queue and live counter controls
- OBS overlay setup
- Profile editor
- Link editor with add, edit, delete, and reorder controls
- Appearance customization
- Profile picture upload
- Live preview
- Publish controls
- Analytics
- Stripe Connect setup/status
- Account settings

## Analytics

Creator analytics should include standard creator-facing metrics:

- Earnings
- Tip count
- Average tip
- Profile views
- Link clicks
- Click-through rate by link
- Payment conversion rate
- Referrer/source where available
- Date range filtering

## Public Profile

The public profile should be mobile-first and fast. It should include:

- Profile picture
- Display name
- Username
- Bio
- One-time tip field at the top
- Creator links
- Spin entry point when enabled
- Social/SEO metadata

## Admin

Admin tooling should include standard operational controls:

- User lookup
- Creator/profile lookup
- Username management
- Payment and Stripe Connect status visibility
- Moderation queue
- Report handling
- Account/profile suspension controls
- Basic audit trail for sensitive admin actions

## Moderation And Restrictions

Use standard platform restrictions for usernames, profile content, links, uploaded images, fraud, spam, impersonation, and prohibited content. Include report flows and administrative review.

## Legal, SEO, And Email

The platform will need:

- Terms of Service
- Privacy Policy
- Acceptable Use Policy
- Payment and payout terms
- SEO-ready public profile metadata
- Basic transactional email flows for account, payment, and payout setup events
