import { Check, Link2, Plus, UserRound, WandSparkles } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { BioPageView } from "../components/BioPageView";
import { Button, Input, Progress, StatusMessage } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import {
  completeCreatorOnboarding,
  completePersonalOnboarding,
  isUsernameAvailable,
  normalizeUsername,
  reserveCreatorUsername,
  suggestUsername,
  validateUsername,
} from "../lib/account";
import { createCreatorLink, updateCreatorProfile } from "../lib/bio";
import { DEFAULT_APPEARANCE } from "../lib/pageThemes";
import type { AccountType, CreatorLink, CreatorProfile } from "../lib/types";

type Step = "type" | "profile" | "links";
type Availability = "idle" | "checking" | "free" | "taken" | "invalid";

const CREATOR_STEPS: Step[] = ["type", "profile", "links"];

export function OnboardingPage() {
  const { appUser, loading, refreshAppUser, user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("type");
  const [accountType, setAccountType] = useState<AccountType>("creator");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [availability, setAvailability] = useState<Availability>("idle");
  const [links, setLinks] = useState<CreatorLink[]>([]);
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const usernameFormatError = useMemo(
    () => validateUsername(username),
    [username],
  );

  useEffect(() => {
    if (!user) return;
    setUsername((current) => current || suggestUsername(user));
    setDisplayName((current) => current || user.displayName || "");
  }, [user]);

  // Debounced so a lookup does not fire on every keystroke.
  const checkToken = useRef(0);
  useEffect(() => {
    if (step !== "profile") return;

    if (usernameFormatError) {
      setAvailability("invalid");
      return;
    }

    setAvailability("checking");
    const token = ++checkToken.current;
    const timer = window.setTimeout(() => {
      isUsernameAvailable(username)
        .then((free) => {
          if (token === checkToken.current) setAvailability(free ? "free" : "taken");
        })
        .catch(() => {
          if (token === checkToken.current) setAvailability("idle");
        });
    }, 400);

    return () => window.clearTimeout(timer);
  }, [step, username, usernameFormatError]);

  if (!loading && !user) return <Navigate replace to="/login" />;
  if (!loading && appUser?.onboardingComplete) return <Navigate replace to="/dashboard" />;

  const previewProfile: CreatorProfile = {
    id: user?.uid ?? "preview",
    ownerUid: user?.uid ?? "preview",
    username: normalizeUsername(username) || "yourname",
    displayName: displayName.trim() || normalizeUsername(username) || "Your name",
    bio: "",
    tipsEnabled: true,
    photoPath: null,
    photoURL: user?.photoURL ?? null,
    appearance: DEFAULT_APPEARANCE,
    isPublished: true,
    moderationStatus: "active",
  };

  const run = async (action: () => Promise<void>) => {
    setError(null);
    setSubmitting(true);
    try {
      await action();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Something went wrong.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const chooseType = () => {
    if (!user) return;

    if (accountType === "personal") {
      return void run(async () => {
        await completePersonalOnboarding(user);
        await refreshAppUser();
        navigate("/dashboard", { replace: true });
      });
    }

    setStep("profile");
  };

  const claimUsername = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;

    if (usernameFormatError) {
      setError(usernameFormatError);
      return;
    }

    void run(async () => {
      await reserveCreatorUsername(user, username);
      const trimmed = displayName.trim();

      if (trimmed) {
        await updateCreatorProfile(user.uid, {
          displayName: trimmed,
          bio: "",
          photoPath: null,
          photoURL: user.photoURL,
          appearance: DEFAULT_APPEARANCE,
          isPublished: true,
          tipsEnabled: true,
        });
      }

      setStep("links");
    });
  };

  const addLink = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;

    void run(async () => {
      const link = await createCreatorLink(user.uid, linkTitle, linkUrl, links.length);
      setLinks((current) => [...current, link]);
      setLinkTitle("");
      setLinkUrl("");
    });
  };

  const finish = () => {
    if (!user) return;
    void run(async () => {
      await completeCreatorOnboarding(user);
      await refreshAppUser();
      navigate("/dashboard", { replace: true });
    });
  };

  const stepIndex = CREATOR_STEPS.indexOf(step);

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="mx-auto w-full max-w-lg lg:mx-0">
          {accountType === "creator" && step !== "type" ? (
            <Progress
              className="mb-8"
              label="Setup progress"
              max={CREATOR_STEPS.length}
              showValue
              value={stepIndex + 1}
            />
          ) : null}

          {step === "type" ? (
            <>
              <h1 className="text-headline font-semibold text-content">
                How will you use Tributes?
              </h1>
              <p className="mt-1.5 text-body text-content-muted">
                You can change this later in settings.
              </p>

              <fieldset className="mt-7 grid gap-3">
                <legend className="sr-only">Account type</legend>
                {(["creator", "personal"] as AccountType[]).map((type) => {
                  const selected = accountType === type;
                  return (
                    <label
                      className={`relative flex cursor-pointer items-center gap-3.5 rounded-card border p-4 transition-colors duration-fast ${
                        selected
                          ? "border-accent bg-accent/5"
                          : "border-line hover:border-line-strong"
                      }`}
                      key={type}
                    >
                      <input
                        checked={selected}
                        className="sr-only"
                        name="accountType"
                        onChange={() => setAccountType(type)}
                        type="radio"
                      />
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-raised text-accent">
                        {type === "creator" ? <WandSparkles size={19} /> : <UserRound size={19} />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-body font-semibold capitalize text-content">
                          {type}
                        </span>
                        <span className="mt-0.5 block text-detail text-content-muted">
                          {type === "creator"
                            ? "Publish a page, take tips, and run live spins."
                            : "Follow creators and keep track of what you send."}
                        </span>
                      </span>
                      {selected ? <Check className="ml-auto shrink-0 text-accent" size={18} /> : null}
                    </label>
                  );
                })}
              </fieldset>

              <StatusMessage className="mt-5" tone="error">{error}</StatusMessage>
              <Button block className="mt-6" loading={submitting} onClick={chooseType} variant="accent">
                Continue
              </Button>
            </>
          ) : null}

          {step === "profile" ? (
            <form onSubmit={claimUsername}>
              <h1 className="text-headline font-semibold text-content">Claim your page</h1>
              <p className="mt-1.5 text-body text-content-muted">
                This is the address you will share with your viewers.
              </p>

              <div className="mt-7 grid gap-4">
                <Input
                  error={
                    availability === "taken"
                      ? "That username is already taken."
                      : availability === "invalid"
                        ? usernameFormatError
                        : undefined
                  }
                  hint={
                    availability === "free"
                      ? `tributes.bio/${normalizeUsername(username)} is available.`
                      : availability === "checking"
                        ? "Checking availability…"
                        : `tributes.bio/${normalizeUsername(username) || "yourname"}`
                  }
                  label="Username"
                  onChange={(event) => setUsername(normalizeUsername(event.target.value))}
                  prefix="@"
                  required
                  value={username}
                />
                <Input
                  hint="Shown at the top of your page."
                  label="Display name"
                  maxLength={80}
                  onChange={(event) => setDisplayName(event.target.value)}
                  value={displayName}
                />
              </div>

              <StatusMessage className="mt-5" tone="error">{error}</StatusMessage>
              <Button
                block
                className="mt-6"
                disabled={availability === "taken" || availability === "invalid"}
                loading={submitting}
                type="submit"
                variant="accent"
              >
                Claim @{normalizeUsername(username) || "yourname"}
              </Button>
            </form>
          ) : null}

          {step === "links" ? (
            <>
              <h1 className="text-headline font-semibold text-content">Add a link or two</h1>
              <p className="mt-1.5 text-body text-content-muted">
                Optional — you can add these any time from your dashboard.
              </p>

              <form className="mt-7 grid gap-3 sm:grid-cols-[1fr_1.3fr_auto]" onSubmit={addLink}>
                <Input
                  label="Title"
                  maxLength={80}
                  onChange={(event) => setLinkTitle(event.target.value)}
                  placeholder="YouTube"
                  required
                  value={linkTitle}
                />
                <Input
                  label="URL"
                  onChange={(event) => setLinkUrl(event.target.value)}
                  placeholder="youtube.com/@you"
                  required
                  value={linkUrl}
                />
                <Button
                  aria-label="Add link"
                  className="sm:mt-[26px]"
                  loading={submitting}
                  type="submit"
                  variant="secondary"
                >
                  <Plus size={17} />
                </Button>
              </form>

              {links.length ? (
                <ul className="mt-5 grid gap-2">
                  {links.map((link) => (
                    <li
                      className="flex items-center gap-3 rounded-control border border-line px-3.5 py-2.5"
                      key={link.id}
                    >
                      <Link2 className="shrink-0 text-content-subtle" size={16} />
                      <span className="min-w-0 flex-1 truncate text-body font-medium text-content">
                        {link.title}
                      </span>
                      <span className="hidden truncate text-caption text-content-subtle sm:block">
                        {link.url}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}

              <StatusMessage className="mt-5" tone="error">{error}</StatusMessage>

              <div className="mt-7 flex flex-wrap gap-3">
                <Button loading={submitting} onClick={finish} variant="accent">
                  {links.length ? "Finish and open dashboard" : "Skip for now"}
                </Button>
              </div>
            </>
          ) : null}
        </div>

        {/* Live preview from the first keystroke, so the page is never abstract. */}
        {accountType === "creator" && step !== "type" ? (
          <aside className="mx-auto w-full max-w-[320px] lg:sticky lg:top-24 lg:self-start">
            <p className="mb-3 text-center text-detail font-medium text-content-muted lg:text-left">
              Preview
            </p>
            <div className="preview-window h-[520px] w-full">
              <div className="preview-screen">
                <BioPageView links={links} preview profile={previewProfile} />
              </div>
            </div>
          </aside>
        ) : null}
      </div>
    </section>
  );
}
