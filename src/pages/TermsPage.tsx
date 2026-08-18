import { Link } from "react-router-dom";

/**
 * Placeholder until the reviewed documents land in Phase 11. It exists now so
 * the footer link on every public page resolves rather than falling through to
 * the `:username` route and reporting a missing creator.
 */
export function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="text-headline font-semibold text-content">Terms of Service</h1>
      <p className="mt-4 text-body text-content-muted">
        Our full terms, privacy policy, and acceptable use policy are being
        finalised ahead of public launch. Until they are published here, using
        Tributes is covered by the agreement you accept at checkout, and payments
        are processed by Stripe under their terms.
      </p>
      <p className="mt-4 text-body text-content-muted">
        Questions in the meantime go to{" "}
        <a className="font-medium text-accent hover:underline" href="mailto:support@tributes.bio">
          support@tributes.bio
        </a>
        .
      </p>
      <Link className="mt-8 inline-block text-body font-medium text-accent hover:underline" to="/">
        Back to Tributes
      </Link>
    </main>
  );
}
