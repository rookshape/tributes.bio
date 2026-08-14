import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getCreatorByUsername } from "../lib/account";
import type { CreatorProfile } from "../lib/types";

export function PublicProfilePage() {
  const { username = "" } = useParams();
  const [creator, setCreator] = useState<CreatorProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    setLoading(true);
    getCreatorByUsername(username)
      .then((profile) => {
        if (active) {
          setCreator(profile);
        }
      })
      .catch(() => {
        if (active) {
          setCreator(null);
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
  }, [username]);

  if (loading) {
    return <section className="mx-auto max-w-xl px-5 py-14">Loading</section>;
  }

  if (!creator) {
    return (
      <section className="mx-auto max-w-xl px-5 py-14">
        <h1 className="text-3xl font-semibold">Profile not found</h1>
        <Link className="mt-6 inline-block font-semibold text-tribute" to="/">
          Go home
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-xl px-5 py-14 text-center">
      <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-ink text-2xl font-semibold text-white">
        {creator.displayName.charAt(0).toUpperCase()}
      </div>
      <h1 className="mt-5 text-3xl font-semibold">{creator.displayName}</h1>
      <p className="mt-1 text-zinc-500">@{creator.username}</p>
      {creator.bio ? <p className="mt-5 text-zinc-700">{creator.bio}</p> : null}

      <div className="mt-8 grid gap-3">
        <button className="border border-zinc-300 bg-white px-4 py-3 font-semibold" type="button">
          Tip
        </button>
        <button className="bg-ink px-4 py-3 font-semibold text-white" type="button">
          Spin
        </button>
      </div>
    </section>
  );
}
