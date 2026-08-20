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
  /**
   * Whether the page offers one-time tributes.
   *
   * Separate from whether it *can*: a creator whose Stripe account is not ready
   * has no tribute form either way, but that is a state to explain rather than a
   * choice they made. Defaults on, so connecting Stripe is all it takes.
   */
  tipsEnabled: boolean;
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
  /**
   * Spins this slice hands out on top of whatever its type does.
   *
   * "$50 + spin" is a staple of the format and is a cash result *and* a bonus
   * spin at once, so it cannot be expressed as a type. Optional: wheels saved
   * before it existed simply have none.
   */
  bonusSpins?: number;
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
  /**
   * Ceiling on what one viewer can be charged across a whole run, however far
   * their multipliers and bonus spins carry them. This is the amount Stripe
   * authorizes and the number the viewer agrees to before paying, so it is the
   * headline of the wheel rather than fine print.
   */
  maxChargeCents: number;
  /** Spins a viewer gets for one purchase, before anything the wheel hands out. */
  spinsPerPurchase: number;
  isEnabled: boolean;
  showOnProfile: boolean;
  mockModeEnabled: boolean;
  /** Hue and tone the two alternating slice shades are derived from. */
  wheelHue: number;
  wheelTone: number;
  /** Soft animated halo on the lighter alternating slices. */
  wheelGlow: boolean;
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
  /**
   * What this viewer owes so far in the run they are currently on. Starts at
   * the spin price and climbs until an amount slice ends the run.
   */
  tabCents: number;
  /** Spins still owed on the run they are on. */
  spinsLeft: number;
  source: "mock" | "bonus" | "payment";
  /** The wheel this viewer paid to spin. Null on entries made before wheels
   *  were selectable. */
  wheelName: string | null;
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
  /** The spinning viewer's running tab, and the ceiling it stops at. */
  tabCents: number;
  /** What the tab read before this spin, so it can tick up on the result. */
  tabBeforeCents: number;
  tabMaxCents: number;
  /** True while the run continues — spins are still owed. */
  tabOpen: boolean;
  /** Spins left in the run, and what the last slice handed out. */
  spinsLeft: number;
  spinsAwarded: number;
  multiplier: number;
  /**
   * A multiplier that has landed but not yet been spent, and the values as they
   * stood before this spin — the overlay shows those while the wheel turns, so
   * a bonus or a multiplier is not announced before it lands.
   */
  pendingMultiplier: number;
  pendingMultiplierBefore: number;
  spinsLeftBefore: number;
  startedAtMs: number;
  durationMs: number;
  lockedUntilMs: number;
  twitchBitsAlert: TwitchBitsAlert | null;
};
