import { firebaseConfig, firebaseProjectId } from "./lib/firebase";

const setupItems = [
  "React + TypeScript app shell",
  "Tailwind styling pipeline",
  "Firebase web SDK installed",
  "Dev project config loaded from environment",
];

function App() {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 py-12">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-tribute">
            Tributes
          </p>
          <h1 className="mt-4 text-4xl font-semibold sm:text-6xl">
            Firebase dev is wired in.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-zinc-700">
            This is the initial app shell for the creator tipping platform.
            The local development build is connected to{" "}
            <span className="font-semibold text-ink">{firebaseProjectId}</span>.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {setupItems.map((item) => (
            <div
              className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
              key={item}
            >
              <div className="h-2 w-10 rounded-full bg-coral" />
              <p className="mt-4 font-medium">{item}</p>
            </div>
          ))}
        </div>

        <dl className="mt-10 grid gap-3 rounded-lg border border-zinc-200 bg-white p-5 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-medium text-zinc-500">Firebase app ID</dt>
            <dd className="mt-1 break-all font-mono text-zinc-900">
              {firebaseConfig.appId}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-500">Analytics measurement</dt>
            <dd className="mt-1 break-all font-mono text-zinc-900">
              {firebaseConfig.measurementId ?? "Not configured"}
            </dd>
          </div>
        </dl>
      </section>
    </main>
  );
}

export default App;
