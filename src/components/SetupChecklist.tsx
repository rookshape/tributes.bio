import { ArrowRight, Check, ChevronDown, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { IconButton, Progress } from "./ui";
import { getCreatorPaymentAvailability } from "../lib/payments";
import { getTwitchConnection } from "../lib/twitch";
import { DEFAULT_APPEARANCE } from "../lib/pageThemes";
import type { CreatorLink, CreatorProfile } from "../lib/types";

type ChecklistItem = {
  id: string;
  title: string;
  description: string;
  done: boolean;
  /** Where the creator goes to finish it. */
  to: string;
  action: string;
};

/**
 * Dismissal lives in localStorage rather than Firestore: it is a UI nudge, not
 * creator work, and keeping it local avoids widening the user document's write
 * rules for something this small.
 */
const STORAGE_KEY = "tributes.setupChecklist";

type LocalState = { dismissed: boolean };

function readLocal(): LocalState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<LocalState>) : {};
    return { dismissed: Boolean(parsed.dismissed) };
  } catch {
    return { dismissed: false };
  }
}

function writeLocal(state: LocalState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // A blocked localStorage should not break the dashboard.
  }
}

export function SetupChecklist({
  creatorId,
  links,
  profile,
  spinEnabled,
}: {
  creatorId: string;
  links: CreatorLink[];
  profile: CreatorProfile;
  spinEnabled: boolean;
}) {
  const [local, setLocal] = useState<LocalState>(() => readLocal());
  const [open, setOpen] = useState(false);
  const [stripeReady, setStripeReady] = useState<boolean | null>(null);
  const [twitchReady, setTwitchReady] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;

    getCreatorPaymentAvailability(creatorId)
      .then((available) => active && setStripeReady(available))
      .catch(() => active && setStripeReady(false));

    getTwitchConnection()
      .then((connection) => active && setTwitchReady(connection.connected))
      .catch(() => active && setTwitchReady(false));

    return () => {
      active = false;
    };
  }, [creatorId]);

  const items = useMemo<ChecklistItem[]>(() => {
    const appearanceChanged =
      profile.appearance.hue !== DEFAULT_APPEARANCE.hue ||
      profile.appearance.tone !== DEFAULT_APPEARANCE.tone;

    return [
      {
        id: "link",
        title: "Add your first link",
        description: "Point people at your stream, socials, or store.",
        done: links.length > 0,
        to: "/dashboard",
        action: "Add a link",
      },
      {
        id: "appearance",
        title: "Pick your colours",
        description: "Set the hue and tone your page uses.",
        done: appearanceChanged,
        to: "/dashboard",
        action: "Open appearance",
      },
      {
        id: "stripe",
        title: "Connect Stripe",
        description: "Required before you can receive tips or spins.",
        done: stripeReady === true,
        to: "/dashboard/payments",
        action: "Connect",
      },
      {
        id: "wheel",
        title: "Build your wheel",
        description: "Turn on Spin and set what your viewers can land on.",
        done: spinEnabled,
        to: "/dashboard/spin",
        action: "Open wheel",
      },
      {
        id: "twitch",
        title: "Connect Twitch",
        description: "Optional. Goes live automatically when your stream starts.",
        done: twitchReady === true,
        to: "/dashboard/settings",
        action: "Connect",
      },
    ];
  }, [links.length, profile.appearance, spinEnabled, stripeReady, twitchReady]);

  const complete = items.filter((item) => item.done).length;

  // Hidden once dismissed, and once there is nothing left to do.
  if (local.dismissed || complete === items.length) return null;

  return (
    // Floats in the corner rather than sitting above the editor: it is a nudge,
    // and the page itself is the work.
    <div className="fixed bottom-4 right-4 z-40 w-[min(20rem,calc(100vw-2rem))]">
      {open ? (
        <section className="panel mb-2 max-h-[70vh] overflow-y-auto p-4 shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-body font-semibold text-content">Finish setting up</h2>
            <IconButton
              icon={<X size={14} />}
              label="Dismiss the setup checklist"
              onClick={() => {
                const next = { ...local, dismissed: true };
                setLocal(next);
                writeLocal(next);
              }}
              size="sm"
            />
          </div>

          <ul className="mt-3 grid gap-0.5">
            {items.map((item) => (
              <li
                className="flex items-center gap-2.5 rounded-control px-1.5 py-2 hover:bg-surface-raised"
                key={item.id}
              >
                <span
                  aria-hidden="true"
                  className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${
                    item.done
                      ? "border-positive bg-positive text-white"
                      : "border-line-strong"
                  }`}
                >
                  {item.done ? <Check size={10} strokeWidth={3} /> : null}
                </span>
                <span
                  className={`min-w-0 flex-1 truncate text-detail ${
                    item.done
                      ? "text-content-subtle line-through"
                      : "font-medium text-content"
                  }`}
                >
                  {item.title}
                </span>

                {!item.done ? (
                  <Link
                    className="flex shrink-0 items-center gap-0.5 text-caption font-medium text-accent hover:underline"
                    to={item.to}
                  >
                    {item.action}
                    <ArrowRight size={12} />
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <button
        aria-expanded={open}
        className="panel flex w-full items-center gap-3 p-3 text-left shadow-md transition-colors duration-fast hover:bg-surface-raised"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-detail font-semibold text-content">
            Finish setting up
          </span>
          <Progress
            className="mt-1.5"
            label="Steps complete"
            max={items.length}
            size="sm"
            value={complete}
          />
        </span>
        <span className="shrink-0 text-caption font-semibold text-content-muted [font-variant-numeric:tabular-nums]">
          {complete}/{items.length}
        </span>
        <ChevronDown
          className={`shrink-0 text-content-subtle transition-transform duration-fast ${
            open ? "" : "rotate-180"
          }`}
          size={16}
        />
      </button>
    </div>
  );
}
