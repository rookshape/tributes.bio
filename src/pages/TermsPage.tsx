import { Link } from "react-router-dom";
import { LegalDocument, LegalSection } from "../components/LegalDocument";
import { SPIN_FEE_RATE, TIP_FEE_RATE, feePercentLabel } from "../lib/money";

export function TermsPage() {
  return (
    <LegalDocument
      effective="20 August 2026"
      intro="These terms are the agreement between you and lurk LLC, which operates Tributes at tributes.bio. They apply whether you use Tributes as a creator, as someone paying a creator, or as a visitor."
      title="Terms of Service"
    >
      <LegalSection id="eligibility" title="Who can use Tributes">
        <p>
          You must be at least 18 years old. You must be able to enter a contract
          where you live, and you must not be barred from using the service under
          any applicable law or sanctions programme.
        </p>
        <p>
          You are responsible for what happens under your account, including
          keeping your sign-in details private.
        </p>
      </LegalSection>

      <LegalSection id="what-we-are" title="What Tributes does, and does not, do">
        <p>
          Tributes gives creators a public page and tools for taking payments
          from their audience, including a live wheel game. We are a platform
          between a creator and the people who choose to support them.
        </p>
        <p>
          <strong>
            We are not a party to what a creator promises their audience.
          </strong>{" "}
          A creator is responsible for their own content, their own conduct, and
          for anything they offer in return for payment. We do not guarantee that
          a creator will do anything in particular.
        </p>
      </LegalSection>

      <LegalSection id="payments" title="Payments and fees">
        <p>
          Payments are processed by Stripe. By paying through Tributes you also
          agree to Stripe&rsquo;s terms, and by taking payments as a creator you
          agree to the Stripe Connected Account Agreement.
        </p>
        <p>
          The creator receives the amount displayed. Tributes charges the sender
          a service fee on top of it — {feePercentLabel(TIP_FEE_RATE)} on a
          tribute and {feePercentLabel(SPIN_FEE_RATE)} on a spin. Every total
          shown to a sender includes that fee before they pay.
        </p>
        <p>
          For a spin, we authorise the maximum you could owe and capture only
          what your run actually reaches, releasing the rest. That maximum is
          displayed before you pay, and we never capture more than it. Holds,
          cancellations, and refunds are covered in the{" "}
          <Link className="font-medium text-accent hover:underline" to="/refunds">
            Payments and Refunds policy
          </Link>
          .
        </p>
        <p>
          Payouts are made by Stripe to the creator&rsquo;s connected account on
          Stripe&rsquo;s schedule. We may hold a payout where we are
          investigating fraud, abuse, disputes, or a breach of these terms.
        </p>
      </LegalSection>

      <LegalSection id="conduct" title="Acceptable use">
        <p>You may not use Tributes to:</p>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>
            Publish or solicit sexually explicit material, or material sexualising
            minors.
          </li>
          <li>
            Run gambling, wagering, lotteries, or anything where a payment buys a
            chance at a prize outside the creator&rsquo;s own presentation.
          </li>
          <li>
            Sell regulated or prohibited goods, including drugs, weapons,
            counterfeits, or financial instruments.
          </li>
          <li>
            Harass, threaten, defame, impersonate, or incite violence against
            anyone.
          </li>
          <li>
            Infringe copyright, trade marks, or other intellectual property.
          </li>
          <li>
            Launder money, evade sanctions, test stolen cards, or otherwise
            defraud us, a creator, or a payer.
          </li>
          <li>
            Manipulate the queue, the wheel, or payment flows, including through
            automation or by exploiting a bug rather than reporting it.
          </li>
        </ul>
        <p>
          The wheel is entertainment presented during a stream. It must not be
          promoted as gambling, and a creator must not represent a spin as a bet.
        </p>
      </LegalSection>

      <LegalSection id="content" title="Your content">
        <p>
          You keep ownership of what you publish. You grant us the licence we
          need to host it, display it on your public page, and show it inside the
          product — nothing wider than that.
        </p>
        <p>
          You confirm you have the rights to what you upload. We remove
          infringing material on a valid report; send copyright complaints to{" "}
          <a
            className="font-medium text-accent hover:underline"
            href="mailto:support@tributes.bio"
          >
            support@tributes.bio
          </a>{" "}
          with enough detail to identify the work and the page.
        </p>
      </LegalSection>

      <LegalSection id="enforcement" title="Moderation and account action">
        <p>
          Anyone can report a creator page from the page itself. Depending on
          severity we may warn an account, unpublish a page, hold payouts,
          suspend, or terminate. We act faster and without warning where there is
          risk of harm, fraud, or illegality.
        </p>
        <p>
          To appeal, email{" "}
          <a
            className="font-medium text-accent hover:underline"
            href="mailto:support@tributes.bio"
          >
            support@tributes.bio
          </a>{" "}
          from the account&rsquo;s address. Money already owed to a creator for
          legitimate payments is still paid out, less any refunds, disputes, or
          fees.
        </p>
      </LegalSection>

      <LegalSection id="closing" title="Closing your account">
        <p>
          You may stop using Tributes at any time and ask us to delete your
          account. Some records are kept as described in the{" "}
          <Link className="font-medium text-accent hover:underline" to="/privacy">
            Privacy Policy
          </Link>
          . We may end our agreement with you on notice, or immediately where
          these terms have been breached.
        </p>
      </LegalSection>

      <LegalSection id="disclaimers" title="Disclaimers and liability">
        <p>
          Tributes is provided as it is. We do not promise it will be
          uninterrupted or error free, and we do not guarantee any level of
          earnings.
        </p>
        <p>
          To the extent the law allows, we are not liable for indirect or
          consequential loss, and our total liability to you is limited to the
          greater of the service fees we earned on your account in the three
          months before the claim, or one hundred US dollars. Nothing here
          excludes liability that cannot lawfully be excluded.
        </p>
      </LegalSection>

      <LegalSection id="law" title="Governing law and changes">
        <p>
          These terms are governed by the laws of the State of «state», United
          States, and disputes are subject to the courts of that state.
        </p>
        <p>
          We may change these terms. We will update the effective date above, and
          tell account holders directly where a change is material. Continuing to
          use Tributes after a change means accepting it.
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
