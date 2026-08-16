import { LoaderCircle } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getCreatorByUsername } from "../lib/account";
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
import type {
  CreatorProfile,
  SpinConfig,
  SpinReceipt,
  SpinSession,
} from "../lib/types";

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

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
      <p className="text-sm font-semibold text-white/55">@{receipt.creatorUsername}</p>
      <h1 className="mt-3 text-3xl font-semibold">{receiptHeading(receipt)}</h1>
      {receipt.status === "queued" || receipt.status === "authorized" ? (
        <p className="mt-4 text-sm leading-6 text-white/65">Watch the stream for your spin.</p>
      ) : null}
      {receipt.status === "bonus" ? (
        <p className="mt-4 text-sm leading-6 text-white/65">You have been added back to the queue.</p>
      ) : null}
      {receipt.status === "completed" && receipt.totalCents !== null ? (
        <div className="mt-7 border-y border-white/20 py-5">
          <p className="text-sm text-white/55">Final charge</p>
          <p className="mt-1 text-4xl font-semibold">{formatMoney(receipt.totalCents)}</p>
          {receipt.creatorAmountCents !== null ? (
            <p className="mt-2 text-xs text-white/50">
              {formatMoney(receipt.creatorAmountCents)} result plus service fee
            </p>
          ) : null}
        </div>
      ) : null}
      <Link className="mt-7 inline-block text-sm font-semibold text-emerald-400" to={`/${receipt.creatorUsername}`}>
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
      <main className="grid min-h-screen place-items-center bg-zinc-950 px-5 text-white">
        <ReceiptView receipt={receipt} />
      </main>
    );
  }

  if (loading || !sessionLoaded || !creator || !config || !live) {
    return <main className="min-h-screen bg-zinc-950" />;
  }

  const maximumCreatorCents = maxSpinAmountCents(config);
  const maximumTotalCents = totalWithServiceFee(maximumCreatorCents);

  return (
    <main className="grid min-h-screen place-items-center bg-zinc-950 px-5 py-10 text-white">
      <section className="w-full max-w-md">
        <p className="text-sm font-semibold text-white/55">@{creator.username}</p>
        <h1 className="mt-2 text-3xl font-semibold">Join the spin queue</h1>
        <p className="mt-6 text-sm text-white/60">Maximum authorization</p>
        <p className="mt-1 text-4xl font-semibold">{formatMoney(maximumTotalCents)}</p>
        <p className="mt-3 text-sm leading-6 text-white/55">
          Your final charge is based on the live wheel result. Any unused hold is released.
        </p>

        <form className="mt-8 grid gap-4" onSubmit={submit}>
          <label className="grid gap-2 text-sm font-medium">
            Name
            <input
              className="h-12 border border-white/30 bg-transparent px-3 outline-none focus:border-white disabled:opacity-40"
              disabled={anonymous}
              maxLength={40}
              onChange={(event) => setViewerName(event.target.value)}
              placeholder="Optional"
              value={viewerName}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-white/75">
            <input checked={anonymous} onChange={(event) => setAnonymous(event.target.checked)} type="checkbox" />
            Join anonymously
          </label>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          {!paymentsAvailable ? (
            <p className="text-sm text-white/55">Spin payments are unavailable.</p>
          ) : null}
          <button
            className="h-12 bg-white px-4 font-semibold text-zinc-950 disabled:opacity-50"
            disabled={submitting || !paymentsAvailable}
            type="submit"
          >
            {submitting ? "Opening checkout" : `Authorize ${formatMoney(maximumTotalCents)}`}
          </button>
        </form>
      </section>
    </main>
  );
}
