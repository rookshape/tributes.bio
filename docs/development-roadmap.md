# Development Roadmap

## Strategy

Tributes should be built around the Twitch spinner wedge first. The bio page and simple payment field still matter, but they become supporting infrastructure for a more differentiated product: a streamer overlay where viewers pay for spin experiences, wheel outcomes update a live counter, and the streamer no longer has to run a spinner, calculator, payment app, and overlay by hand.

The first MVP should prove three things:

1. Streamers can configure a wheel and display it in OBS.
2. Viewers can join a spin flow from the creator's Tributes link.
3. Payments, spins, queue state, and counters stay connected in real time.

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

- Landing page focused on Tributes Spin
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

### Phase 2: Tributes Spin Prototype

Goal: make the wedge visible and testable before payment complexity.

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

### Phase 3: Stripe Connect And Fixed-Price Spins

Goal: connect payments to queue and counter state.

Deliverables:

- Stripe Connect account creation
- Stripe Connect onboarding status
- Fixed-price spin checkout
- Payer-side 25% upcharge calculation
- PaymentIntent metadata for creator, spin config, and queue reconciliation
- Webhook handler
- Payment-to-queue reconciliation
- Failed, refunded, disputed, and canceled payment states
- Creator payout visibility

Exit criteria:

- A visitor can pay for a fixed-price spin without signing up.
- A successful webhook creates a queue item.
- The overlay receives the item in real time.

### Phase 4: Bio Page And Tip Field

Goal: make the spin flow discoverable from the creator's bio page.

Deliverables:

- Public bio profile
- Profile image upload
- Bio and display name editing
- Link CRUD and reorder
- Top one-time tip field
- Spin CTA module
- Basic SEO metadata
- Social preview metadata

Exit criteria:

- A creator can share `tributes.bio/:username`.
- Visitors can tip or enter the spin flow from the same public page.

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
- `stripeAccountId`
- `stripeOnboardingStatus`
- `twitchUserId`
- `twitchLogin`
- `isPublished`
- `moderationStatus`
- `createdAt`
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
- `clickCount`

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

## First Sprint

1. Add routing and app layout.
2. Create landing page copy centered on Tributes Spin.
3. Create static public bio, spin, dashboard, and overlay routes.
4. Move sample MVP data into typed fixtures.
5. Build the wheel preview component as reusable UI.
6. Build the overlay component with stable OBS dimensions.
7. Add Firebase Auth shell.
8. Add Firestore profile and username types.
9. Add emulator config and security rules draft.
10. Verify desktop and mobile layouts.

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
