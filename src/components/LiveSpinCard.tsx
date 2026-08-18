import { Link } from "react-router-dom";
import { maxSpinAmountCents, totalWithServiceFee } from "../lib/spin";
import { derivePageTheme, glassPanelSurface } from "../lib/pageThemes";
import { formatMoney } from "../lib/money";
import type { CreatorProfile, SpinConfig } from "../lib/types";

type LiveSpinCardProps = {
  config: SpinConfig;
  preview?: boolean;
  profile: CreatorProfile;
};

export function LiveSpinCard({ config, preview = false, profile }: LiveSpinCardProps) {
  const maximumTotalCents = totalWithServiceFee(maxSpinAmountCents(config));
  const segmentSize = 360 / config.slices.length;
  const wheelGradient = `conic-gradient(${config.slices
    .map(
      (slice, index) =>
        `${slice.color} ${index * segmentSize}deg ${(index + 1) * segmentSize}deg`,
    )
    .join(", ")})`;
  const theme = derivePageTheme(profile.appearance);
  // The spin entry is the loudest action on the page, so it stays solid while
  // the surrounding surfaces are glass.
  const buttonStyle = {
    backgroundColor: theme.accent,
    borderColor: "transparent",
    color: theme.accentText,
  };

  return (
    <section
      className="mt-6 rounded-2xl border p-5 text-center backdrop-blur-md"
      style={glassPanelSurface(theme)}
    >
      <div className="mx-auto h-12 w-28 overflow-hidden" aria-hidden="true">
        <div
          className="mx-auto h-24 w-24 rounded-full border-2 border-white/70 shadow-sm"
          style={{ background: wheelGradient }}
        />
      </div>
      <p className="mt-3 text-xs font-semibold uppercase opacity-65">Live spins</p>
      {preview ? (
        <button
          className="mt-3 min-h-12 w-full rounded-2xl border px-4 py-3 text-sm font-semibold"
          disabled
          style={buttonStyle}
          type="button"
        >
          Authorize up to {formatMoney(maximumTotalCents)} to spin
        </button>
      ) : (
        <Link
          className="mt-3 flex min-h-12 items-center justify-center rounded-2xl border px-4 py-3 text-sm font-semibold shadow-sm"
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
