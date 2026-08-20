import { LoaderCircle } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { tipFeeCents } from "../lib/money";
import { createTributeCheckout } from "../lib/payments";
import {
  derivePageTheme,
  glassPanelSurface,
  glassSurface,
} from "../lib/pageThemes";
import type { CreatorProfile } from "../lib/types";

type TributeFormProps = {
  profile: CreatorProfile;
  result?: "success" | "canceled" | null;
  /** Shown in the dashboard, where it must look right but do nothing. */
  preview?: boolean;
  /** Start with the optional fields already unfolded, for shots of that state. */
  openDetails?: boolean;
  /** Seeds the amount, so a shot can be taken of the form part-filled. */
  initialAmount?: string;
};

const presets = [5, 10, 25];

function currency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function TributeForm({
  initialAmount = "",
  openDetails = false,
  preview = false,
  profile,
  result,
}: TributeFormProps) {
  /**
   * Empty at rest.
   *
   * The form used to open with a preset chosen, a running total, and a pay
   * button — a whole checkout sitting on a page whose job is to show links.
   * Nothing appears until someone types an amount, which is the moment they
   * have decided to send something.
   */
  const [amount, setAmount] = useState(initialAmount);
  const [senderName, setSenderName] = useState("");
  const [message, setMessage] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  /**
   * Name, message, and anonymity start folded away.
   *
   * All three are optional, and together they were most of the form's height —
   * enough to push a creator's links off the screen on a phone, which is the
   * one thing a link-in-bio page has to get right. Someone who wants to sign
   * their tribute is one tap from doing so.
   */
  const [detailsOpen, setDetailsOpen] = useState(openDetails);
  const started = amount.trim() !== "";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amountCents = useMemo(() => {
    const parsed = Number(amount);
    return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
  }, [amount]);
  const validAmount = amountCents >= 100 && amountCents <= 50000;
  const feeCents = tipFeeCents(amountCents);
  const totalCents = amountCents + feeCents;
  const theme = derivePageTheme(profile.appearance);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (preview) return;

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
      className="mt-7 rounded-2xl border p-5 text-left backdrop-blur-md"
      onSubmit={(event) => void submit(event)}
      style={glassPanelSurface(theme)}
    >
      <h2 className="text-center text-base font-semibold">Send a tribute</h2>

      {result ? (
        <p
          className="mt-3 rounded-xl border px-3 py-2 text-center text-sm backdrop-blur-md"
          style={glassSurface(theme)}
        >
          {result === "success"
            ? "Payment received. Thank you."
            : "Checkout canceled."}
        </p>
      ) : null}

      <div className="relative mt-4">
        <span className="absolute inset-y-0 left-4 flex items-center text-base opacity-60">
          $
        </span>
        <input
          aria-label="Tip amount"
          className="field h-14 pl-8 pr-3 text-lg"
          id="tribute-amount"
          inputMode="decimal"
          max="500"
          min="1"
          onChange={(event) => setAmount(event.target.value)}
          placeholder="Enter tip"
          step="0.01"
          type="number"
          value={amount}
        />
      </div>

      {started ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {presets.map((preset) => (
            <button
              className="min-h-12 rounded-full border px-2 text-base font-semibold backdrop-blur-md"
              key={preset}
              onClick={() => setAmount(String(preset))}
              style={
                amount === String(preset)
                  ? {
                      backgroundColor: theme.accent,
                      borderColor: "transparent",
                      color: theme.accentText,
                    }
                  : glassSurface(theme)
              }
              type="button"
            >
              ${preset}
            </button>
          ))}
        </div>
      ) : null}

      {started && detailsOpen ? (
        <>
          <label
            className="mt-3 block text-sm font-medium"
            htmlFor="tribute-name"
          >
            Name <span className="font-normal opacity-60">(optional)</span>
          </label>
          <input
            className="field mt-1 h-12 py-2 disabled:opacity-60"
            disabled={anonymous}
            id="tribute-name"
            maxLength={80}
            onChange={(event) => setSenderName(event.target.value)}
            value={senderName}
          />

          <label
            className="mt-3 block text-sm font-medium"
            htmlFor="tribute-message"
          >
            Message <span className="font-normal opacity-60">(optional)</span>
          </label>
          <textarea
            className="field mt-1 min-h-20 resize-y"
            id="tribute-message"
            maxLength={280}
            onChange={(event) => setMessage(event.target.value)}
            value={message}
          />

          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              checked={anonymous}
              className="h-5 w-5"
              onChange={(event) => setAnonymous(event.target.checked)}
              type="checkbox"
            />
            Send anonymously
          </label>
        </>
      ) : started ? (
        <button
          className="mt-3 w-full text-left text-sm font-medium underline decoration-current/30 underline-offset-4 opacity-75 hover:opacity-100"
          onClick={() => setDetailsOpen(true)}
          type="button"
        >
          Add a name or message
        </button>
      ) : null}

      {started ? (
        <div className="mt-4 border-t border-current/15 pt-3">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-sm font-semibold">You pay</span>
            <span className="text-lg font-bold">{currency(totalCents)}</span>
          </div>
          <p className="mt-1 text-xs opacity-70">
            {currency(amountCents)} to {profile.displayName} plus a{" "}
            {currency(feeCents)} service fee.
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 text-center text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}

      {started ? (
        <button
          className="mt-4 flex min-h-[52px] w-full items-center justify-center rounded-full px-4 text-base font-semibold disabled:opacity-60"
          disabled={preview || loading || !validAmount}
          style={{ backgroundColor: theme.accent, color: theme.accentText }}
          type="submit"
        >
          {loading ? (
            <LoaderCircle className="animate-spin" size={18} />
          ) : (
            `Pay ${currency(totalCents)}`
          )}
        </button>
      ) : null}
    </form>
  );
}
