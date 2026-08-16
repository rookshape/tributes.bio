import { httpsCallable } from "firebase/functions";
import { collection, getDocs, query, where } from "firebase/firestore";
import { functions } from "./firebase";
import { db } from "./firebase";

export type StripeConnectStatus =
  | "not_started"
  | "needs_action"
  | "pending"
  | "active"
  | "restricted";

type UrlResponse = { url: string };

export async function startStripeConnectOnboarding() {
  const callable = httpsCallable<{ origin: string }, UrlResponse>(
    functions,
    "createStripeConnectOnboardingLink",
  );
  const result = await callable({ origin: window.location.origin });
  return result.data.url;
}

export async function openStripeDashboard() {
  const callable = httpsCallable<Record<string, never>, UrlResponse>(
    functions,
    "createStripeConnectDashboardLink",
  );
  const result = await callable({});
  return result.data.url;
}

export async function refreshStripeConnectStatus() {
  const callable = httpsCallable<
    Record<string, never>,
    { status: StripeConnectStatus }
  >(functions, "refreshStripeConnectStatus");
  const result = await callable({});
  return result.data.status;
}

export async function getCreatorPaymentAvailability(creatorId: string) {
  const callable = httpsCallable<{ creatorId: string }, { available: boolean }>(
    functions,
    "getCreatorPaymentAvailability",
  );
  const result = await callable({ creatorId });
  return result.data.available;
}

type CheckoutInput = {
  creatorId: string;
  amountCents: number;
  senderName: string;
  message: string;
  anonymous: boolean;
};

export async function createTributeCheckout(input: CheckoutInput) {
  const callable = httpsCallable<
    CheckoutInput & { origin: string },
    UrlResponse
  >(functions, "createTributeCheckoutSession");
  const result = await callable({ ...input, origin: window.location.origin });
  return result.data.url;
}

type SpinCheckoutInput = {
  creatorId: string;
  senderName: string;
  anonymous: boolean;
};

export async function createSpinCheckout(input: SpinCheckoutInput) {
  const callable = httpsCallable<
    SpinCheckoutInput & { origin: string },
    UrlResponse
  >(functions, "createSpinCheckoutSession");
  const result = await callable({ ...input, origin: window.location.origin });
  return result.data.url;
}

export type CreatorPayment = {
  id: string;
  kind: "tribute" | "spin";
  anonymous: boolean;
  creatorAmountCents: number;
  senderName: string;
  status: string;
  createdAt: Date | null;
};

export async function getCreatorPayments(creatorId: string) {
  const snapshot = await getDocs(
    query(
      collection(db, "payments"),
      where("creatorId", "==", creatorId),
    ),
  );

  return snapshot.docs
    .map((payment): CreatorPayment => {
      const data = payment.data();
      const createdAt = data.createdAt?.toDate?.();

      return {
        id: payment.id,
        kind: data.kind === "spin" ? "spin" : "tribute",
        anonymous: data.anonymous === true,
        creatorAmountCents: Number(data.creatorAmountCents ?? 0),
        senderName: String(data.senderName ?? ""),
        status: String(data.status ?? "pending"),
        createdAt: createdAt instanceof Date ? createdAt : null,
      };
    })
    .sort(
      (a, b) =>
        (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
    );
}
