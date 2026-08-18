import {
  Check,
  Copy,
  ExternalLink,
  ImagePlus,
  LoaderCircle,
  Plus,
} from "lucide-react";
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";
import { BioPageView } from "../components/BioPageView";
import { LiveSpinCard } from "../components/LiveSpinCard";
import { ImageCropDialog } from "../components/ImageCropDialog";
import { LinkListEditor } from "../components/LinkListEditor";
import { SetupChecklist } from "../components/SetupChecklist";
import {
  Badge,
  Button,
  Dialog,
  IconButton,
  Input,
  Tabs,
  Textarea,
  Toggle,
  Tooltip,
} from "../components/ui";
import { useAuth } from "../context/AuthContext";
import {
  createCreatorLink,
  deleteCreatorLink,
  duplicateCreatorLink,
  getCreatorWorkspace,
  reorderCreatorLinks,
  updateCreatorLink,
  updateCreatorProfile,
  uploadProfilePhoto,
} from "../lib/bio";
import {
  getSpinConfig,
  spinSessionIsLive,
  subscribeSpinSession,
} from "../lib/spin";
import { HUE_MAX, HUE_STEP, TONE_STEP, hueTrack, toneTrack } from "../lib/pageThemes";
import type {
  CreatorLink,
  CreatorProfile,
  ProfileAppearance,
  SpinConfig,
  SpinSession,
} from "../lib/types";

type EditorTab = "profile" | "links" | "appearance";
type SaveStatus = "idle" | "saving" | "saved";

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;

  return (
    <span className="flex items-center gap-1.5 text-caption text-content-muted">
      {status === "saving" ? (
        <>
          <LoaderCircle className="animate-spin" size={13} /> Saving
        </>
      ) : (
        <>
          <Check size={13} /> Saved
        </>
      )}
    </span>
  );
}

function PersonalDashboard() {
  const { appUser } = useAuth();

  return (
    <section className="page-shell max-w-3xl">
      <p className="eyebrow">Personal account</p>
      <h1 className="mt-2 text-3xl font-semibold text-ink">
        {appUser?.displayName ?? appUser?.email ?? "Account"}
      </h1>
      <p className="mt-4 text-zinc-500">
        Payment history will appear here after tips launch.
      </p>
    </section>
  );
}

