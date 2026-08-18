import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ButtonLink } from "../components/ui";

/** Stands in for a product shot until the real previews are finalised. */
function PreviewPlaceholder() {
  return (
    <div
      aria-hidden="true"
      className="aspect-[16/10] w-full rounded-panel border border-line bg-surface-sunken"
    />
  );
}

export function LandingPage() {
  const { appUser, user } = useAuth();

  return (
    <main>
      <section className="relative isolate">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 -z-10 h-full"
          style={{ background: "linear-gradient(180deg, #0091ff 0%, #1f9dff 100%)" }}
        />
        <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-24 text-center sm:px-6 sm:pb-20 sm:pt-28">
          <h1 className="text-display font-semibold text-white sm:text-hero">Tributes</h1>
          <p className="mx-auto mt-4 max-w-xl text-lead text-white/85 sm:text-xl">
            Get paid in your bio, and on your stream.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {user ? (
              <ButtonLink
                size="lg"
                to={appUser?.onboardingComplete ? "/dashboard" : "/onboarding"}
                variant="primary"
              >
                {appUser?.onboardingComplete ? "Open dashboard" : "Continue setup"}
              </ButtonLink>
            ) : (
              <>
                <ButtonLink size="lg" to="/signup" variant="primary">
                  Create your page
                </ButtonLink>
                <Link
                  className="inline-flex min-h-12 items-center rounded-control px-4 text-lead font-medium text-white/85 hover:text-white"
                  to="/login"
                >
                  Log in
                </Link>
              </>
            )}
          </div>
        </div>
        <div
          aria-hidden="true"
          className="h-20 sm:h-28"
          style={{ background: "linear-gradient(180deg, #1f9dff 0%, rgb(var(--canvas)) 100%)" }}
        />
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 sm:px-6">
        <div className="grid items-center gap-8 py-12 sm:py-16 lg:grid-cols-2 lg:gap-14">
          <div className="min-w-0 lg:order-1">
            <h2 className="text-headline font-semibold text-content">In your bio</h2>
            <p className="mt-3 max-w-md text-lead text-content-muted">
              One page for your links, and your tributes.
            </p>
          </div>
          <div className="min-w-0 lg:order-2">
            <PreviewPlaceholder />
          </div>
        </div>

        <div className="grid items-center gap-8 py-12 sm:py-16 lg:grid-cols-2 lg:gap-14">
          <div className="min-w-0 lg:order-2">
            <h2 className="text-headline font-semibold text-content">On your stream</h2>
            <p className="mt-3 max-w-md text-lead text-content-muted">
              Turn sending into a fun live game with your viewers. Viewers pay to spin the
              wheel, then they send whatever it lands on.
            </p>
          </div>
          <div className="min-w-0 lg:order-1">
            <PreviewPlaceholder />
          </div>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-start gap-6 px-4 py-14 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-16">
          <div>
            <h2 className="text-title font-semibold text-content">
              Set your page up in a few minutes.
            </h2>
            <p className="mt-1.5 text-body text-content-muted">
              Payments and payouts are handled by Stripe.
            </p>
          </div>
          <ButtonLink size="lg" to={user ? "/dashboard" : "/signup"} variant="accent">
            {user ? "Open dashboard" : "Create your page"}
          </ButtonLink>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-detail text-content-muted">
            © {new Date().getFullYear()} lurk LLC. All rights reserved.
          </p>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-detail">
            <Link className="text-content-muted hover:text-content" to="/signup">
              Create account
            </Link>
            <Link className="text-content-muted hover:text-content" to="/login">
              Log in
            </Link>
            <a
              className="text-content-muted hover:text-content"
              href="mailto:support@tributes.bio"
            >
              Support
            </a>
          </nav>
        </div>
      </footer>
    </main>
  );
}
