import type { ReactNode } from "react";
import { useId } from "react";
import { cn } from "../../lib/cn";

export type ToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  /** Hides the label visually but keeps it for screen readers. */
  hideLabel?: boolean;
  className?: string;
};

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
  hideLabel,
  className,
}: ToggleProps) {
  const id = useId();

  const control = (
    <button
      aria-checked={checked}
      aria-describedby={description ? `${id}-description` : undefined}
      aria-label={hideLabel && typeof label === "string" ? label : undefined}
      aria-labelledby={hideLabel ? undefined : `${id}-label`}
      className={cn(
        "relative h-6 w-10 shrink-0 rounded-full border transition-colors duration-fast",
        checked ? "border-accent bg-accent" : "border-line bg-surface-raised",
        disabled && "pointer-events-none opacity-45",
      )}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      role="switch"
      type="button"
    >
      <span
        className={cn(
          "absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow-xs transition-[left] duration-fast ease-standard",
          checked ? "left-[calc(100%-1.125rem)]" : "left-0.5",
        )}
      />
    </button>
  );

  if (hideLabel) return <span className={className}>{control}</span>;

  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <span className="block text-body font-medium text-content" id={`${id}-label`}>
          {label}
        </span>
        {description ? (
          <p className="mt-0.5 text-caption text-content-muted" id={`${id}-description`}>
            {description}
          </p>
        ) : null}
      </div>
      {control}
    </div>
  );
}

export type SegmentedControlProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: ReactNode }>;
  /** Announced to screen readers as the group's purpose. */
  label: string;
  className?: string;
};

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div aria-label={label} className={cn("segmented-control", className)} role="tablist">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            aria-selected={active}
            className={cn("segmented-item", active && "segmented-item-active")}
            key={option.value}
            onClick={() => onChange(option.value)}
            role="tab"
            type="button"
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
