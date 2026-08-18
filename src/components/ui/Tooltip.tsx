import type { ReactNode } from "react";
import { useId, useState } from "react";
import { cn } from "../../lib/cn";

export type TooltipProps = {
  /** Plain text — a tooltip is a description, not a container for controls. */
  content: string;
  side?: "top" | "bottom";
  children: ReactNode;
  className?: string;
};

/**
 * Shows on hover and on keyboard focus, and dismisses on Escape, so it is not
 * a pointer-only affordance. The trigger keeps `aria-describedby` rather than a
 * `title`, which screen readers announce inconsistently.
 */
export function Tooltip({ content, side = "top", children, className }: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);

  return (
    <span
      className={cn("relative inline-flex", className)}
      onBlur={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span aria-describedby={open ? id : undefined} className="inline-flex">
        {children}
      </span>
      {open ? (
        <span
          className={cn(
            "pointer-events-none absolute left-1/2 z-50 w-max max-w-56 -translate-x-1/2 animate-fade-in rounded-control border border-line bg-surface px-2.5 py-1.5 text-caption text-content shadow-md",
            side === "top" ? "bottom-[calc(100%+6px)]" : "top-[calc(100%+6px)]",
          )}
          id={id}
          role="tooltip"
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
