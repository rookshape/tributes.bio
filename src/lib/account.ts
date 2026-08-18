import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { auth, db } from "./firebase";
import { DEFAULT_APPEARANCE, normalizeAppearance } from "./pageThemes";
import type { AppUser, CreatorProfile } from "./types";
import type { EmailPreferences } from "./types";

const defaultAppearance = DEFAULT_APPEARANCE;

const reservedUsernames = new Set([
  "admin",
  "api",
  "app",
  "dashboard",
  "help",
  "login",
  "logout",
  "onboarding",
  "overlay",
  "settings",
  "signup",
  "support",
  "terms",
  "privacy",
]);

export function normalizeUsername(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 24);
}

export function validateUsername(value: string) {
  const username = normalizeUsername(value);

  if (username.length < 3) {
    return "Use at least 3 characters.";
  }

  if (reservedUsernames.has(username)) {
    return "That username is reserved.";
  }

  return null;
}

/**
 * Whether a username is free. `usernames/{username}` is world-readable, so this
 * is a single document lookup rather than a query.
 */
export async function isUsernameAvailable(usernameValue: string) {
  const username = normalizeUsername(usernameValue);

  if (validateUsername(username)) return false;

  const snapshot = await getDoc(doc(db, "usernames", username));

  if (!snapshot.exists()) return true;

  // Re-claiming your own reserved name is allowed, matching reserveCreatorUsername.
  return snapshot.data().ownerUid === auth.currentUser?.uid;
}

export function suggestUsername(user: User) {
  const source = user.displayName ?? user.email?.split("@")[0] ?? "creator";
  return normalizeUsername(source.replace(/\s+/g, "_"));
}

export async function ensureUserRecord(user: User) {
  const userRef = doc(db, "users", user.uid);
  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      accountType: null,
      onboardingComplete: false,
      emailPreferences: {
        paymentActivity: true,
        productUpdates: false,
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    });
  } else {
    await setDoc(
      userRef,
      {
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        lastLoginAt: serverTimestamp(),
      },
      { merge: true },
    );
  }

  return getUserRecord(user.uid);
}

export async function getUserRecord(uid: string): Promise<AppUser | null> {
  const snapshot = await getDoc(doc(db, "users", uid));

  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data();

  return {
    uid,
    email: data.email ?? null,
    displayName: data.displayName ?? null,
    photoURL: data.photoURL ?? null,
    accountType: data.accountType ?? null,
    accountStatus: data.accountStatus === "disabled" ? "disabled" : "active",
    onboardingComplete: Boolean(data.onboardingComplete),
    creatorId: data.creatorId,
    username: data.username,
    emailPreferences: {
      paymentActivity: data.emailPreferences?.paymentActivity ?? true,
      productUpdates: data.emailPreferences?.productUpdates ?? false,
    },
  };
}

export async function updateEmailPreferences(
  uid: string,
  emailPreferences: EmailPreferences,
) {
  await setDoc(
    doc(db, "users", uid),
    {
      emailPreferences,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function completePersonalOnboarding(user: User) {
  await setDoc(
    doc(db, "users", user.uid),
    {
      accountType: "personal",
      onboardingComplete: true,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return getUserRecord(user.uid);
}

/** Marks creator onboarding finished, once the wizard's last step is done. */
export async function completeCreatorOnboarding(user: User) {
  await setDoc(
    doc(db, "users", user.uid),
    { onboardingComplete: true, updatedAt: serverTimestamp() },
    { merge: true },
  );

  return getUserRecord(user.uid);
}

/**
 * Claims the username and creates the creator profile. Deliberately leaves
 * `onboardingComplete` false: the wizard continues to the links step, and the
 * dashboard redirect guard reads that flag.
 */
export async function reserveCreatorUsername(user: User, usernameValue: string) {
  const username = normalizeUsername(usernameValue);
  const validationError = validateUsername(username);

  if (validationError) {
    throw new Error(validationError);
  }

  const userRef = doc(db, "users", user.uid);
  const creatorRef = doc(db, "creators", user.uid);
  const usernameRef = doc(db, "usernames", username);

  await runTransaction(db, async (transaction) => {
    const usernameSnapshot = await transaction.get(usernameRef);

    if (usernameSnapshot.exists()) {
      const ownerUid = usernameSnapshot.data().ownerUid;

      if (ownerUid !== user.uid) {
        throw new Error("That username is already taken.");
      }
    }

    transaction.set(
      userRef,
      {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        accountType: "creator",
        creatorId: user.uid,
        username,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    transaction.set(
      creatorRef,
      {
        ownerUid: user.uid,
        username,
        displayName: user.displayName ?? username,
        bio: "",
        photoPath: null,
        photoURL: user.photoURL,
        appearance: defaultAppearance,
        isPublished: true,
        moderationStatus: "active",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    transaction.set(
      doc(db, "creatorSettings", user.uid),
      {
        ownerUid: user.uid,
        stripeAccountId: null,
        stripeOnboardingStatus: "not_started",
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    transaction.set(usernameRef, {
      creatorId: user.uid,
      ownerUid: user.uid,
      reservedAt: serverTimestamp(),
    });
  });

  return getUserRecord(user.uid);
}

export async function getCreatorByUsername(
  usernameValue: string,
): Promise<CreatorProfile | null> {
  const username = normalizeUsername(usernameValue);
  const usernameSnapshot = await getDoc(doc(db, "usernames", username));

  if (!usernameSnapshot.exists()) {
    return null;
  }

  const { creatorId } = usernameSnapshot.data();
  const creatorSnapshot = await getDoc(doc(db, "creators", creatorId));

  if (!creatorSnapshot.exists()) {
    return null;
  }

  const data = creatorSnapshot.data();

  return {
    id: creatorSnapshot.id,
    ownerUid: data.ownerUid,
    username: data.username,
    displayName: data.displayName,
    bio: data.bio ?? "",
    photoPath: data.photoPath ?? null,
    photoURL: data.photoURL ?? null,
    appearance: normalizeAppearance(data.appearance),
    isPublished: Boolean(data.isPublished),
    moderationStatus: data.moderationStatus ?? "active",
  };
}
