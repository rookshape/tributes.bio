import { createHash } from "node:crypto";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

const reportCategories = new Set([
  "spam",
  "scam",
  "impersonation",
  "harassment",
  "prohibited_content",
  "other",
]);

function requiredId(value: unknown, label: string) {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 128 ||
    !/^[a-zA-Z0-9_-]+$/.test(value)
  ) {
    throw new HttpsError("invalid-argument", `Invalid ${label}.`);
  }
  return value;
}

function optionalText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function reporterKey(uid: string | undefined, ip: string) {
  const projectId = process.env.GCLOUD_PROJECT ?? "tributes";
  const date = new Date().toISOString().slice(0, 10);
  return createHash("sha256")
    .update(`${projectId}:${uid ?? ip}:${date}`)
    .digest("hex");
}

export const submitContentReport = onCall(async (request) => {
  const creatorId = requiredId(request.data?.creatorId, "creator ID");
  const targetType = request.data?.targetType;
  if (targetType !== "profile" && targetType !== "link") {
    throw new HttpsError("invalid-argument", "Invalid report target.");
  }
  const targetId = targetType === "link"
    ? requiredId(request.data?.targetId, "link ID")
    : null;
  const category = String(request.data?.category ?? "");
  if (!reportCategories.has(category)) {
    throw new HttpsError("invalid-argument", "Choose a report category.");
  }
  const details = optionalText(request.data?.details, 500);
  const tokenEmail =
    typeof request.auth?.token.email === "string" ? request.auth.token.email : "";
  const reporterEmail = optionalText(request.data?.reporterEmail, 254) || tokenEmail;
  if (reporterEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reporterEmail)) {
    throw new HttpsError("invalid-argument", "Enter a valid email address.");
  }

  const firestore = getFirestore();
  const creatorRef = firestore.doc(`creators/${creatorId}`);
  const linkRef = targetId
    ? firestore.doc(`creators/${creatorId}/links/${targetId}`)
    : null;
  const rateRef = firestore.doc(
    `reportRateLimits/${reporterKey(request.auth?.uid, request.rawRequest.ip ?? "unknown")}`,
  );
  const reportRef = firestore.collection("contentReports").doc();

  await firestore.runTransaction(async (transaction) => {
    const [creatorSnapshot, linkSnapshot, rateSnapshot] = await Promise.all([
      transaction.get(creatorRef),
      linkRef ? transaction.get(linkRef) : Promise.resolve(null),
      transaction.get(rateRef),
    ]);
    if (!creatorSnapshot.exists) {
      throw new HttpsError("not-found", "Profile not found.");
    }
    if (targetType === "link" && !linkSnapshot?.exists) {
      throw new HttpsError("not-found", "Link not found.");
    }

    const rateData = rateSnapshot.data();
    const expiresAt = rateData?.expiresAt;
    const activeWindow = expiresAt instanceof Timestamp && expiresAt.toMillis() > Date.now();
    const count = activeWindow ? Number(rateData?.count ?? 0) : 0;
    if (count >= 5) {
      throw new HttpsError("resource-exhausted", "Too many reports. Try again later.");
    }

    const creator = creatorSnapshot.data()!;
    transaction.set(rateRef, {
      count: count + 1,
      expiresAt: Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000),
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.create(reportRef, {
      creatorId,
      creatorUsername: String(creator.username ?? ""),
      targetType,
      targetId,
      targetLabel:
        targetType === "link"
          ? String(linkSnapshot?.data()?.title ?? "Link")
          : `@${String(creator.username ?? "profile")}`,
      category,
      details,
      reporterUid: request.auth?.uid ?? null,
      reporterEmail,
      status: "open",
      resolution: "",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  return { reportId: reportRef.id };
});
