# Development Roadmap Part 2

## Purpose

Part 1 proved the complete Tributes product loop in development: creator accounts, bio pages, guest tips, Stripe Connect, paid Spin queues, OBS overlays, Twitch events, analytics, moderation, and admin operations.

Part 2 turns that functional MVP into a coherent, professional product that can run at `tributes.bio` with live Stripe payments and support an initial creator launch.

The work should improve the workflows that already exist. New features are included only when they directly reduce creator effort, improve stream operation, or remove a production launch risk.

## Part 2 Outcome

At the end of this roadmap:

- Tributes has a finished brand, visual system, logo package, and consistent product language.
- A new creator can publish a useful bio page in under three minutes.
- A creator can make a wheel from a template in under one minute.
- A streamer can select a saved wheel and begin a Tributes session in two primary actions.
- OBS uses a compact, branded, configurable overlay instead of a full-screen layout.
- The public site, dashboard, creator pages, payments, and emails feel like one product.
- Stripe, Twitch, Firebase, domain, email, legal, moderation, and support operations are production-ready.
- A small group of real creators can onboard, receive real payments, and provide launch feedback.
- Tributes can begin public marketing with a stable activation and support process.

## Product Principles

- Make the first successful outcome immediate. Users should see a real page or working wheel before configuring advanced settings.
- Use progressive disclosure. Common controls stay visible; advanced controls appear only when relevant.
- Keep one clear primary action per screen or workflow state.
- Prefer direct manipulation and live previews over forms that describe a distant result.
- Preserve creator work through autosave, undo, duplication, and recoverable archive actions.
- Keep dashboard interfaces calm and work-focused. Public profiles and Spin can be more expressive.
- Use motion to communicate state, hierarchy, and success, not as background decoration.
- Every important state needs visible feedback: loading, saving, saved, disabled, offline, connected, failed, and complete.
- Build mobile and desktop behavior together. Creator dashboards must remain usable on a phone.
- Keep accessibility, reduced motion, contrast, keyboard use, and screen-reader labels in the component system.

## Product Decisions Carried Forward

- Google and email authentication remain the supported sign-in methods. Apple sign-in is not required.
- Dev and production remain separate Firebase projects. There is no staging environment.
- Public creator pages remain at `tributes.bio/:username`.
- Spin is a live-stream product. Its public entry point appears only while a creator is live.
- Viewers enter the queue from the public page; the streamer triggers queued spins from the dashboard.
- Creators can receive one-time tips without requiring the payer to create an account.
- The current 25% payer-side service fee remains the intended revenue model, subject to final processor approval and disclosure review.
- Streamers need multiple named and reusable wheels, not one global wheel configuration.
- The Tributes brand remains visible in the OBS experience.
- Automatic variable charging does not launch without explicit processor and legal approval.

## Phase 7: Brand And Product Design Foundation

Goal: establish the visual and interaction system before redesigning individual workflows.

Deliverables:

- Brand direction covering personality, audience, voice, color, typography, imagery, and motion
- Primary logo, compact mark, wordmark, monochrome variants, favicon, app icon, and social image assets
- Temporary asset fallbacks so implementation does not wait on final logo files
- Color system with neutral interface colors and expressive brand accents
- Type scale, spacing scale, layout grid, borders, shadows, radii, and icon sizing
- Motion tokens for hover, focus, page entry, reordering, saved states, live changes, and payment success
- Shared React components for buttons, icon buttons, inputs, selects, toggles, segmented controls, tabs, tooltips, menus, dialogs, toasts, progress, skeletons, and empty states
- Consistent public header, dashboard shell, mobile navigation, and account menu
- Design treatment for loading, error, offline, disabled, restricted, and destructive states
- Responsive and accessibility specifications for the component system
- Representative high-fidelity designs for the landing page, public profile, dashboard, onboarding, Wheel Studio, live control, and OBS preview

Exit criteria:

- Core screens can be built from shared tokens and components instead of page-specific styling.
- The public product, dashboard, and Spin experience feel related without forcing them into the same visual density.
- Motion and interaction behavior is documented well enough to implement consistently.
- Final logo assets can replace the temporary mark without changing component layouts.

## Phase 8: Onboarding And Bio Experience

Goal: make reaching a publishable creator page effortless and redesign the core Linktree-style product to launch quality.

Recommended creator onboarding:

