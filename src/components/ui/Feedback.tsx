import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export type BadgeTone = "neutral" | "accent" | "positive" | "caution" | "critical";

const badgeTone: Record<BadgeTone, string> = {
  neutral: "",
  accent: "border-accent/30 bg-accent/10 text-accent",
  positive: "border-positive/30 bg-positive/10 text-positive",
  caution: "border-caution/30 bg-caution/10 text-caution",
  critical: "border-critical/30 bg-critical/10 text-critical",
};

export function Badge({
  tone = "neutral",
  dot,
  className,
  children,
}: {
  tone?: BadgeTone;
  /** Shows a leading status dot in the badge's own color. */
  dot?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className={cn("badge", badgeTone[tone], className)}>
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

export function StatusMessage({
  tone,
  className,
  children,
}: {
  tone: "error" | "success";
  className?: string;
  children: ReactNode;
}) {
  if (!children) return null;
  return (
    <p
      className={cn(tone === "error" ? "status-error" : "status-success", className)}
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </p>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("skeleton block h-4 w-full", className)} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-line px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? <span className="text-content-subtle">{icon}</span> : null}
      <div>
        <p className="text-body font-medium text-content">{title}</p>
        {description ? (
          <p className="mx-auto mt-1 max-w-sm text-detail text-content-muted">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
