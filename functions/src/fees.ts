/**
 * What the platform takes, added on top of what the creator receives.
 *
 * Two rates, because the two products are not the same sale. A tribute is a
 * one-off on a page the creator points people at and forgets about; a spin is
 * something the creator is actively working for, live, in front of an audience
 * they built — so the platform takes less of it.
 *
 * Both are payer-side: the creator receives the amount shown, and the fee is
 * charged on top of it rather than deducted from it. Stripe sees the fee as the
 * application fee on a destination charge, so the split is enforced by the
 * charge itself rather than by a later transfer.
 *
 * Mirrored in src/lib/money.ts, which is what quotes these to a payer before
 * they agree to them. The two must not drift: a viewer who is shown one number
 * and charged another is a dispute.
 */

export const TIP_FEE_RATE = 0.25;
export const SPIN_FEE_RATE = 0.2;

export function tipFeeCents(creatorAmountCents: number) {
  return Math.round(creatorAmountCents * TIP_FEE_RATE);
}

export function spinFeeCents(creatorAmountCents: number) {
  return Math.round(creatorAmountCents * SPIN_FEE_RATE);
}

/** What a spin run costs the payer in total, fee included. */
export function spinTotalWithFee(creatorAmountCents: number) {
  return creatorAmountCents + spinFeeCents(creatorAmountCents);
}
