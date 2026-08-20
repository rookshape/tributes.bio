# Stripe Business Model Review — Tributes

Draft for submission to Stripe. Describes the production business and both
payment flows, and asks for an explicit decision on the one flow that needs it.

**Before sending, fill in every `«placeholder»` and delete this line.**

---

## What we are asking for

We are asking Stripe to review our business model and confirm in writing whether
we may run **Flow B (Spins)** in production as described: a manual-capture
authorization for a disclosed maximum, partially captured for a smaller amount
determined during a live stream.

We are not asking about Flow A (Tributes), which is an ordinary immediate-capture
destination charge. It is described here only so the review covers the whole
business.

If Flow B as described is not acceptable, we have a fallback that uses a fixed
charge and treats the wheel as presentation only. It is specified at the end. We
would rather be told to use it than deploy something that gets shut off later.

## The business

- Legal entity: **lurk LLC**, «state of formation», United States
- Product: **Tributes**
- Live site: **https://tributes-bio-prod.web.app** (moving to `https://tributes.bio`
  once DNS is cut over; both serve the same deployment)
- Stripe account: «platform account id»
- Contact for this review: «name», «email»

Tributes is a link-in-bio and audience-support product for live streamers. A
creator gets a public page with their links, a way for viewers to send one-time
support, and a "spin the wheel" feature they run live on stream with OBS overlays.

We are a **Connect platform**. Creators are our users, not our customers'
customers. Viewers pay creators; we take a service fee.

Target creators are live streamers on Twitch, YouTube Live, Kick, and similar
platforms — the same population served by Streamlabs, StreamElements, Ko-fi, and
Throne. See "Creator categories" below for what we exclude.

## Money flow

- Connected accounts: **Express**, country `US`, `transfers` capability
- Charges: **destination charges** on the platform, with
  `transfer_data.destination` set to the creator's connected account
- Our revenue: `application_fee_amount` on the charge
- Payouts: Stripe-managed to the connected account
- Currency: USD only at launch

The service fee is **payer-side**. The creator receives the amount shown, and the
fee is added on top rather than deducted. Two rates:

| Product | Fee | Creator gets | Payer pays |
| --- | --- | --- | --- |
| Tribute (Flow A) | 25% | $10.00 | $12.50 |
| Spin (Flow B) | 20% | $10.00 | $12.00 |

Spins carry the lower rate because the creator is actively performing the service
live, rather than receiving a passive tip.

## Flow A — Tributes (one-time support)

An ordinary tip. No approval question here.

1. A viewer opens a creator's public page and enters an amount, $1–$500.
2. The page shows the creator amount, the fee, and the total before they commit.
3. We create a Stripe Checkout Session, `mode: payment`, `submit_type: donate`,
   for the total, with `application_fee_amount` and
   `transfer_data.destination` on the payment intent.
4. Charge is captured immediately. Stripe emails the receipt.

The line item names the creator and its description states the fee in dollars,
for example `Includes a $2.50 service fee`.

The tip form only appears once the creator's connected account has
`onboarding = active` and `payouts_enabled = true`. A creator who has not
finished onboarding cannot be paid.

## Flow B — Spins (the flow needing approval)

### What the viewer buys

