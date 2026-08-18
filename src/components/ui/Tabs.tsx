import type { ReactNode } from "react";
import { useId, useRef } from "react";
import { cn } from "../../lib/cn";

export type TabItem<T extends string> = {
  value: T;
  label: ReactNode;
  /** Shown after the label — a count, or a status dot. */
  badge?: ReactNode;
};

export type TabsProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  items: TabItem<T>[];
  /** Announced as the tablist's purpose. */
  label: string;
  className?: string;
};

/**
 * Underlined tabs with roving arrow-key focus, per the WAI-ARIA tabs pattern:
 * the tablist is a single tab stop and arrows move between tabs.
 */
export function Tabs<T extends string>({
  value,
  onChange,
  items,
  label,
  className,
}: TabsProps<T>) {
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const moveFocus = (from: number, delta: number) => {
    const next = (from + delta + items.length) % items.length;
    onChange(items[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div
      aria-label={label}
      className={cn("flex gap-5 border-b border-line", className)}
      role="tablist"
    >
      {items.map((item, index) => {
        const selected = item.value === value;
        return (
          <button
            aria-controls={`${id}-${item.value}-panel`}
            aria-selected={selected}
            className={cn(
              "-mb-px flex items-center gap-2 border-b-2 pb-2.5 text-body font-medium transition-colors duration-fast",
              selected
                ? "border-accent text-content"
                : "border-transparent text-content-muted hover:text-content",
            )}
            id={`${id}-${item.value}-tab`}
            key={item.value}
            onClick={() => onChange(item.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight") {
                event.preventDefault();
                moveFocus(index, 1);
              }
              if (event.key === "ArrowLeft") {
                event.preventDefault();
                moveFocus(index, -1);
              }
            }}
            ref={(element) => {
              refs.current[index] = element;
            }}
            role="tab"
            tabIndex={selected ? 0 : -1}
            type="button"
          >
            {item.label}
            {item.badge}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel<T extends string>({
  value,
  activeValue,
  tabsId,
  children,
}: {
  value: T;
  activeValue: T;
  /** The `useId()` value the matching Tabs used, so ids line up. */
  tabsId?: string;
  children: ReactNode;
}) {
  if (value !== activeValue) return null;
  return (
    <div
      aria-labelledby={tabsId ? `${tabsId}-${value}-tab` : undefined}
      id={tabsId ? `${tabsId}-${value}-panel` : undefined}
      role="tabpanel"
      tabIndex={0}
    >
      {children}
    </div>
  );
}
