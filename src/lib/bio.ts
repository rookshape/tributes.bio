import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";
import { db, storage } from "./firebase";
import { DEFAULT_APPEARANCE, normalizeAppearance } from "./pageThemes";
import type {
  CreatorLink,
  CreatorProfile,
  ProfileAppearance,
} from "./types";

export const defaultAppearance: ProfileAppearance = DEFAULT_APPEARANCE;

/**
 * Older profiles carry either the original per-color map or the interim
 * themeId. Both are discarded in favour of the default hue/tone, which the
 * next save rewrites in the current shape.
 */
function readAppearance(value: unknown): ProfileAppearance {
  return normalizeAppearance(value);
}

type ProfileChanges = Pick<
  CreatorProfile,
  | "displayName"
  | "bio"
  | "photoPath"
  | "photoURL"
  | "appearance"
  | "isPublished"
>;

function mapProfile(id: string, data: Record<string, unknown>): CreatorProfile {
  return {
    id,
    ownerUid: String(data.ownerUid ?? ""),
    username: String(data.username ?? ""),
    displayName: String(data.displayName ?? ""),
    bio: String(data.bio ?? ""),
    photoPath: typeof data.photoPath === "string" ? data.photoPath : null,
    photoURL: typeof data.photoURL === "string" ? data.photoURL : null,
    appearance: readAppearance(data.appearance),
    isPublished: Boolean(data.isPublished),
    moderationStatus:
      data.moderationStatus === "review" || data.moderationStatus === "suspended"
        ? data.moderationStatus
        : "active",
  };
}

function mapLink(id: string, data: Record<string, unknown>): CreatorLink {
  return {
    id,
    title: String(data.title ?? ""),
    url: String(data.url ?? ""),
    position: Number(data.position ?? 0),
    isActive: Boolean(data.isActive),
  };
}

export function normalizeExternalUrl(value: string) {
  const candidate = value.trim();
  const withProtocol = /^https?:\/\//i.test(candidate)
    ? candidate
    : `https://${candidate}`;

  let url: URL;

  try {
    url = new URL(withProtocol);
  } catch {
    throw new Error("Enter a valid link.");
  }

  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) {
    throw new Error("Links must use http or https.");
  }

  if (url.toString().length > 2048) {
    throw new Error("That link is too long.");
  }

  return url.toString();
}

function validateProfile(profile: ProfileChanges) {
  const displayName = profile.displayName.trim();
  const bio = profile.bio.trim();

  if (!displayName || displayName.length > 80) {
    throw new Error("Display name must be between 1 and 80 characters.");
  }

  if (bio.length > 160) {
    throw new Error("Bio must be 160 characters or fewer.");
  }

  return {
    displayName,
    bio,
    appearance: normalizeAppearance(profile.appearance),
  };
}