export function DashboardPage() {
  const { appUser, user } = useAuth();
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [links, setLinks] = useState<CreatorLink[]>([]);
  const [spinConfig, setSpinConfig] = useState<SpinConfig | null>(null);
  const [spinSession, setSpinSession] = useState<SpinSession | null>(null);
  const [tab, setTab] = useState<EditorTab>("profile");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [pendingDelete, setPendingDelete] = useState<CreatorLink | null>(null);
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);
  const [now, setNow] = useState(Date.now());

  const isCreator = appUser?.accountType === "creator";
  const saveProfileRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    if (!user || !isCreator) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);

    Promise.all([
      getCreatorWorkspace(user.uid),
      getSpinConfig(user.uid).catch(() => null),
    ])
      .then(([workspace, loadedSpinConfig]) => {
        if (active) {
          setProfile(workspace.profile);
          setLinks(workspace.links);
          setSpinConfig(loadedSpinConfig);
        }
      })
      .catch((caughtError) => {
        if (active) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Could not load your page.",
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [isCreator, user]);

  useEffect(() => {
    if (!user || !isCreator) {
      return;
    }

    return subscribeSpinSession(user.uid, setSpinSession);
  }, [isCreator, user]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  // Autosave profile edits, debounced. The first render after load must not
  // write, or opening the page would save it straight back.
  const savedProfileRef = useRef<string | null>(null);
  useEffect(() => {
    if (!profile) return;

    const snapshot = JSON.stringify({
      displayName: profile.displayName,
      bio: profile.bio,
      appearance: profile.appearance,
      isPublished: profile.isPublished,
      photoURL: profile.photoURL,
    });

    if (savedProfileRef.current === null) {
      savedProfileRef.current = snapshot;
      return;
    }

    if (savedProfileRef.current === snapshot) return;

    const timer = window.setTimeout(() => {
      savedProfileRef.current = snapshot;
      void saveProfileRef.current?.();
    }, 900);

    return () => window.clearTimeout(timer);
  }, [profile]);

  // Guards a debounced write that has not fired yet.
  const dirty = Boolean(
    profile &&
      savedProfileRef.current !== null &&
      savedProfileRef.current !==
        JSON.stringify({
          displayName: profile.displayName,
          bio: profile.bio,
          appearance: profile.appearance,
          isPublished: profile.isPublished,
          photoURL: profile.photoURL,
        }),
  );

  useEffect(() => {
    if (!dirty) return;

    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (!isCreator) {
    return <PersonalDashboard />;
  }

  if (loading) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <LoaderCircle className="animate-spin" size={24} />
      </div>
    );
  }

  if (!profile) {
    return (
      <section className="page-shell max-w-xl">
        <h1 className="text-2xl font-semibold">Could not load your page</h1>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </section>
    );
  }

  // The autosave effect runs before saveProfile is defined, so it calls through
  // a ref rather than depending on the function identity.
  saveProfileRef.current = () => saveProfile();

  const markSaved = () => {
    setStatus("saved");
    window.setTimeout(() => setStatus("idle"), 1600);
  };

  const saveProfile = async (nextProfile = profile) => {
    setError(null);
    setStatus("saving");

    try {
      await updateCreatorProfile(profile.id, nextProfile);
      markSaved();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not save your changes.",
      );
      setStatus("idle");
    }
  };

  const togglePublished = async () => {
    const nextProfile = { ...profile, isPublished: !profile.isPublished };
    setProfile(nextProfile);
    await saveProfile(nextProfile);
  };

  const choosePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Choose an image file.");
      return;
    }

    setPendingPhoto(file);
  };

  const uploadPhoto = async (file: File) => {
    setPendingPhoto(null);
    setError(null);
    setStatus("saving");

    try {
      const photo = await uploadProfilePhoto(
        profile.id,
        file,
        profile.photoPath,
      );
      const nextProfile = { ...profile, ...photo };
      setProfile(nextProfile);
      await updateCreatorProfile(profile.id, nextProfile);
      markSaved();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not upload that image.",
      );
      setStatus("idle");
    }
  };

  const addLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setStatus("saving");

    try {
      const link = await createCreatorLink(
        profile.id,
        newTitle,
        newUrl,
        links.length,
      );
      setLinks((current) => [...current, link]);
      setNewTitle("");
      setNewUrl("");
      setStatus("saved");
      window.setTimeout(() => setStatus("idle"), 1600);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not add that link.",
      );
      setStatus("idle");
    }
  };

  const changeLink = (linkId: string, changes: Partial<CreatorLink>) => {
    setLinks((current) =>
      current.map((link) =>
        link.id === linkId ? { ...link, ...changes } : link,
      ),
    );
  };

  const saveLink = async (link: CreatorLink) => {
    setError(null);
    setStatus("saving");

    try {
      const savedLink = await updateCreatorLink(profile.id, link);
      changeLink(link.id, savedLink);
      setStatus("saved");
      window.setTimeout(() => setStatus("idle"), 1600);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not save that link.",
      );
      setStatus("idle");
    }
  };

  const removeLink = async (link: CreatorLink) => {
    setPendingDelete(null);
    setError(null);
    setStatus("saving");

    try {
      await deleteCreatorLink(profile.id, link.id);
      const nextLinks = links.filter((item) => item.id !== link.id);
      setLinks(nextLinks);
      await reorderCreatorLinks(profile.id, nextLinks);
      setStatus("saved");
      window.setTimeout(() => setStatus("idle"), 1600);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not delete that link.",
      );
      setStatus("idle");
    }
  };

  const applyReorder = async (nextLinks: CreatorLink[]) => {
    const previous = links;
    setLinks(nextLinks);
    setStatus("saving");

    try {
      await reorderCreatorLinks(profile.id, nextLinks);
      markSaved();
    } catch {
      setLinks(previous);
      setError("Could not reorder your links.");
      setStatus("idle");
    }
  };

  const duplicateLink = async (link: CreatorLink) => {
    setError(null);
    setStatus("saving");

    try {
      setLinks(await duplicateCreatorLink(profile.id, link, links));
      markSaved();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Could not duplicate that link.",
      );
      setStatus("idle");
    }
  };

  // Slider drags update locally on every step so the preview tracks the thumb,
  // then write once on release rather than on each intermediate value.
  const changeAppearance = (changes: Partial<ProfileAppearance>) => {
    setProfile((current) =>
      current
        ? { ...current, appearance: { ...current.appearance, ...changes } }
        : current,
    );
  };

  const copyPageUrl = async () => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/${profile.username}`,
      );
      setStatus("saved");
      window.setTimeout(() => setStatus("idle"), 1600);
    } catch {
      setError("Could not copy the page link.");
    }
  };

  return (
    <section className="page-shell">
      <div className="page-header border-b border-line">
        <div>
          <h1 className="page-title">Your page</h1>
          <p className="page-subtitle">tributes.bio/{profile.username}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SaveIndicator status={status} />
          <Tooltip content="Copy your page link">
            <IconButton
              icon={<Copy size={17} />}
              label="Copy page link"
              onClick={copyPageUrl}
            />
          </Tooltip>
          <Link
            aria-label="Open public page"
            className="icon-button"
            target="_blank"
            title="Open public page"
            to={`/${profile.username}`}
          >
            <ExternalLink size={17} />
          </Link>
          {/* States what is true now, and the switch changes it. */}
          <div className="flex items-center gap-2.5 rounded-control border border-line bg-surface px-3 py-1.5">
            <Badge dot tone={profile.isPublished ? "positive" : "neutral"}>
              {profile.isPublished ? "Live" : "Hidden"}
            </Badge>
            <Toggle
              checked={profile.isPublished}
              hideLabel
              label="Published"
              onChange={togglePublished}
            />
          </div>
        </div>
      </div>

      {error ? (
        <div className="status-error mt-4">
          {error}
        </div>
      ) : null}

      <ImageCropDialog
        file={pendingPhoto}
        onCancel={() => setPendingPhoto(null)}
        onConfirm={(cropped) => void uploadPhoto(cropped)}
      />

      <Dialog
        footer={
          <>
            <Button onClick={() => setPendingDelete(null)} variant="secondary">
              Keep it
            </Button>
            <Button
              onClick={() => pendingDelete && void removeLink(pendingDelete)}
              variant="danger"
            >
              Delete link
            </Button>
          </>
        }
        onClose={() => setPendingDelete(null)}
        open={pendingDelete !== null}
        size="sm"
        title={`Delete "${pendingDelete?.title ?? ""}"?`}
      >
        <p className="text-body text-content-muted">
          It will be removed from your page straight away. This cannot be undone.
        </p>
      </Dialog>

      <SetupChecklist
        creatorId={profile.id}
        links={links}
        profile={profile}
        spinEnabled={Boolean(spinConfig?.isEnabled)}
      />

      {/* Below lg the editor and preview stack, so both are capped and centred
          rather than stretching across a narrow viewport. */}
      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_390px] lg:gap-8">
        <div className="mx-auto w-full max-w-xl lg:mx-0 lg:max-w-none">
          <Tabs
            items={[
              { value: "profile", label: "Profile" },
              { value: "links", label: "Links", badge: <Badge>{links.length}</Badge> },
              { value: "appearance", label: "Appearance" },
            ]}
            label="Page editor sections"
            onChange={setTab}
            value={tab}
          />

          {tab === "profile" ? (
            <div className="mt-7 grid gap-6">
              <div className="panel flex items-center gap-4 p-5">
                {profile.photoURL ? (
                  <img
                    alt="Profile"
                    className="h-20 w-20 rounded-full object-cover"
                    src={profile.photoURL}
                  />
                ) : (
                  <div className="grid h-20 w-20 place-items-center rounded-full bg-surface-sunken text-xl font-semibold text-content-muted">
                    {profile.displayName.charAt(0).toUpperCase() || "T"}
                  </div>
                )}
                <label className="secondary-button min-h-10 cursor-pointer px-4">
                  <ImagePlus size={17} />
                  Upload photo
                  <input
                    accept="image/*"
                    className="sr-only"
                    onChange={choosePhoto}
                    type="file"
                  />
                </label>
              </div>

              <Input
                label="Display name"
                maxLength={80}
                onChange={(event) =>
                  setProfile({ ...profile, displayName: event.target.value })
                }
                value={profile.displayName}
              />

              <Textarea
                label="Bio"
                maxLength={160}
                onChange={(event) => setProfile({ ...profile, bio: event.target.value })}
                trailing={`${profile.bio.length}/160`}
                value={profile.bio}
              />
            </div>
          ) : null}

          {tab === "links" ? (
            <div className="mt-7">
              <form
                className="panel grid gap-3 p-5 sm:grid-cols-[1fr_1.4fr_auto]"
                onSubmit={addLink}
              >
                <Input
                  label="Title"
                  maxLength={80}
                  onChange={(event) => setNewTitle(event.target.value)}
                  placeholder="My website"
                  required
                  value={newTitle}
                />
                <Input
                  label="URL"
                  onChange={(event) => setNewUrl(event.target.value)}
                  placeholder="example.com"
                  required
                  value={newUrl}
                />
                <Button
                  aria-label="Add link"
                  className="sm:mt-[26px]"
                  loading={status === "saving"}
                  type="submit"
                  variant="secondary"
                >
                  <Plus size={18} />
                </Button>
              </form>

              <div className="mt-5">
                <LinkListEditor
                  links={links}
                  onChange={changeLink}
                  onCommit={saveLink}
                  onDelete={setPendingDelete}
                  onDuplicate={duplicateLink}
                  onReorder={applyReorder}
                />
              </div>
            </div>
          ) : null}

          {tab === "appearance" ? (
            <div className="mt-7 grid gap-6">
              <div className="grid gap-5">
                <label className="block" htmlFor="page-hue">
                  <span className="mb-2 block text-detail font-medium text-content-muted">
                    Color
                  </span>
                  <input
                    className="theme-slider"
                    id="page-hue"
                    max={HUE_MAX}
                    min={0}
                    onChange={(event) =>
                      changeAppearance({ hue: Number(event.target.value) })
                    }
                    onKeyUp={() => void saveProfile()}
                    onPointerUp={() => void saveProfile()}
                    step={HUE_STEP}
                    style={{ background: hueTrack(profile.appearance.tone) }}
                    type="range"
                    value={profile.appearance.hue}
                  />
                </label>

                <label className="block" htmlFor="page-tone">
                  <span className="mb-2 block text-detail font-medium text-content-muted">
                    Light to dark
                  </span>
                  <input
                    className="theme-slider"
                    id="page-tone"
                    max={100}
                    min={0}
                    onChange={(event) =>
                      changeAppearance({ tone: Number(event.target.value) })
                    }
                    onKeyUp={() => void saveProfile()}
                    onPointerUp={() => void saveProfile()}
                    step={TONE_STEP}
                    style={{ background: toneTrack(profile.appearance.hue) }}
                    type="range"
                    value={profile.appearance.tone}
                  />
                </label>
              </div>

              <p className="text-caption text-content-subtle">
                Text and buttons adjust themselves to stay readable against whatever
                you pick. Changes save when you let go of the slider.
              </p>
            </div>
          ) : null}
        </div>

        <aside className="mx-auto w-full max-w-[380px] lg:sticky lg:top-6 lg:max-w-none lg:self-start">
          <p className="mb-3 text-center text-detail font-medium text-content-muted lg:text-left">
            Preview
          </p>
          <div className="preview-window mx-auto h-[620px] w-full max-w-[360px]">
            <div className="preview-screen">
              <BioPageView
                links={links}
                preview
                profile={profile}
                topContent={
                  spinConfig?.isEnabled && spinSessionIsLive(spinSession, now) ? (
                    <LiveSpinCard config={spinConfig} preview profile={profile} />
                  ) : null
                }
              />
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
