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
