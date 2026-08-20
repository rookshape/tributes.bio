import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "./firebase";
import {
  DEFAULT_SOUND_SETTINGS,
  type SoundSettings,
} from "./overlaySounds";
import {
  DEFAULT_OVERLAY_APPEARANCE,
  isGoalShape,
  isOverlayPanelStyle,
  normalizeOverlayHue,
  normalizeOverlayTone,
  type OverlayAppearance,
} from "./overlayTheme";

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

export const DEFAULT_GOAL_LABEL = "Tribute Goal";

/**
 * Overlay sound settings live beside the goal because both are creator-level
 * and both have to be readable by the OBS browser source, which is signed out.
 */
export type SpinOverlaySettings = {
  creatorId: string;
  sound: SoundSettings;
  /** Colors for the goal bar, running total, and queue — never the wheel. */
  appearance: OverlayAppearance;
  /** Names shown on the queue source before it collapses into a count. */
  queueMaxVisible: number;
  /** Hide viewer names entirely, showing only positions. */
  queueHideNames: boolean;
};

export const DEFAULT_OVERLAY_SETTINGS: Omit<SpinOverlaySettings, "creatorId"> = {
  sound: DEFAULT_SOUND_SETTINGS,
  appearance: DEFAULT_OVERLAY_APPEARANCE,
  queueMaxVisible: 5,
  queueHideNames: false,
};

function mapOverlaySettings(
  creatorId: string,
  data: Record<string, unknown> | undefined,
): SpinOverlaySettings {
  const bool = (key: string, fallback: boolean) =>
    typeof data?.[key] === "boolean" ? (data[key] as boolean) : fallback;
  const volume = Number(data?.soundVolume);

  return {
    creatorId,
    sound: {
      enabled: bool("soundEnabled", DEFAULT_SOUND_SETTINGS.enabled),
      volume: Number.isFinite(volume)
        ? Math.min(100, Math.max(0, Math.round(volume)))
        : DEFAULT_SOUND_SETTINGS.volume,
      spin: bool("soundSpin", DEFAULT_SOUND_SETTINGS.spin),
      tick: bool("soundTick", DEFAULT_SOUND_SETTINGS.tick),
      result: bool("soundResult", DEFAULT_SOUND_SETTINGS.result),
      win: bool("soundWin", DEFAULT_SOUND_SETTINGS.win),
      queue: bool("soundQueue", DEFAULT_SOUND_SETTINGS.queue),
    },
    appearance: {
      hue: normalizeOverlayHue(data?.overlayHue),
      tone: normalizeOverlayTone(data?.overlayTone),
      vivid: bool("overlayVivid", DEFAULT_OVERLAY_APPEARANCE.vivid),
      goalShape: isGoalShape(data?.goalShape)
        ? data.goalShape
        : DEFAULT_OVERLAY_APPEARANCE.goalShape,
      goalRainbow: bool("goalRainbow", DEFAULT_OVERLAY_APPEARANCE.goalRainbow),
      panel: isOverlayPanelStyle(data?.overlayPanel)
        ? data.overlayPanel
        : DEFAULT_OVERLAY_APPEARANCE.panel,
    },
    queueMaxVisible: Math.min(
      10,
      Math.max(1, Math.round(Number(data?.queueMaxVisible)) || DEFAULT_OVERLAY_SETTINGS.queueMaxVisible),
    ),
    queueHideNames: bool("queueHideNames", DEFAULT_OVERLAY_SETTINGS.queueHideNames),
  };
}

export async function saveOverlaySettings(settings: SpinOverlaySettings) {
  await setDoc(
    goalRef(settings.creatorId),
    {
      creatorId: settings.creatorId,
      soundEnabled: settings.sound.enabled,
      soundVolume: Math.min(100, Math.max(0, Math.round(settings.sound.volume))),
      soundSpin: settings.sound.spin,
      soundTick: settings.sound.tick,
      soundResult: settings.sound.result,
      soundWin: settings.sound.win,
      soundQueue: settings.sound.queue,
      overlayHue: normalizeOverlayHue(settings.appearance.hue),
      overlayTone: normalizeOverlayTone(settings.appearance.tone),
      overlayVivid: settings.appearance.vivid,
      goalShape: settings.appearance.goalShape,
      goalRainbow: settings.appearance.goalRainbow,
      overlayPanel: settings.appearance.panel,
      queueMaxVisible: Math.min(10, Math.max(1, Math.round(settings.queueMaxVisible))),
      queueHideNames: settings.queueHideNames,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  return settings;
}

/**
 * Which OBS sources have checked in recently. A source that has not reported
 * within this window is treated as disconnected — long enough to survive a
 * missed beat, short enough that a closed OBS shows up quickly.
 */
export const OVERLAY_STALE_MS = 45000;
export const OVERLAY_PING_MS = 15000;

export type OverlayStatus = Record<string, number>;

const reportOverlayCall = httpsCallable<
  { creatorId: string; part: string },
  { part: string }
>(functions, "reportOverlayConnected");

export async function reportOverlayConnected(creatorId: string, part: string) {
  await reportOverlayCall({ creatorId, part });
}

export function subscribeOverlayStatus(
  creatorId: string,
  onChange: (status: OverlayStatus) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, "creators", creatorId, "spinSettings", "overlayStatus"),
    (snapshot) => {
      const data = snapshot.data() ?? {};
      const status: OverlayStatus = {};

      for (const [key, value] of Object.entries(data)) {
        if (key.endsWith("AtMs") && typeof value === "number") {
          status[key.replace(/AtMs$/, "")] = value;
        }
      }

      onChange(status);
    },
    () => onChange({}),
  );
}

export function subscribeOverlaySettings(
  creatorId: string,
  onChange: (settings: SpinOverlaySettings) => void,
): Unsubscribe {
  return onSnapshot(goalRef(creatorId), (snapshot) => {
    onChange(mapOverlaySettings(creatorId, snapshot.data()));
  });
}

function goalRef(creatorId: string) {
  return doc(db, "creators", creatorId, "spinSettings", "current");
}

function mapGoal(creatorId: string, data: Record<string, unknown> | undefined): SpinGoal {
  // "Tribute goal" was the previous default casing; move those creators onto
  // the new one rather than leaving a stored label frozen at the old spelling.
  const stored = typeof data?.label === "string" ? data.label : DEFAULT_GOAL_LABEL;
  const label = stored === "Tribute goal" ? DEFAULT_GOAL_LABEL : stored;
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
