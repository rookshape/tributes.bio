import { LegalDocument, LegalSection } from "../components/LegalDocument";

export function PrivacyPage() {
  return (
    <LegalDocument
      effective="20 August 2026"
      intro="What Tributes collects, why, who it is shared with, and how to have it deleted. Tributes is operated by lurk LLC."
      title="Privacy Policy"
    >
      <LegalSection id="collect" title="What we collect">
        <p>
          <strong>Account details.</strong> Your email address, and a password or
          the Google account you sign in with. We never see or store a Google
          password.
        </p>
        <p>
          <strong>Creator profile.</strong> The username, display name, bio,
          links, images, wheels, and page settings you choose to publish. This is
          public by design.
        </p>
        <p>
          <strong>Payment records.</strong> The amount, currency, status, and
          timestamp of each payment, plus any name or message a sender chooses to
          attach. <strong>We never receive or store card numbers.</strong> Card
          details are entered on Stripe&rsquo;s own checkout and stay with
          Stripe.
        </p>
        <p>
          <strong>Connected accounts.</strong> If you connect Twitch, we store
          your Twitch user id and tokens so we can read your stream status and
          Cheer events. If you connect Stripe, we store your Stripe account id
          and its onboarding and payout status.
        </p>
        <p>
          <strong>Usage.</strong> Counts of page views and link clicks on creator
          pages, so creators can see how their page performs. We do not build
          advertising profiles and we do not sell data.
        </p>
      </LegalSection>

      <LegalSection id="why" title="Why we collect it">
        <p>
          To run your account and your public page, to process payments and pay
          creators, to show creators their own analytics, to detect fraud and
          abuse, to respond to support and reports, and to meet our legal and tax
          obligations.
        </p>
      </LegalSection>

      <LegalSection id="shared" title="Who it is shared with">
        <p>We use a small number of processors, each for a specific purpose:</p>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>
            <strong>Stripe</strong> — payments, connected accounts, and payouts.
          </li>
          <li>
            <strong>Google Firebase</strong> — authentication, database, file
            storage, and hosting.
          </li>
          <li>
            <strong>Twitch</strong> — only if you connect it, and only for stream
            status and Cheer events.
          </li>
        </ul>
        <p>
          We do not sell personal information. We disclose it otherwise only
          where the law requires it, or to protect the safety of people using the
          service.
        </p>
        <p>
          What a viewer sees of another viewer is limited to what a creator
          chooses to display — a queue can be set to hide names entirely, and a
          sender can pay anonymously.
        </p>
      </LegalSection>

      <LegalSection id="cookies" title="Cookies and similar technology">
        <p>
          We use storage in your browser to keep you signed in and to remember
          interface preferences. We do not use advertising or cross-site tracking
          cookies. Stripe sets its own cookies on its checkout pages, governed by
          Stripe&rsquo;s privacy policy.
        </p>
      </LegalSection>

      <LegalSection id="retention" title="How long we keep it">
        <p>
          Account and profile data is kept while your account exists. Payment
          records are kept for as long as tax, accounting, and dispute
          obligations require, which is typically seven years, even after an
          account is deleted. Analytics counts are kept in aggregate.
        </p>
      </LegalSection>

      <LegalSection id="rights" title="Your choices">
        <p>
          You can edit or unpublish your page at any time from your dashboard.
          You can disconnect Twitch or Stripe at any time, though disconnecting
          Stripe stops you receiving payments.
        </p>
        <p>
          To request access to your data, a copy of it, correction, or deletion,
          email{" "}
          <a
            className="font-medium text-accent hover:underline"
            href="mailto:support@tributes.bio"
          >
            support@tributes.bio
          </a>
          . We will verify that the request comes from the account holder before
          acting on it. Depending on where you live you may have additional
          rights under local law, and we will honour them.
        </p>
      </LegalSection>

      <LegalSection id="security" title="Security">
        <p>
          Data is held in Google Cloud infrastructure with access limited to what
          each part of the service needs. Payment credentials are held by Stripe,
          not by us. No system is perfect, and we will tell affected people
          promptly if a breach puts their data at risk.
        </p>
      </LegalSection>

      <LegalSection id="children" title="Age">
        <p>
          Tributes is not for people under 18. We do not knowingly collect data
          from children, and we delete accounts we learn belong to them.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="Changes and contact">
        <p>
          We will update the effective date above when this policy changes, and
          tell account holders directly if a change is material.
        </p>
        <p>
          lurk LLC, trading as Tributes ·{" "}
          <a
            className="font-medium text-accent hover:underline"
            href="mailto:support@tributes.bio"
          >
            support@tributes.bio
          </a>
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
