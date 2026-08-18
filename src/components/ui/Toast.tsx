import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/cn";

export type ToastTone = "info" | "success" | "error";

type Toast = {
  id: number;
  tone: ToastTone;
  message: ReactNode;
};

type ToastContextValue = {
  /** Shows a transient message. Returns the id so callers can dismiss early. */
  toast: (message: ReactNode, options?: { tone?: ToastTone; duration?: number }) => number;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const toneIcon: Record<ToastTone, ReactNode> = {
  info: <Info size={16} />,
  success: <CheckCircle2 size={16} />,
  error: <TriangleAlert size={16} />,
};

const toneClass: Record<ToastTone, string> = {
  info: "text-content-muted",
  success: "text-positive",
  error: "text-critical",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback<ToastContextValue["toast"]>(
    (message, { tone = "info", duration = 4500 } = {}) => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, tone, message }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), duration),
      );
      return id;
    },
    [dismiss],
  );

  // Clear pending timers if the provider unmounts mid-flight.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 bottom-0 z-[120] flex flex-col items-center gap-2 p-4 sm:items-end"
        >
          {toasts.map((item) => (
            <div
              className="pointer-events-auto flex w-full max-w-sm animate-rise-in items-start gap-2.5 rounded-card border border-line bg-surface p-3 shadow-md"
              key={item.id}
            >
              <span className={cn("mt-0.5 shrink-0", toneClass[item.tone])}>
                {toneIcon[item.tone]}
              </span>
              <p className="min-w-0 flex-1 text-detail text-content">{item.message}</p>
              <button
                aria-label="Dismiss notification"
                className="-mr-0.5 -mt-0.5 shrink-0 rounded p-1 text-content-subtle hover:text-content"
                onClick={() => dismiss(item.id)}
                type="button"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside a ToastProvider");
  return context;
}
