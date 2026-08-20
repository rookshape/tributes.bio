import type { ReactNode } from "react";
import { Link } from "react-router-dom";

/**
 * Shared shell for the published policies.
 *
 * They are read in two very different ways — by someone with a specific
 * question, and by a reviewer checking the whole document exists and says what
 * the product does — so headings are anchored and the effective date is stated
 * at the top rather than buried at the end.
 */
export function LegalDocument({
  children,
  effective,
  intro,
  title,
}: {
  children: ReactNode;
  effective: string;
  intro: string;
  title: string;
}) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="text-headline font-semibold text-content">{title}</h1>
      <p className="mt-2 text-detail text-content-subtle">
        Effective {effective} · Tributes is a product of lurk LLC
      </p>
      <p className="mt-6 text-body text-content-muted">{intro}</p>

      <div className="mt-10 grid gap-8">{children}</div>

      <nav
        aria-label="Policies"
        className="mt-14 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-6 text-detail"
      >
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
          support@tributes.bio
        </a>
        <Link className="text-content-muted hover:text-content" to="/">
          Back to Tributes
        </Link>
      </nav>
    </main>
  );
}

export function LegalSection({
  children,
  id,
  title,
}: {
  children: ReactNode;
  id: string;
  title: string;
}) {
  return (
    <section id={id}>
      <h2 className="text-title font-semibold text-content">{title}</h2>
      <div className="mt-2 grid gap-3 text-body leading-7 text-content-muted">
        {children}
      </div>
    </section>
  );
}
