import { ArrowRight, Check, X } from "lucide-react";
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
  /** Where the creator goes to finish it. Omitted for self-marked steps. */
  to?: string;
  action: string;
  onAction?: () => void;
};

/**
 * Dismissal and the OBS step live in localStorage rather than Firestore: they
 * are a UI nudge, not creator work, and keeping them local avoids widening the
 * user document's write rules for something this small.
 */
const STORAGE_KEY = "tributes.setupChecklist";

type LocalState = { dismissed: boolean; obsAdded: boolean };

function readLocal(): LocalState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<LocalState>) : {};
    return { dismissed: Boolean(parsed.dismissed), obsAdded: Boolean(parsed.obsAdded) };
  } catch {
    return { dismissed: false, obsAdded: false };
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
        action: "Open Spin",
      },
      {
        id: "twitch",
        title: "Connect Twitch",
        description: "Optional. Goes live automatically when your stream starts.",
        done: twitchReady === true,
        to: "/dashboard/settings",
        action: "Connect",
      },
      {
        id: "obs",
        title: "Add the OBS overlay",
        description: "Copy the browser source URLs into your scene.",
        done: local.obsAdded,
        action: local.obsAdded ? "Undo" : "Mark done",
        onAction: () => {
          const next = { ...local, obsAdded: !local.obsAdded };
          setLocal(next);
          writeLocal(next);
        },
      },
    ];
  }, [links.length, local, profile.appearance, spinEnabled, stripeReady, twitchReady]);

  const complete = items.filter((item) => item.done).length;

  // Hidden once dismissed, and once there is nothing left to do.
  if (local.dismissed || complete === items.length) return null;

  return (
    <section className="panel mb-6 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-title font-semibold text-content">Finish setting up</h2>
          <p className="mt-1 text-detail text-content-muted">
            You can do these in any order.
          </p>
        </div>
        <IconButton
          icon={<X size={16} />}
          label="Dismiss the setup checklist"
          onClick={() => {
            const next = { ...local, dismissed: true };
            setLocal(next);
            writeLocal(next);
          }}
          size="sm"
        />
      </div>

      <Progress
        className="mt-4"
        label="Steps complete"
        max={items.length}
        showValue
        value={complete}
      />

      <ul className="mt-5 grid gap-1">
        {items.map((item) => (
          <li
            className="flex items-center gap-3 rounded-control px-2 py-2.5 hover:bg-surface-raised"
            key={item.id}
          >
            <span
              aria-hidden="true"
              className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                item.done
                  ? "border-positive bg-positive text-white"
                  : "border-line-strong"
              }`}
            >
              {item.done ? <Check size={12} strokeWidth={3} /> : null}
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={`block text-body font-medium ${
                  item.done ? "text-content-muted line-through" : "text-content"
                }`}
              >
                {item.title}
              </span>
              {!item.done ? (
                <span className="block text-caption text-content-muted">
                  {item.description}
                </span>
              ) : null}
            </span>

            {item.onAction ? (
              <button
                className="shrink-0 text-caption font-medium text-accent hover:underline"
                onClick={item.onAction}
                type="button"
              >
                {item.action}
              </button>
            ) : !item.done && item.to ? (
              <Link
                className="flex shrink-0 items-center gap-1 text-caption font-medium text-accent hover:underline"
                to={item.to}
              >
                {item.action}
                <ArrowRight size={13} />
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
