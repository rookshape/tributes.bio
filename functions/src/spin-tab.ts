/**
 * A spin is a *run*, not a single event.
 *
 * A viewer buys a run and gets the wheel's spins-per-purchase to use. Slices
 * hand out more spins, multiply what they owe, or add cash, and the tab
 * accumulates across the whole run:
 *
 *   pay $5 for 3 spins  ->  tab $5, 3 spins
 *   land 2x             ->  tab $10, still 3 spins (a multiplier is free)
 *   land +2 spins       ->  tab $10, 4 spins
 *   land $20            ->  tab $30, 3 spins
 *   ...until the spins run out
 *
 * Stripe needs the amount agreed up front, so the wheel's max charge bounds the
 * run: the tab clamps there and the run ends. That ceiling is what gets
 * authorized at checkout, so a capture can never exceed the hold.
 *
 * Shared by the checkout path and the spin path so the number a viewer agrees
 * to and the number they are charged come from the same rules.
 */

/** Loose on purpose: slices arrive straight off Firestore documents. */
export type TabSlice = {
  type?: unknown;
  value?: unknown;
};

/** Backstop against a wheel whose slices only ever hand out more spins. */
export const MAX_RUN_SPINS = 30;

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

/**
 * The most one slice can move a tab. The cap can never sit below this, or the
 * wheel would be advertising a result it cannot pay out.
 */
export function largestSingleResultCents(
  spinPriceCents: number,
  slices: TabSlice[],
) {
  return slices.reduce((largest, slice) => {
    const value = Number(slice?.value ?? 0);

    if (slice?.type === "amount") {
      return Math.max(largest, Number.isInteger(value) ? Math.max(0, value) : 0);
    }

    if (slice?.type === "multiplier") {
      return Math.max(largest, spinPriceCents * Math.max(1, value));
    }

    return largest;
  }, spinPriceCents);
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
    Math.max(largestSingleResultCents(spinPriceCents, slices), requested),
  );
}

export type TabRun = {
  /** What the viewer owes so far, never above the cap. */
  tabCents: number;
  /** Spins still owed to them. */
  spinsLeft: number;
  /** Spins already taken in this run. */
  spinsTaken: number;
};

export type TabStep = TabRun & {
  /** Whether the run keeps going rather than capturing now. */
  continues: boolean;
  /** The run stopped because it reached the wheel's ceiling. */
  capped: boolean;
  /** Spins this slice handed out, for the overlay to call out. */
  spinsAwarded: number;
  /** Multiplier this slice applied, or 0. */
  multiplier: number;
};

/** Apply one landed slice to a run. */
export function applyTabStep(
  slice: TabSlice,
  run: TabRun,
  capCents: number,
): TabStep {
  const value = Number(slice?.value ?? 0);
  const spinsTaken = run.spinsTaken + 1;
  // The spin they just used is spent whatever it landed on.
  let spinsLeft = Math.max(0, run.spinsLeft - 1);
  let tabCents = run.tabCents;
  let spinsAwarded = 0;
  let multiplier = 0;

  if (slice?.type === "amount") {
    tabCents = run.tabCents + Math.max(0, value);
  } else if (slice?.type === "multiplier") {
    multiplier = Math.max(1, value);
    tabCents = run.tabCents * multiplier;
    // A multiplier costs nothing to land on — it escalates the run rather than
    // spending one of the spins the viewer paid for.
    spinsLeft += 1;
    spinsAwarded = 1;
  } else if (slice?.type === "bonus") {
    spinsAwarded = Math.max(0, Math.round(value));
    spinsLeft += spinsAwarded;
  }
  // An action slice costs nothing extra and just uses up a spin.

  const clamped = Math.max(0, Math.min(capCents, Math.round(tabCents)));

  // Once the ceiling is reached nothing further can be charged, so the run ends
  // there rather than spinning for nothing.
  const capped = clamped >= capCents;
  const exhausted = spinsTaken >= MAX_RUN_SPINS;

  return {
    tabCents: clamped,
    spinsLeft,
    spinsTaken,
    continues: spinsLeft > 0 && !capped && !exhausted,
    capped,
    spinsAwarded,
    multiplier,
  };
}
