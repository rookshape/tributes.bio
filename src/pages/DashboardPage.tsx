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
import type {
  ButtonStyle,
  CreatorLink,
  CreatorProfile,
  ProfileAppearance,
  SpinConfig,
  SpinSession,
} from "../lib/types";

type EditorTab = "profile" | "links" | "appearance";
type SaveStatus = "idle" | "saving" | "saved";

const fieldClass =
  "w-full border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-600";

function PersonalDashboard() {
  const { appUser } = useAuth();

  return (
    <section className="mx-auto w-full max-w-3xl px-5 py-12">
      <p className="text-sm font-semibold text-tribute">Personal account</p>
      <h1 className="mt-2 text-3xl font-semibold">
        {appUser?.displayName ?? appUser?.email ?? "Account"}
      </h1>
      <p className="mt-4 text-zinc-600">
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
      <section className="mx-auto max-w-xl px-5 py-14">
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

  const updateAppearance = (
    key: keyof ProfileAppearance,
    value: string,
  ) => {
    setProfile((current) =>
      current
        ? {
            ...current,
            appearance: { ...current.appearance, [key]: value },
          }
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
    <section className="mx-auto w-full max-w-7xl px-5 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <h1 className="text-2xl font-semibold">Your page</h1>
          <p className="mt-1 text-sm text-zinc-500">
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
            className="grid h-10 w-10 place-items-center border border-zinc-300 bg-white hover:bg-zinc-50"
            onClick={copyPageUrl}
            title="Copy page link"
            type="button"
          >
            <Copy size={17} />
          </button>
          <Link
            aria-label="Open public page"
            className="grid h-10 w-10 place-items-center border border-zinc-300 bg-white hover:bg-zinc-50"
            target="_blank"
            title="Open public page"
            to={`/${profile.username}`}
          >
            <ExternalLink size={17} />
          </Link>
          <label className="flex h-10 cursor-pointer items-center gap-2 border border-zinc-300 bg-white px-3 text-sm font-medium">
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
        <div className="mt-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_390px]">
        <div>
          <div className="grid grid-cols-3 border border-zinc-300 bg-white p-1">
            {(["profile", "links", "appearance"] as EditorTab[]).map(
              (item) => (
                <button
                  className={`px-3 py-2 text-sm font-medium capitalize ${
                    tab === item ? "bg-ink text-white" : "hover:bg-zinc-100"
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
              <div className="flex items-center gap-4 border-b border-zinc-200 pb-6">
                {profile.photoURL ? (
                  <img
                    alt="Profile"
                    className="h-20 w-20 rounded-full object-cover"
                    src={profile.photoURL}
                  />
                ) : (
                  <div className="grid h-20 w-20 place-items-center rounded-full bg-ink text-xl font-semibold text-white">
                    {profile.displayName.charAt(0).toUpperCase() || "T"}
                  </div>
                )}
                <label className="inline-flex cursor-pointer items-center gap-2 border border-zinc-300 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50">
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
                className="w-fit bg-ink px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
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
                className="grid gap-3 border-b border-zinc-200 pb-6 sm:grid-cols-[1fr_1.4fr_auto]"
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
                  className="mt-auto grid h-10 w-10 place-items-center bg-ink text-white disabled:opacity-60"
                  disabled={status === "saving"}
                  title="Add link"
                  type="submit"
                >
                  <Plus size={18} />
                </button>
              </form>

              <div className="mt-5 grid gap-3">
                {links.length === 0 ? (
                  <div className="flex items-center gap-2 py-8 text-sm text-zinc-500">
                    <Link2 size={18} /> Add your first link above.
                  </div>
                ) : null}
                {links.map((link, index) => (
                  <article
                    className="border border-zinc-300 bg-white p-4"
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
                        className="bg-ink px-3 py-2 text-sm font-semibold text-white"
                        onClick={() => saveLink(link)}
                        type="button"
                      >
                        Save
                      </button>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-3">
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
                          className="grid h-9 w-9 place-items-center hover:bg-zinc-100 disabled:opacity-30"
                          disabled={index === 0}
                          onClick={() => moveLink(index, -1)}
                          title="Move up"
                          type="button"
                        >
                          <ArrowUp size={17} />
                        </button>
                        <button
                          aria-label="Move link down"
                          className="grid h-9 w-9 place-items-center hover:bg-zinc-100 disabled:opacity-30"
                          disabled={index === links.length - 1}
                          onClick={() => moveLink(index, 1)}
                          title="Move down"
                          type="button"
                        >
                          <ArrowDown size={17} />
                        </button>
                        <button
                          aria-label="Delete link"
                          className="grid h-9 w-9 place-items-center text-red-600 hover:bg-red-50"
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
              <div className="grid gap-4 sm:grid-cols-2">
                {(
                  [
                    ["backgroundColor", "Page"],
                    ["textColor", "Text"],
                    ["buttonColor", "Button"],
                    ["buttonTextColor", "Button text"],
                  ] as [keyof ProfileAppearance, string][]
                ).map(([key, label]) => (
                  <label
                    className="flex items-center justify-between border-b border-zinc-200 py-3 text-sm font-medium"
                    key={key}
                  >
                    {label}
                    <span className="flex items-center gap-2 font-mono text-xs text-zinc-500">
                      {profile.appearance[key]}
                      <input
                        aria-label={`${label} color`}
                        className="h-9 w-9 cursor-pointer border-0 bg-transparent p-0"
                        onChange={(event) =>
                          updateAppearance(key, event.target.value)
                        }
                        type="color"
                        value={profile.appearance[key]}
                      />
                    </span>
                  </label>
                ))}
              </div>

              <fieldset>
                <legend className="text-sm font-medium">Button style</legend>
                <div className="mt-2 grid grid-cols-2 border border-zinc-300 bg-white p-1">
                  {(["solid", "outline"] as ButtonStyle[]).map((style) => (
                    <button
                      className={`px-3 py-2 text-sm font-medium capitalize ${
                        profile.appearance.buttonStyle === style
                          ? "bg-ink text-white"
                          : "hover:bg-zinc-100"
                      }`}
                      key={style}
                      onClick={() => updateAppearance("buttonStyle", style)}
                      type="button"
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </fieldset>

              <button
                className="w-fit bg-ink px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                disabled={status === "saving"}
                onClick={() => saveProfile()}
                type="button"
              >
                Save appearance
              </button>
            </div>
          ) : null}
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <p className="mb-3 text-xs font-semibold uppercase text-zinc-500">
            Preview
          </p>
          <div className="mx-auto h-[640px] w-full max-w-[360px] overflow-y-auto border-[8px] border-ink bg-white shadow-sm">
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
        </aside>
      </div>
    </section>
  );
}
