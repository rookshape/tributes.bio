import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";

/**
 * The tribute goal belongs to the creator, not to a wheel.
 *
 * A streamer swaps between wheels during a stream, and every spin from any of
 * them counts towards the same running total — so the goal lives in its own
 * document alongside the creator rather than inside a wheel's config.
 */
export type SpinGoal = {
  creatorId: string;
  label: string;
  goalCents: number;
};

export const DEFAULT_GOAL_LABEL = "Tribute goal";

function goalRef(creatorId: string) {
  return doc(db, "creators", creatorId, "spinSettings", "current");
}

function mapGoal(creatorId: string, data: Record<string, unknown> | undefined): SpinGoal {
  const label = typeof data?.label === "string" ? data.label : DEFAULT_GOAL_LABEL;
  const goalCents = Number(data?.goalCents ?? 0);

  return {
    creatorId,
    label: label.trim() || DEFAULT_GOAL_LABEL,
    goalCents: Number.isFinite(goalCents) ? Math.max(0, Math.round(goalCents)) : 0,
  };
}

export function validateSpinGoal(goal: SpinGoal): SpinGoal {
  const label = goal.label.trim();

  if (!label || label.length > 40) {
    throw new Error("The goal label must be between 1 and 40 characters.");
  }

  const goalCents = Math.max(0, Math.round(goal.goalCents) || 0);

  if (goalCents > 10000000) {
    throw new Error("A tribute goal cannot be more than $100,000.");
  }

  return { ...goal, label, goalCents };
}

export async function getSpinGoal(creatorId: string): Promise<SpinGoal> {
  const snapshot = await getDoc(goalRef(creatorId));
  return mapGoal(creatorId, snapshot.data());
}

export async function saveSpinGoal(goal: SpinGoal) {
  const normalized = validateSpinGoal(goal);
  await setDoc(
    goalRef(goal.creatorId),
    {
      creatorId: normalized.creatorId,
      label: normalized.label,
      goalCents: normalized.goalCents,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  return normalized;
}

export function subscribeSpinGoal(
  creatorId: string,
  onChange: (goal: SpinGoal) => void,
): Unsubscribe {
  return onSnapshot(goalRef(creatorId), (snapshot) => {
    onChange(mapGoal(creatorId, snapshot.data()));
  });
}
