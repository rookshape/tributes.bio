import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { SpinWheel, type SpinAnimation } from "../components/SpinWheel";
import { subscribeSpinConfig, subscribeSpinState } from "../lib/spin";
import type { SpinConfig, SpinState } from "../lib/types";

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function SpinOverlayPage() {
  const { creatorId = "" } = useParams();
  const [config, setConfig] = useState<SpinConfig | null>(null);
  const [state, setState] = useState<SpinState | null>(null);
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

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, []);

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
    <main className="grid min-h-screen w-full grid-cols-[minmax(0,1fr)_minmax(260px,34%)] items-center gap-10 overflow-hidden bg-transparent p-10 text-white">
      <section className="mx-auto w-full max-w-[760px]">
        <SpinWheel animation={animation} slices={config.slices} />
      </section>

      <section className="min-w-0 border-l-2 border-white/40 bg-black/75 px-10 py-12">
        <p className="text-xl font-semibold text-white/70">{config.counterLabel}</p>
        <p className="mt-2 text-7xl font-bold">{formatMoney(state?.counterCents ?? 0)}</p>

        <div className="mt-14 min-h-36">
          {state?.viewerName ? (
            <>
              <p className="truncate text-2xl text-white/70">{state.viewerName}</p>
              <p className="mt-2 text-5xl font-bold">
                {spinning ? "Spinning" : state.resultLabel}
              </p>
            </>
          ) : null}
        </div>

        <p className="mt-12 text-sm font-semibold text-white/55">Powered by Tributes</p>
      </section>
    </main>
  );
}
