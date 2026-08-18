import { cn } from "../../lib/cn";

export type ProgressProps = {
  value: number;
  max?: number;
  /** Announced to screen readers; also shown when `showValue` is set. */
  label: string;
  showValue?: boolean;
  size?: "sm" | "md";
  className?: string;
};

export function Progress({
  value,
  max = 100,
  label,
  showValue = false,
  size = "md",
  className,
}: ProgressProps) {
  const safeMax = max > 0 ? max : 1;
  const clamped = Math.min(safeMax, Math.max(0, value));
  const percent = (clamped / safeMax) * 100;

  return (
    <div className={className}>
      {showValue ? (
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <span className="text-detail font-medium text-content-muted">{label}</span>
          <span className="text-detail font-semibold text-content [font-variant-numeric:tabular-nums]">
            {clamped} / {safeMax}
          </span>
        </div>
      ) : null}
      <div
        aria-label={showValue ? undefined : label}
        aria-valuemax={safeMax}
        aria-valuemin={0}
        aria-valuenow={clamped}
        className={cn(
          "overflow-hidden rounded-full bg-surface-sunken",
          size === "sm" ? "h-1.5" : "h-2.5",
        )}
        role="progressbar"
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-slow ease-standard"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
