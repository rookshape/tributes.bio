import { httpsCallable } from "firebase/functions";
import { auth, functions } from "./firebase";

export type AdminUser = {
  uid: string;
  email: string;
  displayName: string;
  accountType: "personal" | "creator" | null;
  accountStatus: string;
  onboardingComplete: boolean;
  creatorId: string | null;
  username: string | null;
  disabled: boolean;
  createdAtMs: number | null;
  lastLoginAtMs: number | null;
};

export type AdminCreator = {
  id: string;
  ownerUid: string;
  username: string;
  displayName: string;
  isPublished: boolean;
  moderationStatus: "active" | "review" | "suspended";
  stripeOnboardingStatus: string;
  stripePayoutsEnabled: boolean;
  stripeAccountId: string | null;
  createdAtMs: number | null;
  updatedAtMs: number | null;
};

export type AdminPayment = {
  id: string;
  kind: "tribute" | "spin";
  creatorId: string;
  payerUid: string | null;
  payerEmail: string | null;
  senderName: string;
  anonymous: boolean;
  creatorAmountCents: number;
  platformFeeCents: number;
  totalCents: number;
  status: string;
  stripePaymentIntentId: string | null;
  stripeCheckoutSessionId: string | null;
  createdAtMs: number | null;
  updatedAtMs: number | null;
};

export type AdminReport = {
  id: string;
  creatorId: string;
  targetType: "profile" | "link";
  targetId: string | null;
  targetLabel: string;
  category: string;
  details: string;
  reporterEmail: string;
  status: "open" | "review" | "resolved" | "dismissed";
  resolution: string;
  createdAtMs: number | null;
  updatedAtMs: number | null;
};

export type AdminAudit = {
  id: string;
  adminEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  reason: string;
  createdAtMs: number | null;
};

export type AdminOverview = {
  counts: { users: number; creators: number; payments: number; openReports: number };
  users: AdminUser[];
  creators: AdminCreator[];
  payments: AdminPayment[];
  reports: AdminReport[];
  audits: AdminAudit[];
};

export type AdminSearchResult = {
  user: AdminUser | null;
  creator: AdminCreator | null;
  payments: AdminPayment[];
};

const accessCall = httpsCallable<Record<string, never>, { authorized: boolean }>(functions, "checkAdminAccess");
const overviewCall = httpsCallable<Record<string, never>, AdminOverview>(functions, "getAdminOverview");
const searchCall = httpsCallable<{ query: string }, AdminSearchResult>(functions, "searchAdminRecords");
const userStatusCall = httpsCallable<{ uid: string; disabled: boolean; reason: string }, { disabled: boolean }>(functions, "setAdminUserDisabled");
const creatorStatusCall = httpsCallable<{ creatorId: string; status: AdminCreator["moderationStatus"]; reason: string }, { status: AdminCreator["moderationStatus"] }>(functions, "setCreatorModerationStatus");
const usernameCall = httpsCallable<{ creatorId: string; username: string; reason: string }, { username: string }>(functions, "changeCreatorUsername");
const reportCall = httpsCallable<{ reportId: string; status: AdminReport["status"]; resolution: string }, { status: AdminReport["status"] }>(functions, "resolveContentReport");

export async function checkAdminAccess() {
  const result = await accessCall({});
  if (result.data.authorized) await auth.currentUser?.getIdToken(true);
  return result.data.authorized;
}

export async function getAdminOverview() {
  return (await overviewCall({})).data;
}

export async function searchAdminRecords(query: string) {
  return (await searchCall({ query })).data;
}

export async function setAdminUserDisabled(uid: string, disabled: boolean, reason: string) {
  return (await userStatusCall({ uid, disabled, reason })).data;
}

export async function setCreatorModerationStatus(
  creatorId: string,
  status: AdminCreator["moderationStatus"],
  reason: string,
) {
  return (await creatorStatusCall({ creatorId, status, reason })).data;
}

export async function changeCreatorUsername(creatorId: string, username: string, reason: string) {
  return (await usernameCall({ creatorId, username, reason })).data;
}

export async function resolveContentReport(
  reportId: string,
  status: AdminReport["status"],
  resolution: string,
) {
  return (await reportCall({ reportId, status, resolution })).data;
}
