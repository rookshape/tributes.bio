import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ButtonLink } from "../components/ui";
import { BioShowcase, StreamShowcase } from "../components/landing/ProductShowcase";
import { SPIN_FEE_RATE, TIP_FEE_RATE, feePercentLabel } from "../lib/money";

export function LandingPage() {
  const { appUser, user } = useAuth();

  return (
    <main
      // One background for the page rather than one per section. Each band was
      // setting its own — a white hero, a grey costs strip, a plain canvas
      // between them — so the page read as a stack of separate pages with
      // seams where they met. This runs off the app's grey-white at the very
      // top, settles into white, and stays there until the sky takes over.
      style={{
        backgroundImage:
          "linear-gradient(180deg, rgb(var(--canvas)) 0px, #ffffff 340px)",
        backgroundRepeat: "no-repeat",
      }}
    >
      <section className="relative isolate overflow-hidden pb-16 pt-24 text-center sm:pb-20 sm:pt-28">
        <div className="relative left-1/2 w-max -translate-x-1/2 pb-3">
          <h1
            className="whitespace-nowrap text-[35.5vw] leading-[1.05]"
            style={{
              background: "linear-gradient(180deg, #82aefc 12%, #82aefc 48%, #ffffff 96%)",
              backgroundClip: "text",
              color: "transparent",
              fontFamily: '"Fira Sans Extra Condensed", sans-serif',
              fontStyle: "italic",
              fontWeight: 800,
              WebkitBackgroundClip: "text",
            }}
          >
            Tributes
          </h1>
        </div>
        <div className="relative mx-auto mt-10 w-full max-w-3xl px-4 sm:mt-14 sm:px-6">
          <p className="mx-auto max-w-xl text-lead text-content-muted sm:text-xl">
            Get paid in your bio and on your stream.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            {user ? (
              <ButtonLink
                className="rounded-full px-8 shadow-[0_10px_30px_rgba(15,23,32,0.12)]"
                size="lg"
                to={appUser?.onboardingComplete ? "/dashboard" : "/onboarding"}
                variant="primary"
              >
                {appUser?.onboardingComplete ? "Open dashboard" : "Continue setup"}
              </ButtonLink>
            ) : (
              <>
                <ButtonLink
                  className="rounded-full px-8 shadow-[0_10px_30px_rgba(15,23,32,0.12)]"
                  size="lg"
                  to="/signup"
                  variant="primary"
                >
                  Create your page
                </ButtonLink>
                <Link
                  className="inline-flex min-h-12 items-center rounded-control px-4 text-lead font-medium text-content-muted hover:text-content"
                  to="/login"
                >
                  Log in
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 sm:px-6">
        <div className="grid items-center gap-8 py-12 sm:py-16 lg:grid-cols-2 lg:gap-14">
          <div className="min-w-0 lg:order-1">
            <h2 className="text-headline font-semibold text-content">In your bio</h2>
            <p className="mt-3 max-w-md text-lead text-content-muted">
              One page for your links and your tributes. Share one address,
              and let people support you where they already find you.
            </p>
          </div>
          <div className="min-w-0 lg:order-2">
            <BioShowcase />
          </div>
        </div>

        {/* Full width rather than half of a two-column row: these are four
            separate OBS sources a streamer arranges across a scene, and in a
            narrow column they stack into a tower that looks nothing like how
            they are used. */}
        <div className="py-12 sm:py-16">
          <div className="max-w-xl">
            <h2 className="text-headline font-semibold text-content">On your stream</h2>
            <p className="mt-3 text-lead text-content-muted">
              Turn sending into a live game. A viewer pays to spin your wheel,
              you spin it on stream, and they send whatever it lands on. The most
              they can pay is agreed before they start.
            </p>
          </div>
          <div className="mt-10">
            <StreamShowcase />
          </div>
        </div>
      </section>

      {/*
        The close: what it costs, the call to action, and the footer, all on one
        sky. They were three stacked bands saying overlapping things — a fee
        explanation, a "set your page up" nudge, and the legal line — and the
        honest version of all three is that it is free, so they are one.

        The image runs to the bottom of the document rather than stopping above
        the footer, so the page ends in the sky instead of on a seam.
      */}
      <section
        className="relative isolate mt-4 overflow-hidden"
        style={{
          // Sat at the bottom at its own aspect rather than cropped to cover,
          // so the clouds keep their shape at any width. The sky's own top is
          // near-white, so it meets the page's white without a line — which is
          // why there is no colour behind it filling the gap.
          backgroundImage: "url('/landing-sky.jpg')",
          backgroundSize: "100% auto",
          backgroundPosition: "bottom center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="mx-auto w-full max-w-3xl px-4 pb-10 pt-20 text-center sm:px-6 sm:pt-24">
          <h2 className="text-hero font-semibold text-content">Totally Free</h2>
          <p className="mx-auto mt-4 max-w-xl text-lead text-content-muted">
            Free to set up and free to keep. You get the full amount someone
            sends you. The sender covers the service fee: {feePercentLabel(TIP_FEE_RATE)} on
            a tribute, {feePercentLabel(SPIN_FEE_RATE)} on a spin, shown before
            they pay.
          </p>
          <div className="mt-9 flex justify-center">
            {/* The primary variant is already a white face with an accent
                label, so this is that button rather than a hand-rolled copy
                of it that would drift the next time the accent moves. */}
            <ButtonLink
              className="rounded-full px-8 shadow-[0_10px_30px_rgba(15,23,32,0.12)]"
              size="lg"
              to={user ? "/dashboard" : "/signup"}
              variant="primary"
            >
              {user ? "Open dashboard" : "Get Started"}
            </ButtonLink>
          </div>
        </div>

        {/* Inside the sky, not below it. */}
        <footer className="relative mx-auto w-full max-w-5xl px-4 pb-8 pt-24 sm:px-6 sm:pt-32">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Names the operating company as well as the product. Tributes is
                the trading name; lurk LLC is who the contract and the payouts
                are actually with, and a card statement or a processor review
                should be able to connect the two without asking. */}
            <p className="text-detail text-white/85">
              Tributes is a product of lurk LLC. © {new Date().getFullYear()} lurk
              LLC. All rights reserved.
            </p>
            <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-detail">
              <Link className="text-white/85 hover:text-white" to="/terms">
                Terms
              </Link>
              <Link className="text-white/85 hover:text-white" to="/privacy">
                Privacy
              </Link>
              <Link className="text-white/85 hover:text-white" to="/refunds">
                Refunds
              </Link>
              <a
                className="text-white/85 hover:text-white"
                href="mailto:support@tributes.bio"
              >
                Support
              </a>
            </nav>
          </div>
        </footer>
      </section>
    </main>
  );
}
