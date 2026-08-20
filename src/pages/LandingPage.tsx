import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ButtonLink } from "../components/ui";
import { BioShowcase, StreamShowcase } from "../components/landing/ProductShowcase";
import { SPIN_FEE_RATE, TIP_FEE_RATE, feePercentLabel } from "../lib/money";

function useLandingMotion() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) {
      return;
    }

    const revealElements = Array.from(
      root.querySelectorAll<HTMLElement>("[data-landing-reveal]"),
    );
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reducedMotion) {
      revealElements.forEach((element) => element.classList.add("landing-reveal-visible"));
      return;
    }

    let frame = 0;
    let observer: IntersectionObserver | null = null;
    const revealEnteredElements = () => {
      revealElements.forEach((element) => {
        if (
          !element.classList.contains("landing-reveal-visible") &&
          element.getBoundingClientRect().top < window.innerHeight * 0.92
        ) {
          element.classList.add("landing-reveal-visible");
          observer?.unobserve(element);
        }
      });
    };
    const updateHero = () => {
      frame = 0;
      const progress = Math.min(1, Math.max(0, window.scrollY / window.innerHeight));
      root.style.setProperty("--landing-hero-scroll", progress.toFixed(3));
      revealEnteredElements();
    };
    const scheduleHeroUpdate = () => {
      if (!frame) {
        frame = window.requestAnimationFrame(updateHero);
      }
    };

    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const hasEnteredViewport =
            entry.isIntersecting || entry.boundingClientRect.top < window.innerHeight * 0.92;
          if (hasEnteredViewport) {
            entry.target.classList.add("landing-reveal-visible");
            observer?.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8%", threshold: 0.14 },
    );

    revealElements.forEach((element) => {
      element.classList.add("landing-reveal-ready");
      observer?.observe(element);
    });
    updateHero();
    window.addEventListener("scroll", scheduleHeroUpdate, { passive: true });
    window.addEventListener("resize", scheduleHeroUpdate);

    return () => {
      observer?.disconnect();
      window.removeEventListener("scroll", scheduleHeroUpdate);
      window.removeEventListener("resize", scheduleHeroUpdate);
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, []);

  return ref;
}

export function LandingPage() {
  const { appUser, user } = useAuth();
  const landingRef = useLandingMotion();

  return (
    <main
      className="landing-page"
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
      ref={landingRef}
    >
      <section className="relative isolate overflow-hidden pb-16 pt-24 text-center sm:pb-20 sm:pt-28">
        <div className="landing-hero-wordmark-shell relative left-1/2 w-max -translate-x-1/2 pb-3">
          <div className="landing-hero-wordmark-drift relative">
            <h1
              className="landing-hero-wordmark whitespace-nowrap text-[33.5vw] leading-[1.05]"
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
            <div aria-hidden="true" className="landing-hero-shine" />
          </div>
        </div>
        <div className="landing-hero-copy relative mx-auto mt-5 w-full max-w-3xl px-4 sm:mt-8 sm:px-6">
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
              <ButtonLink
                className="rounded-full px-8 shadow-[0_10px_30px_rgba(15,23,32,0.12)]"
                size="lg"
                to="/signup"
                variant="primary"
              >
                Create your page
              </ButtonLink>
            )}
          </div>
        </div>
      </section>

      <div className="relative overflow-hidden">
        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:py-32">
          <div className="grid min-w-0 gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:gap-16">
            <div
              className="relative z-10 self-start text-center lg:sticky lg:top-32 lg:pt-36 lg:text-left"
              data-landing-reveal="left"
            >
              <h2 className="display-type text-display tracking-normal text-content sm:text-hero">
                In your bio
              </h2>
              <p className="mx-auto mt-5 max-w-md text-lead text-content-muted lg:mx-0">
                One page for your links and your tributes. Share one address,
                and let people support you where they already find you.
              </p>
            </div>

            <div className="min-w-0" data-landing-delay="1" data-landing-reveal="scale">
              <BioShowcase />
            </div>
          </div>
        </section>

        {/* The overlay sources remain independent, as they are in OBS. The
            surrounding wash gives them a shared scene without pretending the
            product renders them inside one framed widget. */}
        <section className="relative left-1/2 w-screen -translate-x-1/2 bg-[linear-gradient(180deg,#ffffff_0%,#f4f8ff_18%,#edf5ff_76%,#ffffff_100%)] pb-6 pt-14 sm:pb-8 sm:pt-16 lg:pb-8 lg:pt-20">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <div className="grid gap-5 pb-6 text-center sm:pb-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-end lg:gap-16 lg:text-left">
              <div data-landing-reveal="left">
                <h2 className="display-type text-display tracking-normal text-content sm:text-hero">
                  On your stream
                </h2>
              </div>
              <p
                className="mx-auto max-w-xl text-lead text-content-muted lg:mx-0"
                data-landing-delay="1"
                data-landing-reveal="right"
              >
                Turn sending into a live game. A viewer pays to spin your wheel,
                you spin it on stream, and they send whatever it lands on. The most
                they can pay is agreed before they start.
              </p>
            </div>

            <div className="mt-6 sm:mt-8" data-landing-delay="1" data-landing-reveal="up">
              <StreamShowcase />
            </div>
          </div>
        </section>
      </div>

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
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[#2d6fe0]/35"
        />
        <div
          className="mx-auto w-full max-w-3xl px-4 pb-10 pt-20 text-center sm:px-6 sm:pt-24"
          data-landing-reveal="up"
        >
          <h2 className="display-type text-hero text-content">Totally Free</h2>
          <p className="mx-auto mt-4 max-w-xl text-lead text-content-muted">
            Free to set up. Free to keep. You get the full amount someone sends
            you, and the sender covers a small fee shown before they pay.{" "}
            {feePercentLabel(TIP_FEE_RATE)} on a tribute,{" "}
            {feePercentLabel(SPIN_FEE_RATE)} on a spin.
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
        <footer
          className="relative mx-auto w-full max-w-5xl px-4 pb-10 pt-24 sm:px-6 sm:pb-8 sm:pt-32"
          data-landing-delay="1"
          data-landing-reveal="up"
        >
          {/* Narrow: centred, links above the legal line, because the links are
              the part anyone is actually reaching for. Wide: the row it was,
              legal to the left and links to the right. */}
          <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:text-left">
            {/* Names the operating company as well as the product. Tributes is
                the trading name; lurk LLC is who the contract and the payouts
                are actually with, and a card statement or a processor review
                should be able to connect the two without asking.

                Balanced rather than ragged: left to itself this wraps with
                "reserved." alone on the second line. */}
            <p className="order-2 text-balance text-detail font-semibold text-white sm:order-1">
              Tributes is a product of lurk LLC.{" "}
              {/* Kept whole: balancing the line otherwise breaks between the
                  symbol and the year. */}
              <span className="whitespace-nowrap">
                © {new Date().getFullYear()} lurk LLC.
              </span>{" "}
              All rights reserved.
            </p>
            <nav
              aria-label="Footer"
              className="order-1 flex flex-wrap justify-center gap-x-6 gap-y-2 text-detail font-semibold sm:order-2 sm:justify-end"
            >
              <Link className="text-white hover:text-white/75" to="/terms">
                Terms
              </Link>
              <Link className="text-white hover:text-white/75" to="/privacy">
                Privacy
              </Link>
              <Link className="text-white hover:text-white/75" to="/refunds">
                Refunds
              </Link>
              <a
                className="text-white hover:text-white/75"
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
