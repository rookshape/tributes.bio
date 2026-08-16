import { Link } from "react-router-dom";
import { maxSpinAmountCents, totalWithServiceFee } from "../lib/spin";
import type { CreatorProfile, SpinConfig } from "../lib/types";

type LiveSpinCardProps = {
  config: SpinConfig;
  preview?: boolean;
  profile: CreatorProfile;
};

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function LiveSpinCard({ config, preview = false, profile }: LiveSpinCardProps) {
  const maximumTotalCents = totalWithServiceFee(maxSpinAmountCents(config));
  const segmentSize = 360 / config.slices.length;
  const wheelGradient = `conic-gradient(${config.slices
    .map(
      (slice, index) =>
        `${slice.color} ${index * segmentSize}deg ${(index + 1) * segmentSize}deg`,
    )
    .join(", ")})`;
  const buttonStyle = {
    backgroundColor:
      profile.appearance.buttonStyle === "solid"
        ? profile.appearance.buttonColor
        : "transparent",
    borderColor: profile.appearance.buttonColor,
    color:
      profile.appearance.buttonStyle === "solid"
        ? profile.appearance.buttonTextColor
        : profile.appearance.buttonColor,
  };

  return (
    <section className="mt-6 border-y border-current/20 py-5 text-center">
      <div className="mx-auto h-12 w-28 overflow-hidden" aria-hidden="true">
        <div
          className="mx-auto h-24 w-24 rounded-full border-4 border-current shadow-sm"
          style={{ background: wheelGradient }}
        />
      </div>
      <p className="mt-3 text-xs font-semibold uppercase opacity-65">Live spins</p>
      {preview ? (
        <button
          className="mt-3 min-h-12 w-full border-2 px-4 py-3 text-sm font-semibold"
          disabled
          style={buttonStyle}
          type="button"
        >
          Authorize up to {formatMoney(maximumTotalCents)} to spin
        </button>
      ) : (
        <Link
          className="mt-3 flex min-h-12 items-center justify-center border-2 px-4 py-3 text-sm font-semibold"
          style={buttonStyle}
          to={`/${profile.username}/spin`}
        >
          Authorize up to {formatMoney(maximumTotalCents)} to spin
        </Link>
      )}
      <p className="mt-2 text-xs opacity-60">Charged after the result</p>
    </section>
  );
}
