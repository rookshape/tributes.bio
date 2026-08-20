import { LegalDocument, LegalSection } from "../components/LegalDocument";
import { SPIN_FEE_RATE, TIP_FEE_RATE, feePercentLabel } from "../lib/money";

/**
 * The policy a payment processor reads first, and the one a viewer is most
 * likely to arrive at with a specific grievance — so it leads with the two
 * mechanics people actually dispute: what a hold is, and when a spin becomes
 * non-refundable.
 */
export function RefundsPage() {
  return (
    <LegalDocument
      effective="20 August 2026"
      intro="How payments, holds, cancellations, refunds, and disputes work on Tributes. This policy covers money sent through Tributes to a creator. It applies to everyone who pays through the service."
      title="Payments and Refunds"
    >
      <LegalSection id="what-you-pay" title="What you are paying for">
        <p>
          Tributes carries two kinds of payment. A <strong>tribute</strong> is a
          one-time voluntary payment to a creator. A <strong>spin</strong> is a
          paid entry into a live game the creator runs on their stream, where a
          wheel determines the final amount you send.
        </p>
        <p>
          The creator receives the amount shown to you. Tributes charges a
          service fee on top of it —{" "}
          {feePercentLabel(TIP_FEE_RATE)} on a tribute and{" "}
          {feePercentLabel(SPIN_FEE_RATE)} on a spin — which is included in every
          total you are shown before you pay. Card processing and payouts are
          handled by Stripe.
        </p>
      </LegalSection>

      <LegalSection id="holds" title="Holds on spins">
        <p>
          When you buy a spin run, we authorise the{" "}
          <strong>maximum you could possibly owe</strong> and hold it. That
          maximum is displayed before you pay and is the largest figure on the
          page. Nothing is captured at that point.
        </p>
        <p>
          When the run finishes, we capture only what you actually owe — the
          entry price plus whatever the wheel awarded — and the rest of the hold
          is released. The captured amount can never exceed the maximum you
          agreed to.
        </p>
        <p>
          Released holds usually disappear from your statement within a few
          business days, though the exact timing is set by your bank rather than
          by us. A hold is not a charge, and you are not billed for it.
        </p>
      </LegalSection>

      <LegalSection id="refunds" title="When you can get a refund">
        <p>
          <strong>Tributes are voluntary and are generally final.</strong> A
          creator has already received the payment, and we do not reverse it
          simply because a sender changed their mind.
        </p>
        <p>
          <strong>Spins are a performed service.</strong> Once the creator has
          spun the wheel and the run has completed, the payment is for something
          that has already happened on stream, and is generally final.
        </p>
        <p>We will refund a payment where:</p>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>The payment was unauthorised, duplicated, or charged in error.</li>
          <li>
            You paid for a spin run that was never run — for example the creator
            ended their session or removed you from the queue before spinning.
            In that case the hold is cancelled rather than refunded, and nothing
            is captured.
          </li>
          <li>
            A technical fault on our side charged you an amount other than the
            one determined by your run.
          </li>
          <li>
            The creator asks us to refund you, or the payment breached our{" "}
            <a className="font-medium text-accent hover:underline" href="/terms">
              Terms
            </a>
            .
          </li>
        </ul>
        <p>
          Refunds are returned to the original payment method. Where we refund a
          payment, we refund the service fee with it.
        </p>
      </LegalSection>

      <LegalSection id="how" title="How to ask">
        <p>
          Email{" "}
          <a
            className="font-medium text-accent hover:underline"
            href="mailto:support@tributes.bio"
          >
            support@tributes.bio
          </a>{" "}
          with the creator&rsquo;s page name, the approximate time of the
          payment, and the amount. We aim to respond within two business days.
        </p>
        <p>
          Please contact us before opening a dispute with your bank. A dispute
          takes the decision out of both our hands and takes considerably longer
          to resolve than an email does.
        </p>
      </LegalSection>

      <LegalSection id="disputes" title="Chargebacks and disputes">
        <p>
          If you dispute a payment with your card issuer, we will respond with
          the record of the payment, including what was displayed to you at
          checkout and, for a spin, the results of the run.
        </p>
        <p>
          Disputed and refunded payments are deducted from the creator&rsquo;s
          balance and removed from their totals. We may hold payouts or suspend
          an account where disputes indicate fraud or abuse.
        </p>
      </LegalSection>

      <LegalSection id="failures" title="Failed payments">
        <p>
          If a capture fails at the end of a spin run, you are not charged and
          the creator is not paid. If a hold expires before a run completes, the
          run is void and nothing is captured.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="Contact">
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
