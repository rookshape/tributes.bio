# Development Roadmap

## Strategy

Tributes should establish the shareable bio-link product first, add one-time creator tips second, and then build the Twitch spinner as its differentiated growth feature. This order gives creators a useful public page immediately and puts identity, links, publishing, and payments in place before the real-time spinner workflow.

The first MVP should prove three things:

1. Creators can build and share a polished bio-link page.
2. Visitors can send a one-time tip without creating an account.
3. Streamers can later connect those payments to a real-time spin queue and OBS overlay.

## Product Lines

- Core platform: Tributes
- Twitch wedge: Tributes Spin
- Public creator URL: `tributes.bio/:username`
- Viewer spin URL: `tributes.bio/:username/spin`
- OBS overlay URL: `tributes.bio/overlay/:creatorId/spin`
- Creator dashboard URL: `tributes.bio/dashboard`

## Positioning

Public positioning should be:

- Creator tipping
- Interactive stream monetization
- OBS/Twitch overlay tooling
- Real-time spin queue and counter automation

Avoid explicit adult, findom, gambling, or variable-charge language in public copy until payment processor, Twitch, and legal review is complete. Internally, the niche can inform product decisions, but the shipped platform should start with the broadest compliant framing.

## Policy And Compliance Gates

These are build blockers for charging mechanics, not blockers for the UI prototype.

- Stripe restricted business review: confirm that creator tipping, spinner outcomes, and adult-adjacent creator use cases are acceptable before production payments launch.
- Randomized outcome review: confirm whether fixed-price spins, post-spin confirmation, or pre-authorized variable charges are allowed.
- Twitch commerce review: Twitch Extensions have commerce restrictions; Bits can be used in extensions, but external payment mechanics should stay outside a Twitch Extension until reviewed.
- Age and content policy: define creator content restrictions, report flow, suspension flow, and payout hold behavior.
- Tax/refund/dispute policy: decide how refunds affect creator counters, analytics, payouts, and queue entries.

Relevant docs checked on 2026-08-13:

- Stripe restricted businesses: https://stripe.com/en-th/legal/restricted-businesses
- Stripe PaymentIntents: https://docs.stripe.com/api/payment_intents
- Stripe webhooks: https://docs.stripe.com/webhooks
- Twitch EventSub subscription types: https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/
- Twitch Extensions monetization: https://dev.twitch.tv/docs/extensions/monetization
- Twitch Extensions commerce policies: https://dev.twitch.tv/docs/extensions/guidelines-and-policies/

## Payment Modes

### MVP Mode: Fixed-Price Spin

The viewer pays a known spin price before entering the queue. The wheel result controls stream presentation, bonus spins, counter credit labeling, or configured stream actions. This is the safest first version because the viewer knows the charge before paying.

Example:

- Creator sets spin price to `$10`.
- Viewer pays `$10` plus the Tributes payer-side upcharge.
- Stripe webhook confirms payment.
- Queue entry is created.
- Overlay spins when the streamer triggers or auto-advances.
- Counter increments by the configured amount.

### Later Mode: Post-Spin Confirmation

The viewer spins first, sees the random amount, then confirms payment. This is likely easier to explain than automatic variable charging, but conversion will be weaker and queue abuse needs controls.

### Review-Only Mode: Pre-Authorized Maximum

The viewer agrees upfront to a maximum charge and the wheel chooses the final charge amount. This is the most compelling version, but it should not ship until Stripe/payment counsel confirms it is allowed.

## MVP Scope

The MVP should include:

- Landing page for creator bio pages, tipping, and Tributes Spin
- Auth with Google and email
- Creator onboarding
- Username claim
- Stripe Connect onboarding
- Public bio page with profile, links, top tip field, and spin entry point
- Viewer spin checkout
- Creator dashboard
- Wheel configuration
- Spin queue
- Real-time counter
- OBS browser-source overlay
- Basic analytics
- Admin and moderation basics

The MVP should not include:

- Twitch Extension submission
- Automatic variable charging
- Custom domains
- Subscriptions
- Advanced theming marketplace
- Mobile native app

