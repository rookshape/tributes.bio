import type { ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "../../lib/cn";

export type MenuItem = {
  label: string;
  onSelect: () => void;
  icon?: ReactNode;
  /** Renders in the critical color and separates from the group above. */
  destructive?: boolean;
  disabled?: boolean;
};

export type MenuProps = {
  /** The control that opens the menu. Cloned with the trigger props it needs. */
  trigger: (props: {
    "aria-expanded": boolean;
    "aria-haspopup": "menu";
    onClick: () => void;
  }) => ReactNode;
  items: MenuItem[];
  align?: "start" | "end";
  className?: string;
};

/**
 * Dropdown menu with roving focus. Opens on click, closes on Escape, on outside
 * pointer-down, and after a selection; arrow keys move through the items and
 * focus returns to the trigger on close.
 */
export function Menu({ trigger, items, align = "end", className }: MenuProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) itemRefs.current[activeIndex]?.focus();
  }, [open, activeIndex]);

  const close = () => {
    setOpen(false);
    containerRef.current?.querySelector("button")?.focus();
  };

  const move = (delta: number) => {
    setActiveIndex((current) => (current + delta + items.length) % items.length);
  };

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      {trigger({
        "aria-expanded": open,
        "aria-haspopup": "menu",
        onClick: () => {
          setActiveIndex(0);
          setOpen((current) => !current);
        },
      })}

      {open ? (
        <div
          className={cn(
            "absolute top-[calc(100%+6px)] z-50 min-w-48 animate-scale-in rounded-card border border-line bg-surface p-1 shadow-lg",
            align === "end" ? "right-0" : "left-0",
          )}
          id={id}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              close();
            }
            if (event.key === "ArrowDown") {
              event.preventDefault();
              move(1);
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              move(-1);
            }
          }}
          role="menu"
        >
          {items.map((item, index) => (
            <button
              className={cn(
                "flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-body disabled:opacity-40",
                item.destructive
                  ? "text-critical hover:bg-critical/10"
                  : "text-content hover:bg-surface-raised",
              )}
              disabled={item.disabled}
              key={item.label}
              onClick={() => {
                item.onSelect();
                close();
              }}
              ref={(element) => {
                itemRefs.current[index] = element;
              }}
              role="menuitem"
              tabIndex={-1}
              type="button"
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
