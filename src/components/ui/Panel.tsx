import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export type PanelProps = {
  /** `raised` is the default card; `flat` recedes; `glass` is for previews and overlays. */
  tone?: "raised" | "flat" | "glass";
  padded?: boolean;
  className?: string;
  children: ReactNode;
};

const toneClass = {
  raised: "panel",
  flat: "panel-flat",
  glass: "glass",
} as const;

export function Panel({ tone = "raised", padded = true, className, children }: PanelProps) {
  return (
    <section className={cn(toneClass[tone], padded && "p-5", className)}>{children}</section>
  );
}

export type PanelHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  /** Buttons or controls aligned to the trailing edge. */
  actions?: ReactNode;
  className?: string;
};

export function PanelHeader({ title, description, actions, className }: PanelHeaderProps) {
  return (
    <header className={cn("flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 className="text-title font-semibold text-content">{title}</h2>
        {description ? (
          <p className="mt-1 text-detail text-content-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
};

export function PageHeader({ title, description, eyebrow, actions }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
        <h1 className="page-title">{title}</h1>
        {description ? <p className="page-subtitle">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
