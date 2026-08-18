import type { UserRecord } from "firebase-admin/auth";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

const defaultAdminEmails = "rookshape@gmail.com";

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
]);

type CallableAuth = {
  uid: string;
  token: Record<string, unknown>;
} | undefined;

async function adminAuth() {
  return (await import("firebase-admin/auth")).getAuth();
}

function normalizeUsername(value: unknown) {
  return typeof value === "string"
    ? value.trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24)
    : "";
}

function requiredText(value: unknown, label: string, maxLength: number) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text.length > maxLength) {
    throw new HttpsError("invalid-argument", `Invalid ${label}.`);
  }
  return text;
}

function millis(value: unknown) {
  return value instanceof Timestamp ? value.toMillis() : null;
}

function configuredAdminEmails() {
  return new Set(
    (process.env.ADMIN_EMAILS ?? defaultAdminEmails)
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

function authEmail(auth: CallableAuth) {
  return typeof auth?.token.email === "string" ? auth.token.email.toLowerCase() : "";
}

function isAllowlistedAuth(auth: CallableAuth) {
  return (
    auth?.token.email_verified === true &&
    configuredAdminEmails().has(authEmail(auth))
  );
}

async function requireAdmin(auth: CallableAuth) {
  if (!auth) throw new HttpsError("unauthenticated", "Sign in to continue.");

  if (auth.token.admin === true) {
    return { uid: auth.uid, email: authEmail(auth) };
  }

  if (!isAllowlistedAuth(auth)) {
    throw new HttpsError("permission-denied", "Admin access required.");
  }

  const firebaseAuth = await adminAuth();
  const user = await firebaseAuth.getUser(auth.uid);
  await firebaseAuth.setCustomUserClaims(auth.uid, {
    ...(user.customClaims ?? {}),
    admin: true,
  });
  return { uid: auth.uid, email: authEmail(auth) };
}

async function auditAdminAction(
  admin: { uid: string; email: string },
  action: string,
  targetType: string,
  targetId: string,
  reason: string,
  metadata: Record<string, unknown> = {},
) {
  await getFirestore().collection("adminAuditLogs").add({
    adminUid: admin.uid,
    adminEmail: admin.email,
    action,
    targetType,
    targetId,
    reason,
    metadata,
    createdAt: FieldValue.serverTimestamp(),
  });
}

function serializeUser(document: FirebaseFirestore.DocumentSnapshot, auth?: UserRecord | null) {
  const data = document.data() ?? {};
  return {
    uid: document.id,
    email: String(data.email ?? auth?.email ?? ""),
    displayName: String(data.displayName ?? auth?.displayName ?? ""),
    accountType: data.accountType ?? null,
    accountStatus: String(data.accountStatus ?? (auth?.disabled ? "disabled" : "active")),
    onboardingComplete: data.onboardingComplete === true,
    creatorId: typeof data.creatorId === "string" ? data.creatorId : null,
    username: typeof data.username === "string" ? data.username : null,
    disabled: auth?.disabled === true || data.accountStatus === "disabled",
    createdAtMs: millis(data.createdAt),
    lastLoginAtMs: millis(data.lastLoginAt),
  };
}

function serializeCreator(document: FirebaseFirestore.DocumentSnapshot, settings?: FirebaseFirestore.DocumentData) {
  const data = document.data() ?? {};
  return {
    id: document.id,
    ownerUid: String(data.ownerUid ?? document.id),
    username: String(data.username ?? ""),
    displayName: String(data.displayName ?? ""),
    isPublished: data.isPublished === true,
    moderationStatus: String(data.moderationStatus ?? "active"),
    stripeOnboardingStatus: String(settings?.stripeOnboardingStatus ?? "not_started"),
    stripePayoutsEnabled: settings?.stripePayoutsEnabled === true,
    stripeAccountId: typeof settings?.stripeAccountId === "string" ? settings.stripeAccountId : null,
    createdAtMs: millis(data.createdAt),
    updatedAtMs: millis(data.updatedAt),
  };
}

function serializePayment(document: FirebaseFirestore.DocumentSnapshot) {
  const data = document.data() ?? {};
  return {
    id: document.id,
    kind: String(data.kind ?? "tribute"),
    creatorId: String(data.creatorId ?? ""),
    payerUid: typeof data.payerUid === "string" ? data.payerUid : null,
    payerEmail: typeof data.payerEmail === "string" ? data.payerEmail : null,
    senderName: data.anonymous === true ? "Anonymous" : String(data.senderName ?? "Anonymous"),
    anonymous: data.anonymous === true,
    creatorAmountCents: Number(data.creatorAmountCents ?? 0),
    platformFeeCents: Number(data.platformFeeCents ?? 0),
    totalCents: Number(data.totalCents ?? data.authorizedTotalCents ?? 0),
    status: String(data.status ?? "unknown"),
    stripePaymentIntentId:
      typeof data.stripePaymentIntentId === "string" ? data.stripePaymentIntentId : null,
    stripeCheckoutSessionId:
      typeof data.stripeCheckoutSessionId === "string" ? data.stripeCheckoutSessionId : null,
    createdAtMs: millis(data.createdAt),
    updatedAtMs: millis(data.updatedAt),
  };
}

function serializeReport(document: FirebaseFirestore.DocumentSnapshot) {
  const data = document.data() ?? {};
  return {
    id: document.id,
    creatorId: String(data.creatorId ?? ""),
    targetType: String(data.targetType ?? "profile"),
    targetId: typeof data.targetId === "string" ? data.targetId : null,
    targetLabel: String(data.targetLabel ?? "Profile"),
    category: String(data.category ?? "other"),
    details: String(data.details ?? ""),
    reporterEmail: String(data.reporterEmail ?? ""),
    status: String(data.status ?? "open"),
    resolution: String(data.resolution ?? ""),
    createdAtMs: millis(data.createdAt),
    updatedAtMs: millis(data.updatedAt),
  };
}

export const checkAdminAccess = onCall(async (request) => {
  if (!request.auth) return { authorized: false };
  if (request.auth.token.admin === true || isAllowlistedAuth(request.auth)) {
    await requireAdmin(request.auth);
    return { authorized: true };
  }
  return { authorized: false };
});

export const getAdminOverview = onCall(async (request) => {
  await requireAdmin(request.auth);
  const firestore = getFirestore();
  const [usersCount, creatorsCount, paymentsCount, reportsCount, users, creators, payments, reports, audits] =
    await Promise.all([
      firestore.collection("users").count().get(),
      firestore.collection("creators").count().get(),
      firestore.collection("payments").count().get(),
      firestore.collection("contentReports").where("status", "in", ["open", "review"]).count().get(),
      firestore.collection("users").orderBy("createdAt", "desc").limit(20).get(),
      firestore.collection("creators").orderBy("createdAt", "desc").limit(20).get(),
      firestore.collection("payments").orderBy("createdAt", "desc").limit(30).get(),
      firestore.collection("contentReports").orderBy("createdAt", "desc").limit(30).get(),
      firestore.collection("adminAuditLogs").orderBy("createdAt", "desc").limit(30).get(),
    ]);

  const settings = await Promise.all(
    creators.docs.map((creator) => firestore.doc(`creatorSettings/${creator.id}`).get()),
  );
  return {
    counts: {
      users: usersCount.data().count,
      creators: creatorsCount.data().count,
      payments: paymentsCount.data().count,
      openReports: reportsCount.data().count,
    },
    users: users.docs.map((document) => serializeUser(document)),
    creators: creators.docs.map((document, index) => serializeCreator(document, settings[index].data())),
    payments: payments.docs.map(serializePayment),
    reports: reports.docs.map(serializeReport),
    audits: audits.docs.map((document) => {
      const data = document.data();
      return {
        id: document.id,
        adminEmail: String(data.adminEmail ?? ""),
        action: String(data.action ?? ""),
        targetType: String(data.targetType ?? ""),
        targetId: String(data.targetId ?? ""),
        reason: String(data.reason ?? ""),
        createdAtMs: millis(data.createdAt),
      };
    }),
  };
});

export const searchAdminRecords = onCall(async (request) => {
  await requireAdmin(request.auth);
  const value = requiredText(request.data?.query, "search", 180);
  const firestore = getFirestore();
  let authUser: UserRecord | null = null;

  try {
    authUser = value.includes("@")
      ? await (await adminAuth()).getUserByEmail(value.toLowerCase())
      : await (await adminAuth()).getUser(value);
  } catch {
    authUser = null;
  }

  const username = normalizeUsername(value);
  const usernameSnapshot = username
    ? await firestore.doc(`usernames/${username}`).get()
    : null;
  const creatorId = String(usernameSnapshot?.data()?.creatorId ?? authUser?.uid ?? value);
  const [userSnapshot, creatorSnapshot, settingsSnapshot, paymentSnapshot, intentPayments, creatorPayments] =
    await Promise.all([
      authUser ? firestore.doc(`users/${authUser.uid}`).get() : firestore.doc(`users/${value}`).get(),
      firestore.doc(`creators/${creatorId}`).get(),
      firestore.doc(`creatorSettings/${creatorId}`).get(),
      firestore.doc(`payments/${value}`).get(),
      value.startsWith("pi_")
        ? firestore.collection("payments").where("stripePaymentIntentId", "==", value).limit(5).get()
        : Promise.resolve(null),
      creatorId
        ? firestore.collection("payments").where("creatorId", "==", creatorId).limit(50).get()
        : Promise.resolve(null),
    ]);

  const paymentDocuments = new Map<string, FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot>();
  if (paymentSnapshot.exists) paymentDocuments.set(paymentSnapshot.id, paymentSnapshot);
  intentPayments?.docs.forEach((document) => paymentDocuments.set(document.id, document));
  creatorPayments?.docs.forEach((document) => paymentDocuments.set(document.id, document));

  return {
    user: userSnapshot.exists ? serializeUser(userSnapshot, authUser) : null,
    creator: creatorSnapshot.exists
      ? serializeCreator(creatorSnapshot, settingsSnapshot.data())
      : null,
    payments: [...paymentDocuments.values()]
      .map(serializePayment)
      .sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0)),
  };
});

