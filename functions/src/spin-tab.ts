/**
 * A spin is a *run*, not a single event. Multipliers and bonus slices keep the
 * run going, and what the viewer owes accumulates across it:
 *
 *   pay $10 to spin  ->  tab $10
 *   land 2x          ->  tab $20, spin again
 *   land +1          ->  tab $20, spin again
 *   land $20         ->  tab $40, run ends and captures
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

/** An all-bonus wheel would otherwise never end a run. */
export const MAX_RUN_SPINS = 20;

export const MIN_MAX_CHARGE_CENTS = 100;
export const MAX_MAX_CHARGE_CENTS = 500000;
export const DEFAULT_MAX_CHARGE_MULTIPLE = 5;

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

export type TabStep = {
  /** What the viewer owes after this slice, never above the cap. */
  tabCents: number;
  /** Whether the run keeps going rather than capturing now. */
  continues: boolean;
  /** The run stopped because it reached the wheel's ceiling. */
  capped: boolean;
};

/**
 * Apply one landed slice to a run's tab.
 *
 * `spinsSoFar` counts spins already taken in this run, including the one that
 * produced `slice`.
 */
export function applyTabStep(
  slice: TabSlice,
  tabCents: number,
  capCents: number,
  spinsSoFar: number,
): TabStep {
  const value = Number(slice?.value ?? 0);
  let next = tabCents;
  let continues = false;

  if (slice?.type === "amount") {
    next = tabCents + Math.max(0, value);
  } else if (slice?.type === "multiplier") {
    next = tabCents * Math.max(1, value);
    continues = true;
  } else if (slice?.type === "bonus") {
    continues = true;
  }
  // An action slice costs nothing extra and ends the run.

  const clamped = Math.max(0, Math.min(capCents, Math.round(next)));

  // Once the ceiling is reached nothing further can be charged, so the run ends
  // there rather than spinning for nothing.
  const capped = continues && clamped >= capCents;
  const exhausted = spinsSoFar >= MAX_RUN_SPINS;

  return {
    tabCents: clamped,
    continues: continues && !capped && !exhausted,
    capped,
  };
}