A creator configures a wheel: 4–16 segments, an entry price ($1–$1,000), how many
spins one purchase buys (1–10), and a **maximum charge** ($1–$5,000). Segments
are cash amounts, multipliers, bonus spins, or non-monetary actions ("chat picks
the next game").

A viewer buys a *run*, not a single spin. The creator spins the wheel live on
stream. Cash results accumulate; multipliers raise the next cash result; bonus
segments add spins. The run ends when spins run out, the maximum is reached, or a
hard cap of 30 spins is hit.

The final amount owed is **entry price + accumulated winnings**, and the viewer
is charged that. It is always at least the entry price and never more than the
maximum.

### How it is charged

1. The viewer sees the entry cost **and the maximum they could pay** before
   agreeing to anything. Both are stated on the page, fee included.
2. We create a Checkout Session with `payment_intent_data.capture_method:
   "manual"`, for the **maximum**: the wheel's configured maximum charge plus the
   service fee on it.
3. That amount is authorized and held. Nothing is captured.
4. The creator runs the spins live. Our server, not the client, selects each
   result and records the running total.
5. When the run ends, we call `paymentIntents.capture` with `amount_to_capture`
   set to the actual total and `application_fee_amount` recalculated to match.
   The unused authorization is released by Stripe.
6. If the run is cancelled, or the creator removes the viewer from the queue, we
   call `paymentIntents.cancel` and nothing is captured.

### Why capture can never exceed the authorization

This is enforced in code, not by convention. Before capturing we assert:

```ts
if (!Number.isInteger(creatorAmountCents) ||
    creatorAmountCents < 100 ||
    totalCents > Number(payment.authorizedTotalCents ?? 0)) {
  throw new HttpsError("failed-precondition", "Spin result exceeds the authorization.");
}
```

Separately, the run itself is clamped to the maximum as it accumulates, so a run
stops as soon as it reaches the ceiling rather than overshooting and being
trimmed at capture time. The wheel's maximum is also floored at
`entry price + the largest single cash segment`, so a wheel cannot advertise a
prize it is not authorized to pay.

Captures use idempotency keys (`spin_capture_{paymentId}`), as do session
creation and cancellation.

### What the viewer is told, verbatim

> **To spin** $12
> **Most you can pay** $60
>
> Multipliers and bonus spins keep your run going, and what you owe climbs with
> each one — never past **$60**. We hold that much now and release whatever your
> run does not reach. Service fee included; payments are handled by Stripe.

The maximum is deliberately the headline figure and is set in the largest type on
the page. We treat it as the offer, not as fine print.

### Why we believe this fits the manual-capture model

The pattern is authorize-a-maximum, capture-the-actual — the same shape as a
hotel incidental hold or a fuel pump pre-authorization. The payer agrees to a
specific ceiling before any hold is placed, the captured amount is always at or
below it, the difference is released rather than kept, and the final amount is
determined by a service the creator performs, not by us.

We recognise the part a reviewer will want to weigh: **the final amount depends
on a randomized outcome**, and the viewer's payment is not a purchase of a fixed
good. That is precisely why we are asking rather than assuming.

## Fallback if Flow B is declined

We will ship this instead, and we can ship it on request without further changes
to the model:

- The viewer pays a **fixed price** for a run, captured immediately.
- The wheel still spins live on stream and still produces a result.
- The result determines **presentation only** — what the creator does on stream,
  what the overlay shows — and never the amount charged.
- No manual capture, no authorization holds, no variable amounts.

We would keep paid Spins disabled in production until we have your answer either
way.

## Creator categories

Allowed: general live-streaming creators — gaming, music, art, cooking, talk,
IRL, education.

Excluded at launch:

- Adult and sexually explicit content
- Anything on Stripe's restricted-businesses list
- Regulated gambling, real-money gaming, or anything presented as a wager on an
  outcome outside the creator's own stream
- «confirm: minimum creator age — proposal is 18+»

Enforcement: creators agree to an Acceptable Use policy at signup, viewers can
report a page from the page itself, and we have an admin moderation surface with
warning, suspension, and termination states plus payout holds.

**Question for Stripe:** we would like your view on whether the wheel as
described reads as entertainment or as regulated gaming in your assessment, and
whether any creator category you would otherwise permit should be excluded from
the Spin feature specifically.

## Refunds, disputes, and failures

- Refunds are issued from the Stripe dashboard and reflected in our records via
  the `charge.refunded` webhook, which also handles partial refunds.
- Disputes move the payment to a `disputed` / `dispute_lost` state and are
  excluded from creator earnings and analytics totals.
- An abandoned authorization is cancelled rather than left to expire when the
  creator ends the session or removes the entry.
- A failed capture leaves the run unpaid and the entry marked failed; the viewer
  is not charged.
- Refunds after a completed spin reverse the creator's counter and analytics.

Our refund policy — including the fact that a completed spin is a performed
service — will be published before launch and linked from the checkout page.

## Current status

- Both flows are fully implemented and tested against Stripe test mode.
- Paid Spins are **not enabled in production** and will stay disabled until this
  review concludes.
- The site is live and public. Terms, Privacy, and Payments and Refunds are
  published and linked from the footer of every page:
  - https://tributes-bio-prod.web.app/terms
  - https://tributes-bio-prod.web.app/privacy
  - https://tributes-bio-prod.web.app/refunds
- Pricing is stated on the home page, and every total a payer sees includes the
  fee before they commit.
- No live charges have been processed.

## Placeholders to fill before sending

- [ ] State of formation for lurk LLC
- [ ] Platform Stripe account id
- [ ] Review contact name and email
- [ ] Confirm minimum creator age (18+ proposed)
- [ ] Confirm the tribute maximum ($500) and spin maximum ($5,000) are the
      figures you want on record