export const setAdminUserDisabled = onCall(async (request) => {
  const admin = await requireAdmin(request.auth);
  const targetUid = requiredText(request.data?.uid, "user ID", 128);
  const disabled = request.data?.disabled === true;
  const reason = requiredText(request.data?.reason, "reason", 300);

  if (targetUid === admin.uid && disabled) {
    throw new HttpsError("failed-precondition", "You cannot disable your own account.");
  }

  const firebaseAuth = await adminAuth();
  await firebaseAuth.updateUser(targetUid, { disabled });
  if (disabled) await firebaseAuth.revokeRefreshTokens(targetUid);
  const firestore = getFirestore();
  const batch = firestore.batch();
  batch.set(
    firestore.doc(`users/${targetUid}`),
    {
      accountStatus: disabled ? "disabled" : "active",
      accountStatusReason: reason,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  if (disabled && (await firestore.doc(`creators/${targetUid}`).get()).exists) {
    batch.set(
      firestore.doc(`creators/${targetUid}`),
      {
        moderationStatus: "suspended",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }
  await batch.commit();
  await auditAdminAction(admin, disabled ? "user.disabled" : "user.enabled", "user", targetUid, reason);
  return { disabled };
});

export const setCreatorModerationStatus = onCall(async (request) => {
  const admin = await requireAdmin(request.auth);
  const creatorId = requiredText(request.data?.creatorId, "creator ID", 128);
  const status = request.data?.status;
  if (!['active', 'review', 'suspended'].includes(status)) {
    throw new HttpsError("invalid-argument", "Invalid moderation status.");
  }
  const reason = requiredText(request.data?.reason, "reason", 300);
  const creatorRef = getFirestore().doc(`creators/${creatorId}`);
  if (!(await creatorRef.get()).exists) throw new HttpsError("not-found", "Creator not found.");
  await creatorRef.set(
    {
      moderationStatus: status,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  await auditAdminAction(admin, `creator.${status}`, "creator", creatorId, reason);
  return { status };
});

export const changeCreatorUsername = onCall(async (request) => {
  const admin = await requireAdmin(request.auth);
  const creatorId = requiredText(request.data?.creatorId, "creator ID", 128);
  const username = normalizeUsername(request.data?.username);
  const reason = requiredText(request.data?.reason, "reason", 300);
  if (username.length < 3 || reservedUsernames.has(username)) {
    throw new HttpsError("invalid-argument", "Invalid or reserved username.");
  }

  const firestore = getFirestore();
  let previousUsername = "";
  await firestore.runTransaction(async (transaction) => {
    const creatorRef = firestore.doc(`creators/${creatorId}`);
    const userRef = firestore.doc(`users/${creatorId}`);
    const nextUsernameRef = firestore.doc(`usernames/${username}`);
    const [creatorSnapshot, nextUsernameSnapshot] = await Promise.all([
      transaction.get(creatorRef),
      transaction.get(nextUsernameRef),
    ]);
    if (!creatorSnapshot.exists) throw new HttpsError("not-found", "Creator not found.");
    if (nextUsernameSnapshot.exists && nextUsernameSnapshot.data()?.creatorId !== creatorId) {
      throw new HttpsError("already-exists", "That username is already in use.");
    }

    previousUsername = String(creatorSnapshot.data()?.username ?? "");
    transaction.set(nextUsernameRef, {
      creatorId,
      ownerUid: creatorId,
      reservedAt: FieldValue.serverTimestamp(),
    });
    transaction.update(creatorRef, { username, updatedAt: FieldValue.serverTimestamp() });
    transaction.set(userRef, { username, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    if (previousUsername && previousUsername !== username) {
      transaction.delete(firestore.doc(`usernames/${previousUsername}`));
    }
  });

  await auditAdminAction(admin, "creator.username_changed", "creator", creatorId, reason, {
    previousUsername,
    username,
  });
  return { username };
});

export const resolveContentReport = onCall(async (request) => {
  const admin = await requireAdmin(request.auth);
  const reportId = requiredText(request.data?.reportId, "report ID", 128);
  const status = request.data?.status;
  if (!["open", "review", "resolved", "dismissed"].includes(status)) {
    throw new HttpsError("invalid-argument", "Invalid report status.");
  }
  const resolution = requiredText(request.data?.resolution, "resolution", 500);
  const reportRef = getFirestore().doc(`contentReports/${reportId}`);
  if (!(await reportRef.get()).exists) throw new HttpsError("not-found", "Report not found.");
  await reportRef.set(
    {
      status,
      resolution,
      resolvedBy: admin.uid,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  await auditAdminAction(admin, `report.${status}`, "report", reportId, resolution);
  return { status };
});
