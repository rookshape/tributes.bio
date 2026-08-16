export type AccountType = "personal" | "creator";

export type AppUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  accountType: AccountType | null;
  onboardingComplete: boolean;
  creatorId?: string;
  username?: string;
  emailPreferences: EmailPreferences;
};

export type EmailPreferences = {
  paymentActivity: boolean;
  productUpdates: boolean;
};

export type ButtonStyle = "solid" | "outline";

export type ProfileAppearance = {
  backgroundColor: string;
  textColor: string;
  buttonColor: string;
  buttonTextColor: string;
  buttonStyle: ButtonStyle;
};

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
};

export type DailyAnalytics = AnalyticsSummary & {
  date: string;
};

export type LinkAnalytics = {
  id: string;
  title: string;
  clicks: number;
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
  creatorId: string;
  title: string;
  counterLabel: string;
  spinPriceCents: number;
  isEnabled: boolean;
  showOnProfile: boolean;
  mockModeEnabled: boolean;
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
  resultLabel: string | null;
  resultType: SpinSliceType | null;
  counterDeltaCents: number;
  startedAtMs: number;
  durationMs: number;
  lockedUntilMs: number;
};
