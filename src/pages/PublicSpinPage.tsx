import { LoaderCircle } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getCreatorByUsername } from "../lib/account";
import { WheelThumbnail } from "../components/WheelThumbnail";
import { subscribeWheels } from "../lib/wheels";
import {
  createSpinCheckout,
  getCreatorPaymentAvailability,
} from "../lib/payments";
import {
  getSpinConfig,
  maxSpinAmountCents,
  spinSessionIsLive,
  subscribeSpinReceipt,
  subscribeSpinSession,
  totalWithServiceFee,
} from "../lib/spin";
import { formatMoney } from "../lib/money";
import type {
  CreatorProfile,
  SpinConfig,
  SpinReceipt,
  SpinSession,
} from "../lib/types";

function receiptHeading(receipt: SpinReceipt) {
  if (receipt.status === "checkout") return "Confirming authorization";
  if (receipt.status === "authorized" || receipt.status === "queued") return "You're in the queue";
  if (receipt.status === "capturing") return "Your spin is starting";
  if (receipt.status === "bonus") return "Bonus spin";
  if (receipt.status === "completed") return receipt.resultLabel ?? "Spin complete";
  if (receipt.status === "payment_failed") return "Payment needs attention";
  return "Spin canceled";
}

function ReceiptView({ receipt }: { receipt: SpinReceipt | null }) {
  if (!receipt) {
    return <LoaderCircle className="animate-spin" />;
  }

  return (
    <div className="w-full max-w-md text-center">
      <p className="text-sm font-semibold text-content-muted">@{receipt.creatorUsername}</p>
      <h1 className="mt-3 text-3xl font-semibold">{receiptHeading(receipt)}</h1>
      {receipt.status === "queued" || receipt.status === "authorized" ? (
        <p className="mt-4 text-sm leading-6 text-content-muted">Watch the stream for your spin.</p>
      ) : null}
      {receipt.status === "bonus" ? (
        <p className="mt-4 text-sm leading-6 text-content-muted">You have been added back to the queue.</p>
      ) : null}
      {receipt.status === "completed" && receipt.totalCents !== null ? (
        <div className="mt-7 border-y border-line py-5">
          <p className="text-sm text-content-muted">Final charge</p>
          <p className="mt-1 text-4xl font-semibold">{formatMoney(receipt.totalCents)}</p>
          {receipt.creatorAmountCents !== null ? (
            <p className="mt-2 text-xs text-content-subtle">
              {formatMoney(receipt.creatorAmountCents)} result plus service fee
            </p>
          ) : null}
        </div>
      ) : null}
      <Link className="mt-7 inline-block text-sm font-semibold text-content underline decoration-line-strong underline-offset-4" to={`/${receipt.creatorUsername}`}>
        Back to profile
      </Link>
    </div>
  );
}

