import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ButtonLink } from "../components/ui";
import { SPIN_FEE_RATE, TIP_FEE_RATE, feePercentLabel } from "../lib/money";

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
              One page for your links and your tributes. Share a single address,
              and let people support you from the same place they find you.
            </p>
          </div>
          <div className="min-w-0 lg:order-2">
            {/* The real page, captured from the product rather than mocked up,
                which is also what a payment processor reviewing this site is
                trying to establish. */}
            <img
              alt="A creator page with links and a form for sending a tribute"
              className="mx-auto w-full max-w-[300px] rounded-panel shadow-[0_18px_44px_rgba(15,23,32,0.18)]"
              height={1456}
              src="/shot-bio.png"
              width={700}
            />
          </div>
        </div>

        <div className="grid items-center gap-8 py-12 sm:py-16 lg:grid-cols-2 lg:gap-14">
          <div className="min-w-0 lg:order-2">
            <h2 className="text-headline font-semibold text-content">On your stream</h2>
            <p className="mt-3 max-w-md text-lead text-content-muted">
              Turn sending into a live game. A viewer pays to spin your wheel,
              you spin it on stream, and they send whatever it lands on — with
              the most they could pay agreed before they start.
            </p>
          </div>
          <div className="min-w-0 lg:order-1">
            {/* Transparent, and shown on a dark panel, because that is how it
                arrives in OBS — over a scene, not inside a box. */}
            <div className="rounded-panel bg-[#1b2027] p-5 sm:p-7">
              <img
                alt="A spin wheel, a running total, and a goal bar over a stream"
                className="w-full"
                height={964}
                src="/shot-stream.png"
                width={1400}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Stated plainly on the public page rather than only at checkout: the
          fee is payer-side, so a creator deciding whether to sign up needs to
          know what their audience will be asked for. */}
      <section className="border-t border-line bg-surface-sunken">
        <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6 sm:py-16">
          <h2 className="text-headline font-semibold text-content">What it costs</h2>
          <p className="mt-3 max-w-2xl text-lead text-content-muted">
            Free to set up, and free to keep. You receive the full amount someone
            sends you. Tributes charges the sender a service fee on top —{" "}
            {feePercentLabel(TIP_FEE_RATE)} on a tribute,{" "}
            {feePercentLabel(SPIN_FEE_RATE)} on a spin — and it is shown to them
            before they pay. Card processing and payouts are handled by Stripe.
          </p>
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
          {/* Names the operating company as well as the product. Tributes is
              the trading name; lurk LLC is who the contract and the payouts are
              actually with, and a card statement or a processor review should
              be able to connect the two without asking. */}
          <p className="text-detail text-content-muted">
            Tributes is a product of lurk LLC. © {new Date().getFullYear()} lurk
            LLC. All rights reserved.
          </p>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-detail">
            <Link className="text-content-muted hover:text-content" to="/terms">
              Terms
            </Link>
            <Link className="text-content-muted hover:text-content" to="/privacy">
              Privacy
            </Link>
            <Link className="text-content-muted hover:text-content" to="/refunds">
              Refunds
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