1. Create an account.
2. Select creator or personal account.
3. Claim an auto-suggested username with inline availability feedback.
4. Confirm the imported display name and profile image.
5. Add one or two links.
6. See the public-page preview.
7. Publish and enter the dashboard.

Deliverables:

- Redesigned signup, login, verification, recovery, onboarding, and returning-user states
- Auto-populated display name, photo, and username suggestions where available
- Link creation during creator onboarding with an obvious skip option
- Immediate mobile preview during onboarding
- Minimal personal-account onboarding
- Post-onboarding setup checklist for Stripe, Twitch, appearance, first tip, first wheel, and OBS
- Redesigned bio-page editor with direct, reliable reordering and clear publish state
- Improved link creation, editing, visibility, validation, duplication, and deletion
- Polished profile-image upload and crop flow
- Expanded appearance system built from intentional themes and creator-controlled colors
- Refined public tip field with concise fee disclosure and strong mobile ergonomics
- Refined public profile motion, social sharing, SEO metadata, and empty states
- Clear preview and publish behavior across desktop and mobile
- Unsaved-change protection or autosave with visible saved status

Scope controls:

- Onboarding does not require Stripe, Twitch, detailed theming, analytics setup, or wheel configuration.
- A creator needs only a username and one useful piece of content to publish.
- Optional education belongs in contextual tooltips and the setup checklist, not in long onboarding pages.

Exit criteria:

- A first-time creator can publish a real page in under three minutes without assistance.
- Optional steps can be skipped without producing a broken or confusing dashboard.
- The public profile and payment field are launch-quality on current mobile and desktop browsers.
- The dashboard always communicates whether the page is published and saved.

## Phase 9: Wheel Studio

Goal: replace the long slice-form interface with a visual editor and a reusable wheel library.

Information architecture:

- `Spin > Wheels`: named wheel library
- `Spin > Wheels > :wheelId`: direct visual editor
- `Spin > Live`: stream control surface
- `Spin > Overlay`: preview and overlay settings, presented inside the Spin workflow rather than as a bare external link

Wheel library deliverables:

- Multiple named wheels per creator
- Preserve the existing configuration as a migrated `Default wheel`
- Wheel cards or compact rows showing name, enabled state, slice count, last edited time, and preview
- Create, rename, duplicate, archive, restore, and delete controls
- Active/default wheel selection
- Wheel selection when starting a live session
- Protection against changing or deleting the wheel used by an active session

Direct editor deliverables:

- Large editable wheel as the primary interface
- Click or tap a slice to edit its label, type, amount, multiplier, bonus count, action, and color in a compact contextual panel
- Add-slice control attached directly to the wheel
- Selected-slice delete and duplicate controls
- Drag or keyboard reordering where the wheel engine permits it
- Clear minimum and maximum slice limits
- Wheel name, base price, and other essential settings kept outside the slice list
- Autosave with explicit saving, saved, and failed states
- Undo and redo for the current editing session
- Mobile editor fallback that preserves direct selection without requiring tiny targets
- Exact preview of labels, colors, pointer position, and animation

Templates and automation:

- Simple amounts template
- Amounts and multipliers template
- Bonus-spin template
- Viewer-choice/action template
- Blank wheel
- Generate amount slices from a start, end, and increment
- Balanced color palette generation with manual override
- Duplicate an existing wheel as the fastest path to a variation
- Sensible labels generated from values and types

Preview behavior:

- Replace the current Overlay button as the primary experience with an embedded 16:9 preview similar to the bio-page preview
- Preview idle, spinning, result, queue, goal, Bits alert, and offline states
- Keep open-in-new-window and copy-URL actions in a compact preview menu
- Display a clear disabled-wheel message in the dashboard instead of silently producing a blank preview

Exit criteria:

- A creator can create a useful wheel from a template in under one minute.
- A creator can understand and edit a slice by interacting with the wheel itself.
- Multiple wheels can be safely saved and reused across separate streams.
- Existing creators keep their current wheel through migration.
- The creator does not need to inspect OBS to understand what the overlay will show.

## Phase 10: Live Control And OBS Experience

Goal: make running Tributes during a stream simple, compact, branded, and entertaining.

Live control deliverables:

