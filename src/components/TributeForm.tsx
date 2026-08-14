import { LoaderCircle } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { createTributeCheckout } from "../lib/payments";
import type { CreatorProfile } from "../lib/types";

type TributeFormProps = {
  profile: CreatorProfile;
  result?: "success" | "canceled" | null;
};

const presets = [5, 10, 25];

function currency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function TributeForm({ profile, result }: TributeFormProps) {
  const [amount, setAmount] = useState("10");
  const [senderName, setSenderName] = useState("");
  const [message, setMessage] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amountCents = useMemo(() => {
    const parsed = Number(amount);
    return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
  }, [amount]);
  const validAmount = amountCents >= 100 && amountCents <= 50000;
  const feeCents = Math.round(amountCents * 0.25);
  const totalCents = amountCents + feeCents;
  const { appearance } = profile;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validAmount) {
      setError("Enter an amount from $1 to $500.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const url = await createTributeCheckout({
        creatorId: profile.id,
        amountCents,
        senderName,
        message,
        anonymous,
      });
      window.location.assign(url);
    } catch {
      setError("Could not start checkout. Please try again.");
      setLoading(false);
    }
  };

  return (
    <form
      className="mt-7 border-2 p-4 text-left"
      onSubmit={(event) => void submit(event)}
      style={{ borderColor: appearance.buttonColor }}
    >
      <h2 className="text-center text-base font-semibold">Send a tribute</h2>

      {result === "success" ? (
        <p className="mt-3 bg-emerald-50 px-3 py-2 text-center text-sm text-emerald-800">
          Payment received. Thank you.
        </p>
      ) : null}
      {result === "canceled" ? (
        <p className="mt-3 bg-zinc-100 px-3 py-2 text-center text-sm text-zinc-700">
          Checkout canceled.
        </p>
      ) : null}

      <div className="mt-4 grid grid-cols-3 gap-2">
        {presets.map((preset) => (
          <button
            className="min-h-10 border px-2 text-sm font-semibold"
            key={preset}
            onClick={() => setAmount(String(preset))}
            style={{
              backgroundColor:
                amount === String(preset)
                  ? appearance.buttonColor
                  : "transparent",
              borderColor: appearance.buttonColor,
              color:
                amount === String(preset)
                  ? appearance.buttonTextColor
                  : appearance.textColor,
            }}
            type="button"
          >
            ${preset}
          </button>
        ))}
      </div>

      <label className="mt-3 block text-sm font-medium" htmlFor="tribute-amount">
        Amount
      </label>
      <div className="relative mt-1">
        <span className="absolute inset-y-0 left-3 flex items-center text-zinc-500">
          $
        </span>
        <input
          className="h-11 w-full border border-zinc-300 bg-white pl-7 pr-3 text-base text-zinc-950 outline-none focus:border-zinc-600"
          id="tribute-amount"
          inputMode="decimal"
          max="500"
          min="1"
          onChange={(event) => setAmount(event.target.value)}
          step="0.01"
          type="number"
          value={amount}
        />
      </div>

      <label className="mt-3 block text-sm font-medium" htmlFor="tribute-name">
        Name <span className="font-normal opacity-60">(optional)</span>
      </label>
      <input
        className="mt-1 h-10 w-full border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-600 disabled:bg-zinc-100"
        disabled={anonymous}
        id="tribute-name"
        maxLength={80}
        onChange={(event) => setSenderName(event.target.value)}
        value={senderName}
      />

      <label className="mt-3 block text-sm font-medium" htmlFor="tribute-message">
        Message <span className="font-normal opacity-60">(optional)</span>
      </label>
      <textarea
        className="mt-1 min-h-20 w-full resize-y border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-zinc-600"
        id="tribute-message"
        maxLength={280}
        onChange={(event) => setMessage(event.target.value)}
        value={message}
      />

      <label className="mt-3 flex items-center gap-2 text-sm">
        <input
          checked={anonymous}
          className="h-4 w-4"
          onChange={(event) => setAnonymous(event.target.checked)}
          type="checkbox"
        />
        Send anonymously
      </label>

      <dl className="mt-4 grid gap-1 border-t pt-3 text-sm opacity-80">
        <div className="flex justify-between gap-4">
          <dt>Creator receives</dt>
          <dd>{currency(amountCents)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Service fee (25%)</dt>
          <dd>{currency(feeCents)}</dd>
        </div>
        <div className="flex justify-between gap-4 font-semibold opacity-100">
          <dt>Total</dt>
          <dd>{currency(totalCents)}</dd>
        </div>
      </dl>

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

      <button
        className="mt-4 flex min-h-12 w-full items-center justify-center px-4 text-sm font-semibold disabled:opacity-60"
        disabled={loading || !validAmount}
        style={{
          backgroundColor: appearance.buttonColor,
          color: appearance.buttonTextColor,
        }}
        type="submit"
      >
        {loading ? <LoaderCircle className="animate-spin" size={18} /> : `Pay ${currency(totalCents)}`}
      </button>
    </form>
  );
}
