import { LoaderCircle } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { SpinWheel } from "../components/SpinWheel";
import { getCreatorByUsername } from "../lib/account";
import { createMockSpinEntry, getSpinConfig } from "../lib/spin";
import type { CreatorProfile, SpinConfig } from "../lib/types";

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function PublicSpinPage() {
  const { username = "" } = useParams();
  const [creator, setCreator] = useState<CreatorProfile | null>(null);
  const [config, setConfig] = useState<SpinConfig | null>(null);
  const [viewerName, setViewerName] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [queued, setQueued] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    getCreatorByUsername(username)
      .then(async (profile) => {
        if (!profile?.isPublished || profile.moderationStatus !== "active") {
          return null;
        }

        const spinConfig = await getSpinConfig(profile.id);
        return { profile, spinConfig };
      })
      .then((result) => {
        if (!active) return;
        setCreator(result?.profile ?? null);
        setConfig(result?.spinConfig ?? null);
      })
      .catch(() => {
        if (active) setCreator(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [username]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    if (!creator) return;
    setSubmitting(true);
    setError(null);
    setQueued(false);

    try {
      await createMockSpinEntry(creator.id, viewerName);
      setQueued(true);
      setViewerName("");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not join the queue.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <main className="grid min-h-screen place-items-center bg-zinc-950 text-white"><LoaderCircle className="animate-spin" /></main>;
  }

  if (!creator || !config?.isEnabled) {
    return (
      <main className="grid min-h-screen place-items-center bg-zinc-950 px-5 text-center text-white">
        <div>
          <h1 className="text-2xl font-semibold">Spins are unavailable</h1>
          <Link className="mt-5 inline-block text-sm font-semibold text-emerald-400" to={`/${username}`}>Back to profile</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-5 py-10 text-white">
      <div className="mx-auto grid w-full max-w-5xl items-center gap-10 md:grid-cols-[minmax(300px,1fr)_minmax(280px,0.8fr)]">
        <section className="mx-auto w-full max-w-[560px]">
          <SpinWheel slices={config.slices} />
        </section>

        <section className="border-t border-white/20 pt-8 md:border-l md:border-t-0 md:pl-8 md:pt-0">
          <p className="text-sm font-semibold text-white/55">@{creator.username}</p>
          <h1 className="mt-2 text-3xl font-semibold">{config.title}</h1>
          <p className="mt-6 text-4xl font-semibold">{formatMoney(config.spinPriceCents)}</p>

          <form className="mt-8 grid gap-4" onSubmit={submit}>
            <label className="grid gap-2 text-sm font-medium">
              Name
              <input className="h-12 border border-white/30 bg-transparent px-3 outline-none focus:border-white" maxLength={40} onChange={(event) => setViewerName(event.target.value)} placeholder="Optional" value={viewerName} />
            </label>
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            {queued ? <p className="text-sm text-emerald-400">Added to the test queue.</p> : null}
            <button className="h-12 bg-white px-4 font-semibold text-zinc-950 disabled:opacity-50" disabled={submitting} type="submit">
              {submitting ? "Adding" : "Join test queue"}
            </button>
          </form>

          <Link className="mt-6 inline-block text-sm font-semibold text-white/60" to={`/${creator.username}`}>Back to profile</Link>
        </section>
      </div>
    </main>
  );
}