- Dedicated live control screen separated from wheel configuration
- Selected wheel, Twitch status, manual live override, queue count, current viewer, result, and goal shown at a glance
- One primary `Start session` or `End session` action
- `Spin next` as the dominant control while a queue exists
- Optional auto-advance only after the manual workflow is proven reliable
- Queue reordering, skip, cancel, and clear actions with audit-safe payment handling
- Recent-result history and manual counter correction
- Clear payment, authorization, capture, failure, refund, and bonus-spin states
- Stream-safe confirmation for actions that could affect paid queue entries
- Keyboard shortcuts for common live actions, documented through tooltips and menus

Overlay visual direction:

- Compact casino or slot-machine-inspired presentation rather than a full-screen two-column dashboard
- Wheel appears as a focused event element and does not permanently cover the stream
- Result reveal designed like a slot or marquee moment
- Prominent but tasteful `tributes.bio` branding
- Goal shown as a configurable progress bar instead of a plain total
- Optional queue widget showing count and privacy-safe viewer names
- Optional recent-result widget
- Optional Bits/Cheers alert treatment
- Layout presets for common webcam, gameplay, and full-screen scene arrangements
- Transparent background with no opaque full-canvas panel
- Safe areas and scaling behavior for 1920x1080 and common OBS canvases

Sound deliverables:

- Optional built-in spin start, tick, result, success, queue, and Bits sounds
- Per-sound enable controls, master volume, mute, and test playback
- OBS-compatible browser-source audio behavior
- Reduced-motion and muted defaults where browser or accessibility settings require them
- Launch with licensed or original built-in sounds; arbitrary creator uploads remain post-launch unless clearly justified

Goal and queue configuration:

- Goal amount, label, starting amount, completion state, and reset controls
- Define which events contribute to the goal: tips, Spins, Bits, or selected sources
- Queue visibility toggle, maximum visible names, anonymous-name handling, and overflow count
- Exact synchronization among dashboard, viewer receipt, and OBS overlay

OBS setup improvements:

- In-product overlay preview and setup checklist
- Copy URL, resolution, refresh, audio, and source-order instructions
- Connection indicator showing whether the overlay is receiving live state
- Test overlay action that does not require a payment or Twitch broadcast
- Clear warning when a wheel is disabled, no wheel is selected, or the overlay URL is stale

Exit criteria:

- A streamer can choose an existing wheel and start a session in two primary actions.
- A paid viewer can move from checkout to queue to result without manual reconciliation.
- The overlay occupies only its intended visual area and remains readable over real stream footage.
- Wheel, result, goal, queue, branding, and optional sound stay synchronized during a test broadcast.
- A streamer familiar with OBS needs only the Tributes URL and a short product-specific setup checklist.

## Phase 11: Policy, Legal, Email, And Operations

Goal: resolve the business and trust requirements that must be settled before real payments and public creator acquisition.

Processor and product-policy gate:

- Submit the full Tributes business model and both payment flows to Stripe for explicit review
- Describe creator tips, connected accounts, the 25% payer-side fee, live queues, randomized wheel presentation, maximum authorization, partial capture, and target creator categories accurately
- Obtain written approval before enabling a result-dependent or variable-capture Spin mode in production
- Decide the production Spin payment mode from the approval outcome
- Maintain a processor-approved fallback that uses a known fixed payment and treats the wheel as stream presentation only
- Keep paid Spin disabled in production until the chosen mode, disclosures, and refund behavior are approved
- Confirm which creator content categories are prohibited, restricted, reviewable, or allowed
- Define age requirements and whether adult-adjacent creators are excluded at launch

Legal documents for qualified review:

- Terms of Service
- Privacy Policy
- Acceptable Use and Creator Content Policy
- Creator Payments and Payout Terms
- Viewer Payment, Tip, Spin, Refund, and Dispute Policy
- Copyright and takedown process
- Community reporting and enforcement policy
- Cookie and analytics disclosure where required
- Contact, legal entity, governing-law, and effective-date information

Operational policy:

- Moderation severity levels and response targets
- Account warning, suspension, appeal, and termination process
- Payout hold and release rules
- Refund, cancellation, chargeback, dispute, failed capture, and abandoned authorization handling
- Counter and analytics corrections after refunds or disputes
- Fraud and queue-abuse controls
- Data retention, account deletion, creator export, and audit retention
- Incident response and creator-support escalation
- Admin least-privilege and sensitive-action review

Transactional email system:

