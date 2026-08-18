import type { PageAppearance } from "./pageThemes";

export type AccountType = "personal" | "creator";

export type AppUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  accountType: AccountType | null;
  accountStatus: "active" | "disabled";
  onboardingComplete: boolean;
  creatorId?: string;
  username?: string;
  emailPreferences: EmailPreferences;
};

export type EmailPreferences = {
  paymentActivity: boolean;
  productUpdates: boolean;
};

/** Hue and light/dark tone; every page color derives from these. */
export type ProfileAppearance = PageAppearance;

export type CreatorProfile = {
  id: string;
  ownerUid: string;
  username: string;
  displayName: string;
  bio: string;
  photoPath: string | null;
  photoURL: string | null;
  appearance: ProfileAppearance;
  isPublished: boolean;
  moderationStatus: "active" | "review" | "suspended";
};

export type CreatorLink = {
  id: string;
  title: string;
  url: string;
  position: number;
  isActive: boolean;
};

export type AnalyticsSummary = {
  profileViews: number;
  linkClicks: number;
  earningsCents: number;
  tipCount: number;
  spinCount: number;
  successfulPayments: number;
  averageTipCents: number;
  conversionRate: number;
};

export type DailyAnalytics = {
  date: string;
  profileViews: number;
  linkClicks: number;
  earningsCents: number;
  tipCount: number;
  spinCount: number;
};

export type LinkAnalytics = {
  id: string;
  title: string;
  clicks: number;
  clickThroughRate: number;
};

export type ReferrerAnalytics = {
  source: string;
  views: number;
  clicks: number;
  total: number;
};

export type SpinSliceType = "amount" | "multiplier" | "bonus" | "action";

export type SpinSlice = {
  id: string;
  label: string;
  type: SpinSliceType;
  value: number;
  action: string;
  color: string;
};

export type SpinConfig = {
  /** Document id. "current" is the active wheel the Cloud Functions read. */
  id: string;
  /** Library name, shown in the wheel list. */
  name: string;
  archived: boolean;
  /** Offered to viewers on the public spin page. */
  availableToViewers: boolean;
  /** Shown when nothing in the queue determines the wheel. */
  isDefault: boolean;
  creatorId: string;
  title: string;
  counterLabel: string;
  spinPriceCents: number;
  isEnabled: boolean;
  showOnProfile: boolean;
  mockModeEnabled: boolean;
  /** Hue and tone the two alternating slice shades are derived from. */
  wheelHue: number;
  wheelTone: number;
  slices: SpinSlice[];
};

export type SpinQueueStatus =
  | "queued"
  | "capturing"
  | "completed"
  | "payment_failed"
  | "canceled";

export type SpinQueueEntry = {
  id: string;
  viewerName: string;
  amountCents: number;
  authorizedTotalCents: number;
  source: "mock" | "bonus" | "payment";
  status: SpinQueueStatus;
  resultLabel: string | null;
  createdAtMs: number;
};

export type SpinSession = {
  creatorId: string;
  status: "offline" | "live";
  startedAtMs: number;
  heartbeatAtMs: number;
  manualHeartbeatAtMs: number;
  manualLive: boolean;
  twitchLive: boolean;
};

export type TwitchBitsAlert = {
  id: string;
  viewerName: string;
  bits: number;
  amountCents: number;
  createdAtMs: number;
};

export type SpinReceiptStatus =
  | "checkout"
  | "authorized"
  | "queued"
  | "capturing"
  | "bonus"
  | "completed"
  | "payment_failed"
  | "canceled";

export type SpinReceipt = {
  id: string;
  creatorId: string;
  creatorUsername: string;
  viewerName: string;
  status: SpinReceiptStatus;
  resultLabel: string | null;
  creatorAmountCents: number | null;
  totalCents: number | null;
  updatedAtMs: number;
};

export type SpinState = {
  creatorId: string;
  counterCents: number;
  spinId: string | null;
  queueEntryId: string | null;
  viewerName: string | null;
  selectedIndex: number | null;
  /** Wheel this spin ran on, and the one to show once it settles. */
  wheelId: string | null;
  nextWheelId: string | null;
  resultLabel: string | null;
  resultType: SpinSliceType | null;
  counterDeltaCents: number;
  startedAtMs: number;
  durationMs: number;
  lockedUntilMs: number;
  twitchBitsAlert: TwitchBitsAlert | null;
};
