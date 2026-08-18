import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  ExternalLink,
  ImagePlus,
  Link2,
  LoaderCircle,
  Plus,
  Trash2,
} from "lucide-react";
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useState,
} from "react";
import { Link } from "react-router-dom";
import { BioPageView } from "../components/BioPageView";
import { LiveSpinCard } from "../components/LiveSpinCard";
import { SetupChecklist } from "../components/SetupChecklist";
import { useAuth } from "../context/AuthContext";
import {
  createCreatorLink,
  deleteCreatorLink,
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

const fieldClass =
  "field py-2.5";

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
  const [now, setNow] = useState(Date.now());

  const isCreator = appUser?.accountType === "creator";

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

  const saveProfile = async (nextProfile = profile) => {
    setError(null);
    setStatus("saving");

    try {
      await updateCreatorProfile(profile.id, nextProfile);
      setStatus("saved");
      window.setTimeout(() => setStatus("idle"), 1600);
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

  const uploadPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

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
      setStatus("saved");
      window.setTimeout(() => setStatus("idle"), 1600);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not upload that image.",
      );
      setStatus("idle");
    } finally {
      event.target.value = "";
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

  const toggleLink = async (link: CreatorLink) => {
    const nextLink = { ...link, isActive: !link.isActive };
    changeLink(link.id, { isActive: nextLink.isActive });
    await saveLink(nextLink);
  };

  const removeLink = async (link: CreatorLink) => {
    if (!window.confirm(`Delete "${link.title}"?`)) {
      return;
    }

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

  const moveLink = async (index: number, direction: -1 | 1) => {
    const target = index + direction;

    if (target < 0 || target >= links.length) {
      return;
    }

    const nextLinks = [...links];
    [nextLinks[index], nextLinks[target]] = [
      nextLinks[target],
      nextLinks[index],
    ];
    const positionedLinks = nextLinks.map((link, position) => ({
      ...link,
      position,
    }));
    setLinks(positionedLinks);
    setStatus("saving");

    try {
      await reorderCreatorLinks(profile.id, positionedLinks);
      setStatus("saved");
      window.setTimeout(() => setStatus("idle"), 1600);
    } catch {
      setLinks(links);
      setError("Could not reorder your links.");
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
      <div className="page-header border-b liquid-divider">
        <div>
          <h1 className="page-title">Your page</h1>
          <p className="page-subtitle">
            tributes.bio/{profile.username}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="min-w-16 text-right text-xs text-zinc-500">
            {status === "saving" ? "Saving..." : null}
            {status === "saved" ? (
              <span className="inline-flex items-center gap-1">
                <Check size={14} /> Saved
              </span>
            ) : null}
          </span>
          <button
            aria-label="Copy page link"
            className="icon-button"
            onClick={copyPageUrl}
            title="Copy page link"
            type="button"
          >
            <Copy size={17} />
          </button>
          <Link
            aria-label="Open public page"
            className="icon-button"
            target="_blank"
            title="Open public page"
            to={`/${profile.username}`}
          >
            <ExternalLink size={17} />
          </Link>
          <label className="secondary-button min-h-10 cursor-pointer px-4">
            <input
              checked={profile.isPublished}
              className="h-4 w-4 accent-tribute"
              onChange={togglePublished}
              type="checkbox"
            />
            Published
          </label>
        </div>
      </div>

      {error ? (
        <div className="status-error mt-4">
          {error}
        </div>
      ) : null}

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
          <div className="segmented-control w-full grid-cols-3">
            {(["profile", "links", "appearance"] as EditorTab[]).map(
              (item) => (
                <button
                  className={`segmented-item capitalize ${
                    tab === item ? "segmented-item-active" : ""
                  }`}
                  key={item}
                  onClick={() => setTab(item)}
                  type="button"
                >
                  {item}
                </button>
              ),
            )}
          </div>

          {tab === "profile" ? (
            <div className="mt-7 grid gap-6">
              <div className="glass-panel flex items-center gap-4 p-5">
                {profile.photoURL ? (
                  <img
                    alt="Profile"
                    className="h-20 w-20 rounded-full object-cover"
                    src={profile.photoURL}
                  />
                ) : (
                  <div className="grid h-20 w-20 place-items-center rounded-full bg-ink text-xl font-semibold text-white shadow-sm">
                    {profile.displayName.charAt(0).toUpperCase() || "T"}
                  </div>
                )}
                <label className="secondary-button min-h-10 cursor-pointer px-4">
                  <ImagePlus size={17} />
                  Upload photo
                  <input
                    accept="image/*"
                    className="sr-only"
                    onChange={uploadPhoto}
                    type="file"
                  />
                </label>
              </div>

              <label className="grid gap-2 text-sm font-medium">
                Display name
                <input
                  className={fieldClass}
                  maxLength={80}
                  onChange={(event) =>
                    setProfile({ ...profile, displayName: event.target.value })
                  }
                  value={profile.displayName}
                />
              </label>

              <label className="grid gap-2 text-sm font-medium">
                Bio
                <textarea
                  className={`${fieldClass} min-h-28 resize-y`}
                  maxLength={160}
                  onChange={(event) =>
                    setProfile({ ...profile, bio: event.target.value })
                  }
                  value={profile.bio}
                />
                <span className="text-right text-xs font-normal text-zinc-500">
                  {profile.bio.length}/160
                </span>
              </label>

              <button
                className="primary-button w-fit"
                disabled={status === "saving"}
                onClick={() => saveProfile()}
                type="button"
              >
                Save profile
              </button>
            </div>
          ) : null}

          {tab === "links" ? (
            <div className="mt-7">
              <form
                className="glass-panel grid gap-3 p-5 sm:grid-cols-[1fr_1.4fr_auto]"
                onSubmit={addLink}
              >
                <label className="grid gap-2 text-sm font-medium">
                  Title
                  <input
                    className={fieldClass}
                    maxLength={80}
                    onChange={(event) => setNewTitle(event.target.value)}
                    placeholder="My website"
                    required
                    value={newTitle}
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  URL
                  <input
                    className={fieldClass}
                    onChange={(event) => setNewUrl(event.target.value)}
                    placeholder="example.com"
                    required
                    value={newUrl}
                  />
                </label>
                <button
                  aria-label="Add link"
                  className="icon-button mt-auto border-ink bg-ink text-white hover:bg-zinc-700 hover:text-white"
                  disabled={status === "saving"}
                  title="Add link"
                  type="submit"
                >
                  <Plus size={18} />
                </button>
              </form>

              <div className="mt-5 grid gap-3">
                {links.length === 0 ? (
                  <div className="soft-panel flex items-center justify-center gap-2 py-10 text-sm text-zinc-500">
                    <Link2 size={18} /> Add your first link above.
                  </div>
                ) : null}
                {links.map((link, index) => (
                  <article
                    className="glass-panel p-4"
                    key={link.id}
                  >
                    <div className="grid gap-3 sm:grid-cols-[1fr_1.5fr_auto]">
                      <input
                        aria-label="Link title"
                        className={fieldClass}
                        maxLength={80}
                        onChange={(event) =>
                          changeLink(link.id, { title: event.target.value })
                        }
                        value={link.title}
                      />
                      <input
                        aria-label="Link URL"
                        className={fieldClass}
                        onChange={(event) =>
                          changeLink(link.id, { url: event.target.value })
                        }
                        value={link.url}
                      />
                      <button
                        className="primary-button min-h-10 px-4"
                        onClick={() => saveLink(link)}
                        type="button"
                      >
                        Save
                      </button>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-sky/50 pt-3">
                      <label className="flex items-center gap-2 text-sm font-medium">
                        <input
                          checked={link.isActive}
                          className="h-4 w-4 accent-tribute"
                          onChange={() => toggleLink(link)}
                          type="checkbox"
                        />
                        Visible
                      </label>
                      <div className="flex items-center gap-1">
                        <button
                          aria-label="Move link up"
                          className="icon-button h-9 w-9 border-transparent bg-transparent disabled:opacity-30"
                          disabled={index === 0}
                          onClick={() => moveLink(index, -1)}
                          title="Move up"
                          type="button"
                        >
                          <ArrowUp size={17} />
                        </button>
                        <button
                          aria-label="Move link down"
                          className="icon-button h-9 w-9 border-transparent bg-transparent disabled:opacity-30"
                          disabled={index === links.length - 1}
                          onClick={() => moveLink(index, 1)}
                          title="Move down"
                          type="button"
                        >
                          <ArrowDown size={17} />
                        </button>
                        <button
                          aria-label="Delete link"
                          className="icon-button h-9 w-9 border-transparent bg-transparent text-red-600 hover:bg-red-50"
                          onClick={() => removeLink(link)}
                          title="Delete link"
                          type="button"
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
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