export function PublicSpinPage() {
  const { username = "" } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const receiptId = searchParams.get("receipt") ?? "";
  const [creator, setCreator] = useState<CreatorProfile | null>(null);
  const [config, setConfig] = useState<SpinConfig | null>(null);
  const [spinSession, setSpinSession] = useState<SpinSession | null>(null);
  const [receipt, setReceipt] = useState<SpinReceipt | null>(null);
  const [paymentsAvailable, setPaymentsAvailable] = useState(false);
  const [viewerName, setViewerName] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wheels, setWheels] = useState<SpinConfig[]>([]);
  const [chosenWheelId, setChosenWheelId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (receiptId) {
      setLoading(false);
      return subscribeSpinReceipt(receiptId, setReceipt);
    }

    let active = true;
    getCreatorByUsername(username)
      .then(async (profile) => {
        if (!profile?.isPublished || profile.moderationStatus !== "active") {
          return null;
        }

        const [loadedConfig, paymentAvailability] = await Promise.all([
          getSpinConfig(profile.id),
          getCreatorPaymentAvailability(profile.id),
        ]);
        return { profile, loadedConfig, paymentAvailability };
      })
      .then((result) => {
        if (!active) return;
        setCreator(result?.profile ?? null);
        setConfig(result?.loadedConfig ?? null);
        setPaymentsAvailable(result?.paymentAvailability ?? false);
      })
      .catch(() => {
        if (active) setCreator(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [receiptId, username]);

  useEffect(() => {
    if (!creator || receiptId) return;
    setSessionLoaded(false);
    return subscribeSpinSession(creator.id, (session) => {
      setSpinSession(session);
      setSessionLoaded(true);
    });
  }, [creator, receiptId]);

  useEffect(() => {
    if (!creator) return;
    return subscribeWheels(creator.id, setWheels);
  }, [creator]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  const live = Boolean(
    config?.isEnabled && spinSessionIsLive(spinSession, now),
  );

  useEffect(() => {
    if (!receiptId && !loading && sessionLoaded && (!creator || !live)) {
      navigate(`/${username}`, { replace: true });
    }
  }, [creator, live, loading, navigate, receiptId, sessionLoaded, username]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!creator) return;
    setSubmitting(true);
    setError(null);

    try {
      const url = await createSpinCheckout({
        creatorId: creator.id,
        senderName: viewerName,
        anonymous,
        wheelId: chosen.id,
      });
      window.location.assign(url);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not start authorization.",
      );
      setSubmitting(false);
    }
  };

  if (receiptId) {
    return (
      <main className="grid min-h-screen place-items-center bg-canvas px-5 text-content">
        <div className="panel w-full max-w-md p-8"><ReceiptView receipt={receipt} /></div>
      </main>
    );
  }

  if (loading || !sessionLoaded || !creator || !config || !live) {
    return <main className="min-h-screen bg-canvas" />;
  }

  // Viewers choose from the wheels the streamer offers; the price and the
  // maximum hold both come from the one they pick.
  const offered = wheels.filter((wheel) => wheel.availableToViewers && !wheel.archived);
  const chosen =
    offered.find((wheel) => wheel.id === chosenWheelId) ??
    offered.find((wheel) => wheel.isDefault) ??
    offered[0] ??
    config;
  const maximumCreatorCents = maxSpinAmountCents(chosen);
  const maximumTotalCents = totalWithServiceFee(maximumCreatorCents);

  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-5 py-10 text-content">
      <section className="panel w-full max-w-md p-6 sm:p-8">
        <p className="text-sm font-semibold text-content-muted">@{creator.username}</p>
        <h1 className="mt-2 text-3xl font-semibold">Join the spin queue</h1>

        {offered.length > 1 ? (
          <fieldset className="mt-6">
            <legend className="text-sm font-medium text-content-muted">
              Pick your wheel
            </legend>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {offered.map((wheel) => {
                const selected = wheel.id === chosen.id;
                return (
                  <label
                    className={`cursor-pointer rounded-card border p-3 text-center transition-colors duration-fast ${
                      selected
                        ? "border-accent bg-accent/5"
                        : "border-line hover:border-line-strong"
                    }`}
                    key={wheel.id}
                  >
                    <input
                      checked={selected}
                      className="sr-only"
                      name="wheel"
                      onChange={() => setChosenWheelId(wheel.id)}
                      type="radio"
                    />
                    <WheelThumbnail slices={wheel.slices} />
                    <span className="mt-2 block truncate text-sm font-medium text-content">
                      {wheel.name}
                    </span>
                    {/* Price to enter and the ceiling, because the ceiling is
                        what makes one wheel different from another. */}
                    <span className="block text-xs text-content-muted">
                      {formatMoney(wheel.spinPriceCents)} · up to{" "}
                      {formatMoney(maxSpinAmountCents(wheel))}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ) : null}
        {/* The ceiling is the deal, so it is stated plainly and up front rather
            than buried under the button. */}
        <dl className="mt-6 divide-y divide-line border-y border-line">
          <div className="flex items-baseline justify-between gap-4 py-3">
            <dt className="text-sm text-content-muted">To spin</dt>
            <dd className="text-lg font-semibold">
              {formatMoney(totalWithServiceFee(chosen.spinPriceCents))}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-3">
            <dt className="text-sm text-content-muted">Most you can pay</dt>
            <dd className="text-3xl font-semibold">{formatMoney(maximumTotalCents)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-sm leading-6 text-content-muted">
          Multipliers and bonus spins keep your run going, and what you owe climbs
          with each one — never past{" "}
          <span className="font-semibold text-content">
            {formatMoney(maximumTotalCents)}
          </span>
          . We hold that much now and release whatever your run does not reach.
          Service fee included; payments are handled by Stripe.
        </p>

        <form className="mt-8 grid gap-4" onSubmit={submit}>
          <label className="grid gap-2 text-sm font-medium">
            Name
            <input
              className="field h-12"
              disabled={anonymous}
              maxLength={40}
              onChange={(event) => setViewerName(event.target.value)}
              placeholder="Optional"
              value={viewerName}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-content-muted">
            <input checked={anonymous} onChange={(event) => setAnonymous(event.target.checked)} type="checkbox" />
            Join anonymously
          </label>
          {error ? <p className="status-error">{error}</p> : null}
          {!paymentsAvailable ? (
            <p className="text-sm text-content-muted">Spin payments are unavailable.</p>
          ) : null}
          <button
            className="primary-button h-12 w-full"
            disabled={submitting || !paymentsAvailable}
            type="submit"
          >
            {submitting ? "Opening checkout" : `Authorize up to ${formatMoney(maximumTotalCents)}`}
          </button>
        </form>
      </section>
    </main>
  );
}