## Build Phases

### Phase 1: App Foundation

Goal: turn the current shell into a routed app with Firebase-backed account state.

Status: Complete as of 2026-08-14. Verified against local Firebase emulators for creator and personal onboarding, username collisions, protected routes, and anonymous public-profile access.

Deliverables:

- App routing
- Auth providers
- First-login onboarding
- Account type selection
- Creator profile document
- Personal account document
- Username reservation document
- Firestore security rules draft
- Firebase emulator workflow
- Basic dashboard shell

Exit criteria:

- A creator can sign up, pick a username, and land in the dashboard.
- A public route can resolve `:username` to a creator profile.

### Phase 2A: Bio Page Builder

Goal: give creators a complete, shareable Linktree-style page before payment complexity.

Status: Complete as of 2026-08-14. Verified against local Firebase emulators for profile editing, link creation and ordering, public visibility, publishing controls, private creator settings, safe link protocols, profile-image storage, server-recorded analytics, and account preferences.

Deliverables:

- Display name, bio, and profile image editing
- Link create, edit, delete, visibility, and ordering controls
- Page, text, button, and button-text color controls
- Solid and outline button styles
- Live mobile preview
- Publish and unpublish controls
- Public profile rendering without the dashboard navigation
- Server-recorded, deduplicated profile-view and link-click analytics
- Creator analytics dashboard with date ranges, CTR, activity, and link performance
- Account settings, email preferences, and password-reset controls
- Basic SEO and social metadata
- Public profile and private creator-settings data separation

Exit criteria:

- A creator can configure and publish `tributes.bio/:username`.
- A visitor sees only active links on active, published profiles.

### Phase 2B: Stripe Connect And One-Time Tips

Goal: add the payment field that differentiates Tributes from a standard bio-link page.

Deliverables:

- Stripe Connect account creation
- Stripe Connect onboarding status
- Top one-time tip field
- Preset and custom tip amounts
- Guest checkout without a Tributes account
- Optional sender name, message, and anonymous mode
- Payer-side 25% upcharge calculation
- Clear fee and total display before payment
- PaymentIntent metadata for creator and tip reconciliation
- Webhook handler
- Failed, refunded, disputed, and canceled payment states
- Creator transaction history
- Creator payout visibility

Exit criteria:

- A visitor can send a one-time tip without signing up.
- A successful webhook records the payment for the correct creator.

### Phase 3: Tributes Spin Prototype

Goal: make the spinner visible and testable on top of the creator-page foundation.

Deliverables:

- Wheel editor
- Slice model for amount, multiplier, bonus spin, and action
- Counter model
- Queue model
- OBS overlay route
- Manual spin trigger
- Manual counter adjustment
- Required "Powered by Tributes" overlay mark
- Local mock data mode for visual testing

Exit criteria:

- A streamer can configure a wheel and open an OBS-safe overlay URL.
- A local queue item can spin, resolve an outcome, and update the counter.

### Phase 4: Fixed-Price Spin Payments

Goal: connect one-time payments to queue and counter state.

Deliverables:

- Fixed-price spin checkout
- PaymentIntent metadata for creator, spin config, and queue reconciliation
- Payment-to-queue reconciliation
- Spin entry point on the public bio page
- Real-time payment, queue, and overlay updates

Exit criteria:

- A visitor can pay for a fixed-price spin without signing up.
- A successful webhook creates a queue item and updates the overlay.

### Phase 5: Twitch Integration

Goal: connect Twitch identity and optional Bits/counter events.

Deliverables:

- Twitch OAuth connection
- Store broadcaster Twitch ID
- EventSub webhook receiver proof of concept
- `channel.cheer` subscription for Bits/Cheers where permitted
- Optional Bits-to-counter sync
- OBS setup guide
- Stream-safe alert settings

Exit criteria:

- A connected Twitch channel can send test EventSub events to Tributes.
- Bits/Cheers can be detected and optionally reflected in the counter when allowed.

### Phase 6: Analytics, Admin, And Safety

Goal: make the product operable.

Deliverables:

- Creator analytics dashboard
- Earnings, spin count, tip count, conversion rate, link clicks, and top referrers
- Admin user lookup
- Creator/profile lookup
- Payment status visibility
- Moderation queue
- Report profile/link flow
- Username controls
- Account/profile suspension
- Audit trail for sensitive admin actions
- Basic transactional emails

Exit criteria:

- Creator metrics are useful enough for a streamer to trust during live use.
- Admin can investigate users, payments, reported content, and suspicious activity.

## Suggested Routes

- `/`
- `/signup`
- `/login`
- `/onboarding`
- `/dashboard`
- `/dashboard/spin`
- `/dashboard/profile`
- `/dashboard/links`
- `/dashboard/analytics`
- `/dashboard/settings`
- `/admin`
- `/:username`
- `/:username/spin`
- `/overlay/:creatorId/spin`

## Initial Data Model

### `users/{uid}`

- `email`
- `displayName`
- `photoURL`
- `accountType`
- `createdAt`
- `lastLoginAt`

### `creators/{creatorId}`

- `ownerUid`
- `username`
- `displayName`
- `bio`
- `photoPath`
- `photoURL`
- `appearance`
- `isPublished`
- `moderationStatus`
- `createdAt`
- `updatedAt`

### `creatorSettings/{creatorId}`

- `ownerUid`
- `stripeAccountId`
- `stripeOnboardingStatus`
- `twitchUserId`
- `twitchLogin`
- `updatedAt`

### `usernames/{username}`

- `creatorId`
- `ownerUid`
- `reservedAt`

### `creators/{creatorId}/links/{linkId}`

- `title`
- `url`
- `position`
- `isActive`

### `creators/{creatorId}/spinConfigs/{configId}`

- `name`
- `isDefault`
- `baseSpinAmount`
- `counterLabel`
- `autoAdvanceQueue`
- `overlayTheme`
- `slices`
- `createdAt`
- `updatedAt`

### `creators/{creatorId}/spinQueue/{entryId}`

- `viewerName`
- `viewerUid`
- `paymentId`
- `status`
- `baseAmount`
- `platformUpchargeAmount`
- `selectedSliceId`
- `resultAmount`
- `message`
- `createdAt`
- `spunAt`

### `creators/{creatorId}/counterEvents/{eventId}`

- `source`
- `amount`
- `label`
- `paymentId`
- `spinEntryId`
- `createdAt`
- `createdBy`

### `payments/{paymentId}`

- `creatorId`
- `payerUid`
- `stripePaymentIntentId`
- `stripeAccountId`
- `kind`
- `baseAmount`
- `platformUpchargeAmount`
- `totalAmount`
- `currency`
- `status`
- `createdAt`
- `updatedAt`

### `analyticsEvents/{eventId}`

- `creatorId`
- `type`
- `source`
- `referrer`
- `metadata`
- `createdAt`

## Current Build Order

1. Complete the bio page builder.
2. Add Stripe Connect and guest one-time tips.
3. Build the spinner, queue, counter, and OBS overlay prototype.
4. Connect fixed-price spin payments to the queue.
5. Add Twitch integration.
6. Add creator analytics, admin tools, and moderation operations.

## Early Product Decisions

- Whether streamers trigger spins manually or queue auto-advances by default.
- Whether the counter counts paid amount, wheel result amount, or both.
- Whether bonus spins are free, paid, or creator-configurable.
- Whether viewer names are required, optional, or anonymous by default.
- Whether the 25% upcharge is shown as a platform fee, support fee, or service fee.
- Whether creators can hide the Tributes overlay mark on paid plans.
- Whether adult-adjacent creators are allowed at launch, waitlisted, or restricted until processor approval.

## Definition Of MVP Launch

MVP is launchable when:

- A creator can onboard and connect Stripe.
- A creator can configure a wheel and counter.
- A visitor can pay for a fixed-price spin.
- A webhook creates a spin queue entry.
- The OBS overlay updates in real time.
- A creator can share a bio link with links, tips, and spin entry.
- Admin can suspend creators and inspect payment/spin state.
- Legal pages and content restrictions are published.
