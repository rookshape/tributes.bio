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
};

export type CreatorProfile = {
  id: string;
  ownerUid: string;
  username: string;
  displayName: string;
  bio: string;
  photoPath: string | null;
  stripeAccountId: string | null;
  stripeOnboardingStatus: "not_started" | "pending" | "complete";
  isPublished: boolean;
  moderationStatus: "active" | "review" | "suspended";
};