- Select a production transactional email provider for Tributes-owned messages
- Branded sender identities such as `hello@tributes.bio`, `support@tributes.bio`, and `payments@tributes.bio`
- SPF, DKIM, and DMARC configuration
- Email verification and password recovery using the production domain
- Welcome and onboarding-complete messages
- Stripe connection and requirements-needed messages
- Tip and Spin confirmations without duplicating Stripe receipts unnecessarily
- Spin result, refund, dispute, failed payment, and canceled authorization messages where useful
- Creator moderation, suspension, appeal, and account-state messages
- Creator notification preferences and required transactional-message boundaries
- Separate consent and unsubscribe handling for future marketing email

Exit criteria:

- Stripe has reviewed the actual production business and payment mechanics.
- The production Spin mode and fallback are documented and implemented consistently.
- Legal documents are reviewed, published, versioned, and linked at relevant actions.
- A real support and moderation process exists beyond the admin UI.
- Production-domain authentication and transactional emails pass deliverability tests.

## Phase 12: Production Infrastructure And Domain

Goal: configure `tributes-bio-prod` and `tributes.bio` as a secure, observable production system.

Firebase production setup:

- Enable and configure Auth, Firestore, Storage, Functions, Hosting, Analytics, and required indexes in `tributes-bio-prod`
- Deploy production Firestore and Storage rules after a dedicated access-control review
- Configure production budgets, billing alerts, quotas, logs, and function error alerts
- Enable App Check where compatible with public profiles, payments, functions, and OBS browser sources
- Configure scheduled backups or exports for critical Firestore data
- Document restore, rollback, and incident procedures
- Review data retention and delete unused sensitive fields
- Keep dev and production secrets, data, connected accounts, and webhooks fully separate

Domain and authentication:

- Connect apex `tributes.bio` to Firebase Hosting
- Configure `www.tributes.bio` redirect behavior
- Verify SSL provisioning and renewal status
- Use the custom domain as Firebase `authDomain`
- Add `https://tributes.bio/__/auth/handler` and required origins to Google OAuth configuration
- Verify email-action links return to the production domain
- Configure canonical URLs, sitemap, robots, Open Graph, and social preview assets
- Reserve operational subdomains only when they serve a real purpose

Stripe live configuration:

- Complete the Lurk LLC Stripe platform profile and live-account requirements
- Add production branding, support details, statement descriptors, public business information, and required policies
- Store live keys and webhook secrets only in production secret storage
- Create and verify the production webhook endpoint and event subscriptions
- Use HTTPS production return and refresh URLs for Connect onboarding
- Create new live connected accounts through real onboarding; sandbox accounts are not promoted into live accounts
- Verify account requirements, charges, transfers, fees, balances, payouts, refunds, disputes, and webhook retries
- Configure receipt and customer-email behavior
- Run a controlled low-value live tip, payout, refund, and approved Spin-mode test

Twitch production configuration:

- Register or finalize the production Twitch application with 2FA-protected ownership
- Add the production OAuth callback URL
- Store a separate production client secret and EventSub secret
- Register production EventSub subscriptions
- Verify HTTPS callback challenges, HMAC signatures, revocations, retries, duplicate handling, token refresh, and disconnect behavior
- Test stream online, stream offline, and Cheer events against a real production connection

Email, monitoring, and release engineering:

- Verify SPF, DKIM, DMARC, reply handling, bounce handling, and complaint handling
- Add client and Functions error reporting with production-safe data scrubbing
- Add uptime checks for the public site, payment functions, Twitch callback, and overlay route
- Add structured payment and webhook correlation identifiers to logs
- Add a repeatable production deployment checklist with manual promotion from tested `main`
- Add rollback instructions and preserve the previous Hosting release
- Add automated lint, TypeScript, build, and rules checks before production deployment
- Split oversized frontend bundles and verify initial-load performance on mobile connections

Exit criteria:

- `https://tributes.bio` serves the production Firebase project with valid SSL and reliable authentication.
- Production Stripe Connect onboarding, payment, webhook, payout, refund, and approved Spin behavior work end to end.
- Production Twitch OAuth and EventSub work independently from dev.
- Alerts, logs, backups, rollback, and support ownership are documented and tested.
- No test keys, sandbox accounts, localhost callbacks, or dev project identifiers are used by production.

## Phase 13: Launch QA And Creator Rollout

Goal: prove the production product with a small creator cohort, then begin deliberate public marketing.

Release QA:

- Full regression across signup, onboarding, page editing, publishing, tips, Connect, wheels, live sessions, queues, captures, receipts, Twitch, OBS, analytics, reporting, suspension, and deletion
- Current Safari, Chrome, Firefox, iOS Safari, and Android Chrome coverage
- Keyboard, screen reader, contrast, reduced-motion, zoom, and touch-target review
- Slow-network, reconnect, duplicate webhook, expired token, failed payment, failed capture, refund, and offline recovery tests
- Real OBS test at common canvas and output resolutions
- Long-running stream test for memory, synchronization, queue growth, and stale-session behavior
- Security review of callable authorization, Firestore rules, Storage rules, admin claims, secrets, webhook verification, and rate limits
- Performance budgets for landing, public profile, dashboard, and overlay routes

Creator pilot:

- Recruit three to five launch creators who already use bio links, tips, wheels, or OBS widgets
- Onboard each creator personally while recording friction and support questions
- Verify live connected-account requirements and payout readiness before their first payment
- Run at least one real test stream per creator
- Track time to published page, time to first wheel, OBS setup success, first payment, first completed Spin, and support requests
- Fix launch-blocking issues before expanding access
- Establish a direct support channel and incident contact for the pilot

Marketing readiness:

- Final landing page with real product visuals and concise creator-focused positioning
- Short product demo showing page setup, viewer payment, queue, spin, and OBS result
- Polished social preview, screenshots, logo assets, and creator outreach materials
- Public setup documentation for creators and a concise OBS guide
- Pricing and service-fee explanation
- Public trust, safety, reporting, contact, and support pages
- Privacy-safe product analytics for acquisition, signup, onboarding, publish, Connect, first payment, and retained creator funnels
- Launch feedback process and public issue-response ownership

Launch sequence:

1. Internal production smoke test.
2. Owner account and controlled real-payment test.
3. Invite-only creator pilot.
4. Resolve pilot blockers and confirm operational capacity.
5. Open creator signup with monitored limits.
6. Begin direct creator outreach and public marketing.

Exit criteria:

- Production completes the full viewer-to-creator payment and Spin loop reliably.
- Pilot creators can operate Tributes during a real stream without developer assistance.
- Legal, processor, moderation, support, email, refund, and incident responsibilities have named owners.
- Conversion and failure metrics are visible from landing page through first creator value.
- Tributes is publicly available at `tributes.bio` and ready for active creator acquisition.

## Production Go/No-Go Checklist

- Stripe business model and production Spin mode approved
- Live Stripe account and Connect platform activated
- Real connected account onboarded and payout-ready
- Legal and content policies published
- Refund, dispute, suspension, appeal, and payout-hold procedures tested
- Production Firebase rules and admin access reviewed
- `tributes.bio` DNS, SSL, auth, SEO, and email links verified
- Production Google and Twitch OAuth callbacks verified
- Stripe and Twitch webhook signatures verified
- Transactional email authentication and deliverability verified
- Real tip, fee, transfer, payout, refund, and approved Spin-mode tests completed
- OBS overlay tested during a real broadcast
- Monitoring, alerts, backups, rollback, and incident contacts active
- Mobile, accessibility, performance, and security QA passed
- Pilot creator feedback incorporated

## Explicitly Deferred Until After Launch

- Twitch Extension submission
- Native mobile applications
- Creator custom domains
- Subscriptions and membership billing
- Theme or template marketplace
- Arbitrary creator-uploaded sound effects
- Advanced team accounts and role delegation
- Automatic result-dependent variable charging without explicit approval
- Broad international expansion before tax, payments, privacy, and support review

## Official Requirements Reviewed

Checked on 2026-08-16:

- Stripe prohibited and restricted businesses: https://stripe.com/en-ca/legal/restricted-businesses
- Stripe Connect testing: https://docs.stripe.com/connect/testing
- Stripe Connect onboarding: https://docs.stripe.com/connect/onboarding
- Stripe Express live HTTPS return URLs: https://docs.stripe.com/connect/express-accounts
- Stripe Connect platform integration tasks: https://docs.stripe.com/connect/saas/essential-tasks
- Twitch application registration: https://dev.twitch.tv/docs/authentication/register-app
- Twitch EventSub webhook handling: https://dev.twitch.tv/docs/eventsub/handling-webhook-events/
- Firebase Hosting custom domains: https://firebase.google.com/docs/hosting/custom-domain
- Firebase custom-domain authentication guidance: https://firebase.google.com/docs/auth/web/redirect-best-practices

