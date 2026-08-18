import { Check, Disc3, LoaderCircle, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { EditableSpinWheel } from "../components/EditableSpinWheel";
import {
  Badge,
  Button,
  Dialog,
  EmptyState,
  Input,
  Menu,
  StatusMessage,
} from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { spinSessionIsLive, subscribeSpinSession } from "../lib/spin";
import {
  WHEEL_TEMPLATES,
  activateWheel,
  createWheel,
  deleteWheel,
  duplicateWheel,
  ensureWheelLibrary,
  setWheelArchived,
  subscribeActiveWheelId,
  subscribeWheels,
  wheelFromTemplate,
} from "../lib/wheels";
import type { SpinConfig, SpinSession } from "../lib/types";

function WheelCard({
  wheel,
  active,
  locked,
  onActivate,
  onDuplicate,
  onArchive,
  onDelete,
}: {
  wheel: SpinConfig;
  active: boolean;
  locked: boolean;
  onActivate: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="panel flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
      <Link
        aria-label={`Edit ${wheel.name}`}
        className="mx-auto w-24 shrink-0 sm:mx-0"
        to={`/dashboard/spin/${wheel.id}`}
      >
        <EditableSpinWheel
          onAdd={() => undefined}
          onSelect={() => undefined}
          selectedSliceId=""
          slices={wheel.slices}
        />
      </Link>

      <div className="min-w-0 flex-1 text-center sm:text-left">
        <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
          <Link
            className="text-body font-semibold text-content hover:underline"
            to={`/dashboard/spin/${wheel.id}`}
          >
            {wheel.name}
          </Link>
          {active ? <Badge dot tone="positive">Active</Badge> : null}
          {wheel.archived ? <Badge>Archived</Badge> : null}
        </div>
        <p className="mt-1 text-caption text-content-muted">
          {wheel.slices.length} slices · ${(wheel.spinPriceCents / 100).toFixed(0)} a spin
          {wheel.isEnabled ? " · Spin enabled" : ""}
        </p>
      </div>

      <div className="flex shrink-0 items-center justify-center gap-2">
        {active ? (
          <Button disabled iconLeft={<Check size={16} />} size="sm" variant="secondary">
            Active
          </Button>
        ) : (
          <Button
            disabled={locked}
            onClick={onActivate}
            size="sm"
            title={locked ? "End the live session before switching wheels" : undefined}
            variant="primary"
          >
            Make active
          </Button>
        )}

        <Menu
          items={[
            { label: "Edit", onSelect: () => undefined, disabled: true },
            { label: "Duplicate", onSelect: onDuplicate },
            {
              label: wheel.archived ? "Restore" : "Archive",
              onSelect: onArchive,
            },
            {
              label: "Delete",
              destructive: true,
              disabled: active,
              onSelect: onDelete,
            },
          ].filter((item) => item.label !== "Edit")}
          trigger={(triggerProps) => (
            <button
              {...triggerProps}
              aria-label={`Actions for ${wheel.name}`}
              className="icon-button h-9 w-9"
              type="button"
            >
              <span aria-hidden="true" className="text-lg leading-none">···</span>
            </button>
          )}
        />
      </div>
    </article>
  );
}

export function WheelLibraryPage() {
  const { appUser, user } = useAuth();
  const navigate = useNavigate();
  const creatorId = appUser?.creatorId ?? user?.uid;
  const isCreator = appUser?.accountType === "creator" && Boolean(creatorId);

  const [wheels, setWheels] = useState<SpinConfig[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [session, setSession] = useState<SpinSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [templateId, setTemplateId] = useState(WHEEL_TEMPLATES[0].id);
  const [pendingDelete, setPendingDelete] = useState<SpinConfig | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!isCreator || !creatorId) {
      setLoading(false);
      return;
    }

    const unsubscribers = [
      subscribeWheels(creatorId, setWheels),
      subscribeActiveWheelId(creatorId, setActiveId),
      subscribeSpinSession(creatorId, setSession),
    ];

    // Brings pre-library creators onto it without losing their existing wheel.
    ensureWheelLibrary(creatorId)
      .catch((caughtError) =>
        setError(
          caughtError instanceof Error ? caughtError.message : "Could not load your wheels.",
        ),
      )
      .finally(() => setLoading(false));

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [creatorId, isCreator]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(timer);
  }, []);

  if (!isCreator || !creatorId) {
    return (
      <section className="page-shell max-w-2xl">
        <h1 className="page-title">Wheels are for creator accounts</h1>
      </section>
    );
  }

  if (loading) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <LoaderCircle className="animate-spin" size={24} />
      </div>
    );
  }

  const isLive = spinSessionIsLive(session, now);

  const run = async (action: () => Promise<unknown>) => {
    setWorking(true);
    setError(null);
    try {
      await action();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "That did not work.");
    } finally {
      setWorking(false);
    }
  };

  const create = () =>
    void run(async () => {
      const wheel = await createWheel(
        creatorId,
        wheelFromTemplate(creatorId, templateId, newName.trim() || "New wheel"),
      );
      setCreating(false);
      setNewName("");
      navigate(`/dashboard/spin/${wheel.id}`);
    });

  const visible = wheels.filter((wheel) => showArchived || !wheel.archived);
  const archivedCount = wheels.filter((wheel) => wheel.archived).length;

  return (
    <section className="page-shell">
      <header className="page-header border-b border-line">
        <div>
          <h1 className="page-title">Wheels</h1>
          <p className="page-subtitle">
            {isLive
              ? "You are live. The active wheel is locked until the session ends."
              : "Pick which wheel your viewers spin."}
          </p>
        </div>
        <Button iconLeft={<Plus size={17} />} onClick={() => setCreating(true)} variant="accent">
          New wheel
        </Button>
      </header>

      <StatusMessage className="mt-5" tone="error">{error}</StatusMessage>

      {visible.length === 0 ? (
        <EmptyState
          action={
            <Button onClick={() => setCreating(true)} variant="accent">
              Create a wheel
            </Button>
          }
          className="mt-6"
          description="Start from a template and adjust it however you like."
          icon={<Disc3 size={22} />}
          title="No wheels yet"
        />
      ) : (
        <div className="mt-6 grid gap-3">
          {visible.map((wheel) => (
            <WheelCard
              active={wheel.id === activeId}
              key={wheel.id}
              locked={isLive}
              onActivate={() => void run(() => activateWheel(wheel))}
              onArchive={() => void run(() => setWheelArchived(wheel, !wheel.archived))}
              onDelete={() => setPendingDelete(wheel)}
              onDuplicate={() => void run(() => duplicateWheel(wheel))}
              wheel={wheel}
            />
          ))}
        </div>
      )}

      {archivedCount > 0 ? (
        <button
          className="mt-5 text-detail font-medium text-accent hover:underline"
          onClick={() => setShowArchived((current) => !current)}
          type="button"
        >
          {showArchived ? "Hide" : "Show"} {archivedCount} archived
        </button>
      ) : null}

      <Dialog
        footer={
          <>
            <Button onClick={() => setCreating(false)} variant="secondary">
              Cancel
            </Button>
            <Button loading={working} onClick={create} variant="accent">
              Create wheel
            </Button>
          </>
        }
        onClose={() => setCreating(false)}
        open={creating}
        title="New wheel"
      >
        <Input
          label="Name"
          maxLength={60}
          onChange={(event) => setNewName(event.target.value)}
          placeholder="Friday night wheel"
          value={newName}
        />

        <fieldset className="mt-5">
          <legend className="text-detail font-medium text-content-muted">Start from</legend>
          <div className="mt-2 grid gap-2">
            {WHEEL_TEMPLATES.map((entry) => (
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-card border p-3 transition-colors duration-fast ${
                  templateId === entry.id
                    ? "border-accent bg-accent/5"
                    : "border-line hover:border-line-strong"
                }`}
                key={entry.id}
              >
                <input
                  checked={templateId === entry.id}
                  className="sr-only"
                  name="template"
                  onChange={() => setTemplateId(entry.id)}
                  type="radio"
                />
                <span className="min-w-0">
                  <span className="block text-body font-medium text-content">{entry.name}</span>
                  <span className="mt-0.5 block text-caption text-content-muted">
                    {entry.description}
                  </span>
                </span>
                {templateId === entry.id ? (
                  <Check className="ml-auto shrink-0 text-accent" size={17} />
                ) : null}
              </label>
            ))}
          </div>
        </fieldset>
      </Dialog>

      <Dialog
        footer={
          <>
            <Button onClick={() => setPendingDelete(null)} variant="secondary">
              Keep it
            </Button>
            <Button
              onClick={() => {
                const target = pendingDelete;
                setPendingDelete(null);
                if (target) void run(() => deleteWheel(creatorId, target.id));
              }}
              variant="danger"
            >
              Delete wheel
            </Button>
          </>
        }
        onClose={() => setPendingDelete(null)}
        open={pendingDelete !== null}
        size="sm"
        title={`Delete "${pendingDelete?.name ?? ""}"?`}
      >
        <p className="text-body text-content-muted">
          This cannot be undone. Archive it instead if you might want it back.
        </p>
      </Dialog>
    </section>
  );
}
