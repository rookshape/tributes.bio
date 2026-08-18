import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import type { SpinAnimation } from "../components/SpinWheel";
import {
  OverlayGoalBar,
  OverlayQueue,
  OverlayTotal,
  OverlayWheel,
  type OverlayPart,
} from "../components/overlay/OverlayParts";
import { getWheel } from "../lib/wheels";
import {
  subscribeSpinConfig,
  subscribeSpinQueue,
  subscribeSpinState,
} from "../lib/spin";
import {
  DEFAULT_GOAL_LABEL,
  DEFAULT_OVERLAY_SETTINGS,
  subscribeOverlaySettings,
  subscribeSpinGoal,
  type SpinGoal,
  type SpinOverlaySettings,
} from "../lib/spinGoal";
import { playOverlaySound } from "../lib/overlaySounds";
import { OVERLAY_PING_MS, reportOverlayConnected } from "../lib/spinGoal";
import type { SpinConfig, SpinQueueEntry, SpinState } from "../lib/types";

function isOverlayPart(value: string | undefined): value is OverlayPart {
  return (
    value === "wheel" || value === "total" || value === "bar" || value === "queue"
  );
}

export function SpinOverlayPage() {
  const { creatorId = "", part } = useParams();
  const activePart: OverlayPart = isOverlayPart(part) ? part : "wheel";
  const [config, setConfig] = useState<SpinConfig | null>(null);
  const [state, setState] = useState<SpinState | null>(null);
  const [queue, setQueue] = useState<SpinQueueEntry[]>([]);
  const [goal, setGoal] = useState<SpinGoal>({
    creatorId,
    label: DEFAULT_GOAL_LABEL,
    goalCents: 0,
  });
  const [queuedWheel, setQueuedWheel] = useState<SpinConfig | null>(null);
  const [settings, setSettings] = useState<SpinOverlaySettings>({
    creatorId,
    ...DEFAULT_OVERLAY_SETTINGS,
  });
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const previousDocumentBackground = document.documentElement.style.background;
    const previousBodyBackground = document.body.style.background;
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";

    return () => {
      document.documentElement.style.background = previousDocumentBackground;
      document.body.style.background = previousBodyBackground;
    };
  }, []);

  useEffect(() => {
    if (!creatorId) return;
    const unsubscribeConfig = subscribeSpinConfig(creatorId, setConfig);
    const unsubscribeState = subscribeSpinState(creatorId, setState);
    return () => {
      unsubscribeConfig();
      unsubscribeState();
    };
  }, [creatorId]);

  // Only the queue source needs the queue collection open.
  useEffect(() => {
    if (!creatorId || activePart !== "queue") return;
    const unsubscribeQueue = subscribeSpinQueue(creatorId, setQueue);
    const unsubscribeSettings = subscribeOverlaySettings(creatorId, setSettings);
    return () => {
      unsubscribeQueue();
      unsubscribeSettings();
    };
  }, [creatorId, activePart]);

  useEffect(() => {
    if (!creatorId || activePart !== "bar") return;
    return subscribeSpinGoal(creatorId, setGoal);
  }, [creatorId, activePart]);

  // Only the wheel source makes noise. Every source shares this state, so
  // without that a streamer running all four would hear each sound four times.
  useEffect(() => {
    if (!creatorId || activePart !== "wheel") return;
    return subscribeOverlaySettings(creatorId, setSettings);
  }, [creatorId, activePart]);

  // Every sound is keyed off a spin id changing rather than a value, so a
  // reconnecting browser source does not replay the last result.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const soundedSpinRef = useRef<string | null>(null);
  const queueCountRef = useRef<number | null>(null);

  useEffect(() => {
    if (activePart !== "wheel" || !state?.spinId) return;
    if (soundedSpinRef.current === state.spinId) return;

    soundedSpinRef.current = state.spinId;
    playOverlaySound("spin", settingsRef.current.sound);

    const settleIn = Math.max(
      0,
      state.startedAtMs + state.durationMs - Date.now(),
    );
    const timer = window.setTimeout(() => {
      const won = (state.multiplier ?? 0) > 1 || (state.spinsAwarded ?? 0) > 0;
      playOverlaySound(won ? "win" : "result", settingsRef.current.sound);
    }, settleIn);

    return () => window.clearTimeout(timer);
  }, [activePart, state?.spinId, state?.startedAtMs, state?.durationMs, state?.multiplier, state?.spinsAwarded]);

  useEffect(() => {
    if (activePart !== "wheel") return;

    const waiting = queue.filter((entry) => entry.status === "queued").length;
    const previous = queueCountRef.current;
    queueCountRef.current = waiting;

    if (previous !== null && waiting > previous) {
      playOverlaySound("queue", settingsRef.current.sound);
    }
  }, [activePart, queue]);

  // The wheel source needs the queue only to notice arrivals.
  useEffect(() => {
    if (!creatorId || activePart !== "wheel") return;
    return subscribeSpinQueue(creatorId, setQueue);
  }, [creatorId, activePart]);

  // The wheel on screen follows the queue: whichever wheel the current spin ran
  // on, then the next viewer's once it settles. It never reverts on its own.
  useEffect(() => {
    const midSpin = Boolean(state && state.lockedUntilMs > Date.now());
    const wheelId = midSpin ? state?.wheelId : (state?.nextWheelId ?? state?.wheelId);

    if (!creatorId || !wheelId || wheelId === "current") {
      setQueuedWheel(null);
      return;
    }

    let active = true;
    getWheel(creatorId, wheelId)
      .then((wheel) => active && setQueuedWheel(wheel))
      .catch(() => active && setQueuedWheel(null));

    return () => {
      active = false;
    };
  }, [creatorId, state, state?.wheelId, state?.nextWheelId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, []);

  // Tell the dashboard this source is alive, so a streamer can see whether OBS
  // is actually receiving state rather than showing a frozen frame.
  useEffect(() => {
    if (!creatorId) return;

    const ping = () =>
      reportOverlayConnected(creatorId, activePart).catch(() => undefined);
    ping();
    const timer = window.setInterval(ping, OVERLAY_PING_MS);
    return () => window.clearInterval(timer);
  }, [creatorId, activePart]);

  if (!config?.isEnabled) {
    return <main className="min-h-screen bg-transparent" />;
  }

  const animation: SpinAnimation | null =
    state?.spinId && state.selectedIndex !== null
      ? {
          id: state.spinId,
          selectedIndex: state.selectedIndex,
          startedAtMs: state.startedAtMs,
          durationMs: state.durationMs,
        }
      : null;
  const spinning = Boolean(state && state.lockedUntilMs > now);

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-transparent p-4">
      {activePart === "wheel" ? (
        <OverlayWheel
          animation={animation}
          config={queuedWheel ?? config}
          onTick={() => playOverlaySound("tick", settingsRef.current.sound)}
        />
      ) : null}
      {activePart === "total" ? (
        <OverlayTotal
          config={queuedWheel ?? config}
          spinning={spinning}
          state={state}
        />
      ) : null}
      {activePart === "bar" ? (
        <OverlayGoalBar
          config={config}
          goalCents={goal.goalCents}
          goalLabel={goal.label}
          state={state}
        />
      ) : null}
      {activePart === "queue" ? (
        <OverlayQueue
          config={config}
          entries={queue.filter((entry) => entry.status === "queued")}
          hideNames={settings.queueHideNames}
          maxVisible={settings.queueMaxVisible}
          state={state}
        />
      ) : null}
    </main>
  );
}
