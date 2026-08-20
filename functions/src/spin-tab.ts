/**
 * A spin is a *run*, not a single event.
 *
 * A viewer buys a run and gets the wheel's spins-per-purchase to use. What they
 * paid to enter is not part of the running total — that is the price of playing
 * — so the tab starts at zero and only counts what the wheel hands them:
 *
 *   pay $5 for 3 spins  ->  tab $0, 3 spins
 *   land 2x             ->  tab $0, 2x armed, still 3 spins (a multiplier is free)
 *   land $10            ->  tab $20, 2 spins
 *   land +2 spins       ->  tab $20, 3 spins
 *   ...until the spins run out, then they are charged $5 + $20
 *
 * Because the tab starts empty, a multiplier cannot act on it — doubling zero
 * would make the slice dead on the first spin. It arms the *next* cash result
 * instead, which is also how the format is played on stream ("2X NEXT").
 * Multipliers stack while armed.
 *
 * Stripe needs the amount agreed up front, so the wheel's max charge bounds the
 * run: entry price plus tab can never exceed it. That ceiling is what gets
 * authorized at checkout, so a capture can never exceed the hold.
 *
 * Shared by the checkout path and the spin path so the number a viewer agrees
 * to and the number they are charged come from the same rules.
 */

/** Loose on purpose: slices arrive straight off Firestore documents. */
export type TabSlice = {
  type?: unknown;
  value?: unknown;
  bonusSpins?: unknown;
};

/** Backstop against a wheel whose slices only ever hand out more spins. */
export const MAX_RUN_SPINS = 30;

/** Ceiling on the spins a single slice may add alongside its own result. */
export const MAX_SLICE_BONUS_SPINS = 5;

export const MIN_MAX_CHARGE_CENTS = 100;
export const MAX_MAX_CHARGE_CENTS = 500000;
export const DEFAULT_MAX_CHARGE_MULTIPLE = 5;

export const MIN_SPINS_PER_PURCHASE = 1;
export const MAX_SPINS_PER_PURCHASE = 10;

export function spinsPerPurchase(config: FirebaseFirestore.DocumentData | undefined) {
  const stored = Number(config?.spinsPerPurchase);

  if (!Number.isInteger(stored)) {
    return MIN_SPINS_PER_PURCHASE;
  }

  return Math.min(MAX_SPINS_PER_PURCHASE, Math.max(MIN_SPINS_PER_PURCHASE, stored));
}

/** The biggest cash result on the wheel, before any multiplier. */
export function largestSingleResultCents(slices: TabSlice[]) {
  return slices.reduce((largest, slice) => {
    const value = Number(slice?.value ?? 0);

    if (slice?.type === "amount" && Number.isInteger(value)) {
      return Math.max(largest, Math.max(0, value));
    }

    return largest;
  }, 0);
}

/**
 * The cap has to clear entry price plus one full cash result, or the wheel
 * would be advertising a slice it cannot pay out.
 */
export function maxChargeFloorCents(spinPriceCents: number, slices: TabSlice[]) {
  return Math.max(
    MIN_MAX_CHARGE_CENTS,
    spinPriceCents + largestSingleResultCents(slices),
  );
}

/** The wheel's ceiling, defaulted and floored for wheels that predate it. */
export function maxChargeCents(
  config: FirebaseFirestore.DocumentData | undefined,
  spinPriceCents: number,
  slices: TabSlice[],
) {
  const stored = Number(config?.maxChargeCents);
  const requested =
    Number.isInteger(stored) && stored > 0
      ? stored
      : spinPriceCents * DEFAULT_MAX_CHARGE_MULTIPLE;

  return Math.min(
    MAX_MAX_CHARGE_CENTS,
    Math.max(maxChargeFloorCents(spinPriceCents, slices), requested),
  );
}

export type TabRun = {
  /** Winnings so far. Excludes what they paid to enter. */
  tabCents: number;
  /** Spins still owed to them. */
  spinsLeft: number;
  /** Spins already taken in this run. */
  spinsTaken: number;
  /** Multiplier armed by earlier slices, applied to the next cash result. */
  pendingMultiplier: number;
};

export type TabStep = TabRun & {
  /** Whether the run keeps going rather than capturing now. */
  continues: boolean;
  /** The run stopped because it reached the wheel's ceiling. */
  capped: boolean;
  /** Spins this slice handed out, for the overlay to call out. */
  spinsAwarded: number;
  /** Multiplier this slice armed, or 0. */
  multiplier: number;
};

/**
 * Apply one landed slice to a run.
 *
 * `tabCapCents` is what the tab alone may reach — the wheel's max charge less
 * what the viewer already paid to enter.
 */
export function applyTabStep(
  slice: TabSlice,
  run: TabRun,
  tabCapCents: number,
): TabStep {
  const value = Number(slice?.value ?? 0);
  const spinsTaken = run.spinsTaken + 1;
  // The spin they just used is spent whatever it landed on.
  let spinsLeft = Math.max(0, run.spinsLeft - 1);
  let tabCents = run.tabCents;
  let pendingMultiplier = Math.max(1, run.pendingMultiplier || 1);
  let spinsAwarded = 0;
  let multiplier = 0;

  if (slice?.type === "amount") {
    tabCents = run.tabCents + Math.max(0, value) * pendingMultiplier;
    // Armed multipliers are spent on the result they boosted.
    pendingMultiplier = 1;
  } else if (slice?.type === "multiplier") {
    multiplier = Math.max(1, value);
    pendingMultiplier *= multiplier;
    // A multiplier costs nothing to land on — it escalates the run rather than
    // spending one of the spins the viewer paid for.
    spinsLeft += 1;
    spinsAwarded = 1;
  } else if (slice?.type === "bonus") {
    spinsAwarded = Math.max(0, Math.round(value));
    spinsLeft += spinsAwarded;
  }
  // An action slice costs nothing extra and just uses up a spin.

  // Any slice can also hand out spins on top of its own result — "$50 + spin"
  // is one slice, not two, and reads on the wheel as a single prize.
  const extra = Number(slice?.bonusSpins ?? 0);
  const extraSpins = Number.isFinite(extra)
    ? Math.min(MAX_SLICE_BONUS_SPINS, Math.max(0, Math.round(extra)))
    : 0;

  spinsLeft += extraSpins;
  spinsAwarded += extraSpins;

  const clamped = Math.max(0, Math.min(tabCapCents, Math.round(tabCents)));

  // Once the ceiling is reached nothing further can be charged, so the run ends
  // there rather than spinning for nothing.
  const capped = clamped >= tabCapCents;
  const exhausted = spinsTaken >= MAX_RUN_SPINS;

  return {
    tabCents: clamped,
    spinsLeft,
    spinsTaken,
    pendingMultiplier,
    continues: spinsLeft > 0 && !capped && !exhausted,
    capped,
    spinsAwarded,
    multiplier,
  };
}