async function migratePrivateCreatorFields(
  creatorId: string,
  data: Record<string, unknown>,
) {
  if (!("stripeAccountId" in data) && !("stripeOnboardingStatus" in data)) {
    return;
  }

  const batch = writeBatch(db);
  batch.set(
    doc(db, "creatorSettings", creatorId),
    {
      ownerUid: creatorId,
      stripeAccountId: data.stripeAccountId ?? null,
      stripeOnboardingStatus: data.stripeOnboardingStatus ?? "not_started",
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  batch.update(doc(db, "creators", creatorId), {
    photoURL: data.photoURL ?? null,
    appearance: readAppearance(data.appearance),
    stripeAccountId: deleteField(),
    stripeOnboardingStatus: deleteField(),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function getCreatorWorkspace(creatorId: string) {
  const creatorSnapshot = await getDoc(doc(db, "creators", creatorId));

  if (!creatorSnapshot.exists()) {
    throw new Error("Creator profile not found.");
  }

  const data = creatorSnapshot.data();
  await migratePrivateCreatorFields(creatorId, data);

  const linksSnapshot = await getDocs(
    query(
      collection(db, "creators", creatorId, "links"),
      orderBy("position", "asc"),
    ),
  );

  return {
    profile: mapProfile(creatorSnapshot.id, data),
    links: linksSnapshot.docs.map((link) => mapLink(link.id, link.data())),
  };
}

export async function getPublicCreatorLinks(creatorId: string) {
  const snapshot = await getDocs(
    query(
      collection(db, "creators", creatorId, "links"),
      where("isActive", "==", true),
    ),
  );

  return snapshot.docs
    .map((link) => mapLink(link.id, link.data()))
    .sort((a, b) => a.position - b.position);
}

export async function updateCreatorProfile(
  creatorId: string,
  changes: ProfileChanges,
) {
  const { displayName, bio, appearance } = validateProfile(changes);

  await updateDoc(doc(db, "creators", creatorId), {
    displayName,
    bio,
    photoPath: changes.photoPath,
    photoURL: changes.photoURL,
    appearance,
    isPublished: changes.isPublished,
    updatedAt: serverTimestamp(),
  });
}

export async function createCreatorLink(
  creatorId: string,
  titleValue: string,
  urlValue: string,
  position: number,
) {
  const title = titleValue.trim();

  if (!title || title.length > 80) {
    throw new Error("Link title must be between 1 and 80 characters.");
  }

  const linkRef = doc(collection(db, "creators", creatorId, "links"));
  const link: CreatorLink = {
    id: linkRef.id,
    title,
    url: normalizeExternalUrl(urlValue),
    position,
    isActive: true,
  };

  await setDoc(linkRef, {
    title: link.title,
    url: link.url,
    position: link.position,
    isActive: link.isActive,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return link;
}

export async function updateCreatorLink(
  creatorId: string,
  link: CreatorLink,
) {
  const title = link.title.trim();

  if (!title || title.length > 80) {
    throw new Error("Link title must be between 1 and 80 characters.");
  }

  const normalizedLink = {
    ...link,
    title,
    url: normalizeExternalUrl(link.url),
  };

  await updateDoc(doc(db, "creators", creatorId, "links", link.id), {
    title: normalizedLink.title,
    url: normalizedLink.url,
    position: normalizedLink.position,
    isActive: normalizedLink.isActive,
    updatedAt: serverTimestamp(),
  });

  return normalizedLink;
}

/** Copies a link directly below the original, so ordering stays predictable. */
export async function duplicateCreatorLink(
  creatorId: string,
  link: CreatorLink,
  links: CreatorLink[],
) {
  const copy = await createCreatorLink(
    creatorId,
    `${link.title} copy`.slice(0, 80),
    link.url,
    links.length,
  );

  const index = links.findIndex((item) => item.id === link.id);
  const reordered = [...links];
  reordered.splice(index + 1, 0, copy);

  const positioned = reordered.map((item, position) => ({ ...item, position }));
  await reorderCreatorLinks(creatorId, positioned);

  return positioned;
}

export async function deleteCreatorLink(creatorId: string, linkId: string) {
  await deleteDoc(doc(db, "creators", creatorId, "links", linkId));
}

export async function reorderCreatorLinks(
  creatorId: string,
  links: CreatorLink[],
) {
  const batch = writeBatch(db);

  links.forEach((link, position) => {
    batch.update(doc(db, "creators", creatorId, "links", link.id), {
      position,
      updatedAt: serverTimestamp(),
    });
  });

  await batch.commit();
}

export async function uploadProfilePhoto(
  creatorId: string,
  file: File,
  previousPath: string | null,
) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose an image file.");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Profile images must be smaller than 5 MB.");
  }

  const path = `profileImages/${creatorId}/profile-${Date.now()}`;
  const photoRef = ref(storage, path);
  await uploadBytes(photoRef, file, { contentType: file.type });
  const photoURL = await getDownloadURL(photoRef);

  if (previousPath && previousPath !== path) {
    await deleteObject(ref(storage, previousPath)).catch(() => undefined);
  }

  return { photoPath: path, photoURL };
}
