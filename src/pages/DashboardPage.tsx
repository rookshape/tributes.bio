import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function DashboardPage() {
  const { appUser } = useAuth();
  const isCreator = appUser?.accountType === "creator";

  return (
    <section className="mx-auto w-full max-w-5xl px-5 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <p className="text-sm font-semibold uppercase text-tribute">
            Dashboard
          </p>
          <h1 className="mt-2 text-3xl font-semibold">
            {appUser?.displayName ?? appUser?.email ?? "Account"}
          </h1>
        </div>
        {isCreator && appUser?.username ? (
          <Link className="font-semibold text-tribute" to={`/${appUser.username}`}>
            View public page
          </Link>
        ) : null}
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <section className="border border-zinc-200 bg-white p-5">
          <h2 className="font-semibold">Account</h2>
          <p className="mt-2 text-sm text-zinc-600">
            Type: {appUser?.accountType}
          </p>
        </section>

        {isCreator ? (
          <>
            <section className="border border-zinc-200 bg-white p-5">
              <h2 className="font-semibold">Username</h2>
              <p className="mt-2 text-sm text-zinc-600">
                tributes.bio/{appUser?.username}
              </p>
            </section>
            <section className="border border-zinc-200 bg-white p-5">
              <h2 className="font-semibold">Next</h2>
              <p className="mt-2 text-sm text-zinc-600">
                Spin configuration starts in Phase 2.
              </p>
            </section>
          </>
        ) : (
          <section className="border border-zinc-200 bg-white p-5 md:col-span-2">
            <h2 className="font-semibold">Personal profile</h2>
            <p className="mt-2 text-sm text-zinc-600">
              Spend tracking will be added after creator payments are live.
            </p>
          </section>
        )}
      </div>
    </section>
  );
}
