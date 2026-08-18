import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { getApp } from "firebase-admin/app";
import {
  FieldPath,
  FieldValue,
  Timestamp,
  getFirestore,
} from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import {
  HttpsError,
  onCall,
  onRequest,
  type Request,
} from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import {
  cancelSpinAuthorization,
  stripeSecret,
} from "./stripe.js";
import { manualSpinSessionIsLive } from "./spin-session.js";

export const twitchClientId = defineSecret("TWITCH_CLIENT_ID");
export const twitchClientSecret = defineSecret("TWITCH_CLIENT_SECRET");
export const twitchEventSubSecret = defineSecret("TWITCH_EVENTSUB_SECRET");

const twitchApiBase = "https://api.twitch.tv/helix";
const twitchIdentityBase = "https://id.twitch.tv/oauth2";

type TwitchConnection = {
  accessToken?: string;
  refreshToken?: string;
  broadcasterId?: string;
  broadcasterLogin?: string;
  broadcasterDisplayName?: string;
  broadcasterProfileImageUrl?: string;
  status?: string;
  scopes?: string[];
  subscriptions?: Record<string, TwitchSubscriptionRecord>;
  autoLiveEnabled?: boolean;
  bitsCounterEnabled?: boolean;
  showBitsAlerts?: boolean;
  isLive?: boolean;
};

type TwitchSubscriptionRecord = {
  id: string;
  status: string;
  error?: string;
};

type TwitchTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string[];
  token_type: string;
};

type TwitchUser = {
  id: string;
  login: string;
  display_name: string;
  profile_image_url: string;
};

type EventSubMessage = {
  subscription?: {
    id?: string;
    status?: string;
    type?: string;
    condition?: Record<string, string>;
  };
  event?: Record<string, unknown>;
  challenge?: string;
};

function requiredAuthUid(auth: { uid: string } | undefined) {
  if (!auth) {
    throw new HttpsError("unauthenticated", "Sign in to continue.");
  }

  return auth.uid;
}

function allowedOrigin(value: unknown) {
  if (typeof value !== "string") {
    throw new HttpsError("invalid-argument", "Invalid return URL.");
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new HttpsError("invalid-argument", "Invalid return URL.");
  }

  const local =
    url.protocol === "http:" &&
    (url.hostname === "127.0.0.1" || url.hostname === "localhost");
  const hosted =
    url.protocol === "https:" &&
    [
      "tributes.bio",
      "www.tributes.bio",
      "tributes-bio-dev.web.app",
      "tributes-bio-dev.firebaseapp.com",
      "tributes-bio-prod.web.app",
      "tributes-bio-prod.firebaseapp.com",
    ].includes(url.hostname);

  if (!local && !hosted) {
    throw new HttpsError("permission-denied", "Return URL is not allowed.");
  }

  return url.origin;
}

function projectId() {
  const value = String(
    getApp().options.projectId ??
      process.env.GCLOUD_PROJECT ??
      process.env.GOOGLE_CLOUD_PROJECT ??
      "",
  );

  if (!value) {
    throw new Error("Firebase project ID is unavailable.");
  }

  return value;
}

function functionUrl(name: string) {
  return `https://us-central1-${projectId()}.cloudfunctions.net/${name}`;
}

async function responseJson<T>(response: Response) {
  const body = (await response.json().catch(() => null)) as
    | (T & { message?: string; error?: string })
    | null;

  if (!response.ok || !body) {
    throw new Error(
      body?.message ?? body?.error ?? `Twitch request failed (${response.status}).`,
    );
  }

  return body;
}

async function exchangeAuthorizationCode(code: string) {
  const body = new URLSearchParams({
    client_id: twitchClientId.value(),
    client_secret: twitchClientSecret.value(),
    code,
    grant_type: "authorization_code",
    redirect_uri: functionUrl("twitchOAuthCallback"),
  });
  const response = await fetch(`${twitchIdentityBase}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  return responseJson<TwitchTokenResponse>(response);
}

async function refreshUserToken(refreshToken: string) {
  const body = new URLSearchParams({
    client_id: twitchClientId.value(),
    client_secret: twitchClientSecret.value(),
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const response = await fetch(`${twitchIdentityBase}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  return responseJson<TwitchTokenResponse>(response);
}

async function getAppAccessToken() {
  const body = new URLSearchParams({
    client_id: twitchClientId.value(),
    client_secret: twitchClientSecret.value(),
    grant_type: "client_credentials",
  });
  const response = await fetch(`${twitchIdentityBase}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const token = await responseJson<TwitchTokenResponse>(response);
  return token.access_token;
}

async function getTwitchUser(accessToken: string) {
  const response = await fetch(`${twitchApiBase}/users`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Client-Id": twitchClientId.value(),
    },
  });
  const body = await responseJson<{ data: TwitchUser[] }>(response);
  const user = body.data[0];

  if (!user) {
    throw new Error("Twitch did not return a broadcaster account.");
  }

  return user;
}

async function getBroadcasterIsLive(
  accessToken: string,
  broadcasterId: string,
) {
  const response = await fetch(
    `${twitchApiBase}/streams?user_id=${encodeURIComponent(broadcasterId)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Client-Id": twitchClientId.value(),
      },
    },
  );
  const body = await responseJson<{ data: unknown[] }>(response);
  return body.data.length > 0;
}

async function createEventSubscription(
  appAccessToken: string,
  type: "stream.online" | "stream.offline" | "channel.cheer",
  broadcasterId: string,
) {
  const response = await fetch(`${twitchApiBase}/eventsub/subscriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${appAccessToken}`,
      "Client-Id": twitchClientId.value(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type,
      version: "1",
      condition: { broadcaster_user_id: broadcasterId },
      transport: {
        method: "webhook",
        callback: functionUrl("twitchEventSubWebhook"),
        secret: twitchEventSubSecret.value(),
      },
    }),
  });
  const body = await responseJson<{
    data: Array<{ id: string; status: string }>;
  }>(response);
  const subscription = body.data[0];

  if (!subscription) {
    throw new Error(`Twitch did not create the ${type} subscription.`);
  }

  return { id: subscription.id, status: subscription.status };
}

async function createEventSubscriptions(broadcasterId: string) {
  const appAccessToken = await getAppAccessToken();
  const types = ["stream.online", "stream.offline", "channel.cheer"] as const;
  const results = await Promise.allSettled(
    types.map((type) =>
      createEventSubscription(appAccessToken, type, broadcasterId),
    ),
  );

  return Object.fromEntries(
    types.map((type, index) => {
      const result = results[index];
      return [
        type,
        result.status === "fulfilled"
          ? result.value
          : {
              id: "",
              status: "failed",
              error:
                result.reason instanceof Error
                  ? result.reason.message
                  : "Subscription failed.",
            },
      ];
    }),
  ) as Record<string, TwitchSubscriptionRecord>;
}

async function deleteEventSubscriptions(
  subscriptions: Record<string, TwitchSubscriptionRecord> | undefined,
) {
  const ids = Object.values(subscriptions ?? {})
    .map((subscription) => subscription.id)
    .filter(Boolean);

  if (!ids.length) return;

  const appAccessToken = await getAppAccessToken();
  await Promise.allSettled(
    ids.map((id) =>
      fetch(
        `${twitchApiBase}/eventsub/subscriptions?id=${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${appAccessToken}`,
            "Client-Id": twitchClientId.value(),
          },
        },
      ),
    ),
  );
}

function publicConnection(data: TwitchConnection | undefined) {
  if (!data) {
    return {
      connected: false,
      status: "not_connected",
      broadcasterId: null,
      broadcasterLogin: null,
      broadcasterDisplayName: null,
      broadcasterProfileImageUrl: null,
      autoLiveEnabled: true,
      bitsCounterEnabled: false,
      showBitsAlerts: false,
      isLive: false,
      subscriptions: {},
    };
  }

  return {
    connected: data.status === "connected",
    status: data.status ?? "reconnect_required",
    broadcasterId: data.broadcasterId ?? null,
    broadcasterLogin: data.broadcasterLogin ?? null,
    broadcasterDisplayName: data.broadcasterDisplayName ?? null,
    broadcasterProfileImageUrl: data.broadcasterProfileImageUrl ?? null,
    autoLiveEnabled: data.autoLiveEnabled !== false,
    bitsCounterEnabled: data.bitsCounterEnabled === true,
    showBitsAlerts: data.showBitsAlerts === true,
    isLive: data.isLive === true,
    subscriptions: Object.fromEntries(
      Object.entries(data.subscriptions ?? {}).map(([type, subscription]) => [
        type,
        { status: subscription.status, error: subscription.error ?? null },
      ]),
    ),
  };
}

export const startTwitchConnection = onCall(
  { secrets: [twitchClientId] },
  async (request) => {
    const uid = requiredAuthUid(request.auth);
    const returnOrigin = allowedOrigin(request.data?.origin);
    const firestore = getFirestore();
    const [userSnapshot, creatorSnapshot] = await Promise.all([
      firestore.doc(`users/${uid}`).get(),
      firestore.doc(`creators/${uid}`).get(),
    ]);

    if (
      userSnapshot.data()?.accountType !== "creator" ||
      creatorSnapshot.data()?.ownerUid !== uid
    ) {
      throw new HttpsError("failed-precondition", "Creator account required.");
    }

    const state = randomBytes(32).toString("hex");
    await firestore.doc(`twitchOAuthStates/${state}`).create({
      creatorId: uid,
      returnOrigin,
      expiresAt: Timestamp.fromMillis(Date.now() + 10 * 60 * 1000),
      used: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    const params = new URLSearchParams({
      client_id: twitchClientId.value(),
      redirect_uri: functionUrl("twitchOAuthCallback"),
      response_type: "code",
      scope: "bits:read",
      state,
      force_verify: "true",
    });

    return { url: `https://id.twitch.tv/oauth2/authorize?${params}` };
  },
);

export const twitchOAuthCallback = onRequest(
  {
    secrets: [twitchClientId, twitchClientSecret, twitchEventSubSecret],
  },
  async (request, response) => {
    const state = typeof request.query.state === "string" ? request.query.state : "";
    const code = typeof request.query.code === "string" ? request.query.code : "";
    const firestore = getFirestore();
    const stateRef = firestore.doc(`twitchOAuthStates/${state}`);
    let creatorId = "";
    let returnOrigin = "https://tributes.bio";

    try {
      if (!state) {
        throw new Error("Twitch authorization state is missing.");
      }

      await firestore.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(stateRef);
        const data = snapshot.data();

        if (
          !snapshot.exists ||
          data?.used === true ||
          !(data?.expiresAt instanceof Timestamp) ||
          data.expiresAt.toMillis() <= Date.now()
        ) {
          throw new Error("Twitch authorization expired. Please try again.");
        }

        creatorId = String(data.creatorId ?? "");
        returnOrigin = allowedOrigin(data.returnOrigin);
        transaction.update(stateRef, {
          used: true,
          usedAt: FieldValue.serverTimestamp(),
        });
      });

      if (!code) {
        throw new Error(
          typeof request.query.error_description === "string"
            ? request.query.error_description
            : "Twitch authorization was canceled or incomplete.",
        );
      }

      const token = await exchangeAuthorizationCode(code);
      const broadcaster = await getTwitchUser(token.access_token);
      const broadcasterIsLive = await getBroadcasterIsLive(
        token.access_token,
        broadcaster.id,
      );
      const connectionRef = firestore.doc(`twitchConnections/${creatorId}`);
      const sessionRef = firestore.doc(
        `creators/${creatorId}/spinSessions/current`,
      );
      const [connectionSnapshot, sessionSnapshot] = await Promise.all([
        connectionRef.get(),
        sessionRef.get(),
      ]);
      const previous = connectionSnapshot.data() as TwitchConnection | undefined;
      const autoLiveEnabled = previous?.autoLiveEnabled !== false;
      const twitchLive = autoLiveEnabled && broadcasterIsLive;

      if (previous?.subscriptions) {
        await deleteEventSubscriptions(previous.subscriptions);
      }

      const batch = firestore.batch();

      if (
        previous?.broadcasterId &&
        previous.broadcasterId !== broadcaster.id
      ) {
        batch.delete(
          firestore.doc(`twitchBroadcasters/${previous.broadcasterId}`),
        );
      }

      batch.set(
        connectionRef,
        {
          creatorId,
          broadcasterId: broadcaster.id,
          broadcasterLogin: broadcaster.login,
          broadcasterDisplayName: broadcaster.display_name,
          broadcasterProfileImageUrl: broadcaster.profile_image_url,
          accessToken: token.access_token,
          refreshToken: token.refresh_token ?? "",
          tokenExpiresAtMs: Date.now() + token.expires_in * 1000,
          scopes: token.scope ?? [],
          status: "connected",
          autoLiveEnabled,
          bitsCounterEnabled: previous?.bitsCounterEnabled === true,
          showBitsAlerts: previous?.showBitsAlerts === true,
          isLive: broadcasterIsLive,
          subscriptions: {},
          connectedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      batch.set(firestore.doc(`twitchBroadcasters/${broadcaster.id}`), {
        creatorId,
        updatedAt: FieldValue.serverTimestamp(),
      });
      batch.set(
        sessionRef,
        {
          creatorId,
          twitchLive,
          status:
            twitchLive || manualSpinSessionIsLive(sessionSnapshot.data())
              ? "live"
              : "offline",
          ...(twitchLive ? { startedAtMs: Date.now() } : {}),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      await batch.commit();

      const subscriptions = await createEventSubscriptions(broadcaster.id);
      const challengedSubscriptions = (
        (await connectionRef.get()).data() as TwitchConnection | undefined
      )?.subscriptions;
      const mergedSubscriptions = Object.fromEntries(
        Object.entries(subscriptions).map(([type, subscription]) => [
          type,
          challengedSubscriptions?.[type]?.status === "enabled"
            ? challengedSubscriptions[type]
            : subscription,
        ]),
      );
      await connectionRef.set(
        {
          subscriptions: mergedSubscriptions,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      response.redirect(302, `${returnOrigin}/dashboard/settings?twitch=connected`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Twitch connection failed.";
      response.redirect(
        302,
        `${returnOrigin}/dashboard/settings?twitch=error&reason=${encodeURIComponent(message.slice(0, 180))}`,
      );
    }
  },
);

export const getTwitchConnection = onCall(async (request) => {
  const uid = requiredAuthUid(request.auth);
  const snapshot = await getFirestore().doc(`twitchConnections/${uid}`).get();
  return publicConnection(snapshot.data() as TwitchConnection | undefined);
});

export const updateTwitchSettings = onCall(async (request) => {
  const uid = requiredAuthUid(request.auth);
  const autoLiveEnabled = request.data?.autoLiveEnabled === true;
  const bitsCounterEnabled = request.data?.bitsCounterEnabled === true;
  const showBitsAlerts = request.data?.showBitsAlerts === true;
  const firestore = getFirestore();
  const connectionRef = firestore.doc(`twitchConnections/${uid}`);
  const sessionRef = firestore.doc(`creators/${uid}/spinSessions/current`);

  await firestore.runTransaction(async (transaction) => {
    const [connectionSnapshot, sessionSnapshot] = await Promise.all([
      transaction.get(connectionRef),
      transaction.get(sessionRef),
    ]);
    const connection = connectionSnapshot.data() as TwitchConnection | undefined;

    if (!connectionSnapshot.exists || connection?.status !== "connected") {
      throw new HttpsError("failed-precondition", "Connect Twitch first.");
    }

    const twitchLive = autoLiveEnabled && connection.isLive === true;
    const effectiveLive =
      twitchLive || manualSpinSessionIsLive(sessionSnapshot.data());

    transaction.update(connectionRef, {
      autoLiveEnabled,
      bitsCounterEnabled,
      showBitsAlerts,
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.set(
      sessionRef,
      {
        creatorId: uid,
        twitchLive,
        status: effectiveLive ? "live" : "offline",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });

  return { autoLiveEnabled, bitsCounterEnabled, showBitsAlerts };
});

export const disconnectTwitch = onCall(
  { secrets: [twitchClientId, twitchClientSecret, stripeSecret] },
  async (request) => {
    const uid = requiredAuthUid(request.auth);
    const firestore = getFirestore();
    const connectionRef = firestore.doc(`twitchConnections/${uid}`);
    const connectionSnapshot = await connectionRef.get();
    const connection = connectionSnapshot.data() as TwitchConnection | undefined;

    if (!connectionSnapshot.exists || !connection) {
      return { disconnected: true };
    }

    await deleteEventSubscriptions(connection.subscriptions).catch(() => undefined);

    if (connection.accessToken) {
      await fetch(`${twitchIdentityBase}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: twitchClientId.value(),
          token: connection.accessToken,
        }),
      }).catch(() => undefined);
    }

    const sessionRef = firestore.doc(`creators/${uid}/spinSessions/current`);
    const sessionSnapshot = await sessionRef.get();
    const batch = firestore.batch();
    batch.delete(connectionRef);
    if (connection.broadcasterId) {
      batch.delete(
        firestore.doc(`twitchBroadcasters/${connection.broadcasterId}`),
      );
    }
    const remainsLive = manualSpinSessionIsLive(sessionSnapshot.data());
    batch.set(
      sessionRef,
      {
        twitchLive: false,
        status: remainsLive ? "live" : "offline",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    await batch.commit();
    if (!remainsLive) {
      await cancelOfflineSpinAuthorizations(uid);
    }
    return { disconnected: true };
  },
);

function verifiedEventSubMessage(request: Request) {
  const messageId = request.get("Twitch-Eventsub-Message-Id") ?? "";
  const timestamp = request.get("Twitch-Eventsub-Message-Timestamp") ?? "";
  const signature = request.get("Twitch-Eventsub-Message-Signature") ?? "";
  const rawBody = request.rawBody;

  if (!messageId || !timestamp || !signature || !rawBody) {
    return null;
  }

  const sentAt = Date.parse(timestamp);
  if (!Number.isFinite(sentAt) || Math.abs(Date.now() - sentAt) > 10 * 60 * 1000) {
    return null;
  }

  const expected = `sha256=${createHmac("sha256", twitchEventSubSecret.value())
    .update(messageId)
    .update(timestamp)
    .update(rawBody)
    .digest("hex")}`;
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);

  if (
    expectedBuffer.length !== signatureBuffer.length ||
    !timingSafeEqual(expectedBuffer, signatureBuffer)
  ) {
    return null;
  }

  return { messageId, body: JSON.parse(rawBody.toString("utf8")) as EventSubMessage };
}

async function cancelOfflineSpinAuthorizations(creatorId: string) {
  const snapshot = await getFirestore()
    .collection(`creators/${creatorId}/spinQueue`)
    .where("status", "==", "queued")
    .limit(50)
    .get();
  await Promise.allSettled(
    snapshot.docs
      .map((document) => document.data().paymentId)
      .filter((paymentId): paymentId is string => typeof paymentId === "string")
      .map((paymentId) => cancelSpinAuthorization(paymentId)),
  );
}

async function processEventSubNotification(
  messageId: string,
  message: EventSubMessage,
) {
  const subscriptionType = String(message.subscription?.type ?? "");
  const broadcasterId = String(
    message.event?.broadcaster_user_id ??
      message.subscription?.condition?.broadcaster_user_id ??
      "",
  );

  if (!broadcasterId) return;

  const firestore = getFirestore();
  const eventRef = firestore.doc(`twitchEvents/${messageId}`);
  const broadcasterRef = firestore.doc(`twitchBroadcasters/${broadcasterId}`);
  let creatorWentOffline = "";

  await firestore.runTransaction(async (transaction) => {
    const [eventSnapshot, broadcasterSnapshot] = await Promise.all([
      transaction.get(eventRef),
      transaction.get(broadcasterRef),
    ]);

    if (eventSnapshot.exists || !broadcasterSnapshot.exists) return;

    const creatorId = String(broadcasterSnapshot.data()?.creatorId ?? "");
    const connectionRef = firestore.doc(`twitchConnections/${creatorId}`);
    const sessionRef = firestore.doc(`creators/${creatorId}/spinSessions/current`);
    const stateRef = firestore.doc(`creators/${creatorId}/spinStates/current`);
    const [connectionSnapshot, sessionSnapshot, stateSnapshot] = await Promise.all([
      transaction.get(connectionRef),
      transaction.get(sessionRef),
      subscriptionType === "channel.cheer"
        ? transaction.get(stateRef)
        : Promise.resolve(null),
    ]);
    const connection = connectionSnapshot.data() as TwitchConnection | undefined;

    transaction.create(eventRef, {
      creatorId,
      broadcasterId,
      subscriptionType,
      receivedAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    if (!connectionSnapshot.exists || connection?.status !== "connected") return;

    const now = Date.now();
    transaction.update(connectionRef, {
      lastEventType: subscriptionType,
      lastEventAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      ...(subscriptionType === "stream.online" ? { isLive: true } : {}),
      ...(subscriptionType === "stream.offline" ? { isLive: false } : {}),
    });

    if (subscriptionType === "stream.online" || subscriptionType === "stream.offline") {
      if (connection.autoLiveEnabled === false) return;

      const twitchLive = subscriptionType === "stream.online";
      const effectiveLive =
        twitchLive || manualSpinSessionIsLive(sessionSnapshot.data(), now);
      transaction.set(
        sessionRef,
        {
          creatorId,
          twitchLive,
          status: effectiveLive ? "live" : "offline",
          ...(twitchLive ? { startedAtMs: now } : { endedAtMs: now }),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      if (!effectiveLive) creatorWentOffline = creatorId;
      return;
    }

    if (subscriptionType !== "channel.cheer") return;

    const bits = Number(message.event?.bits ?? 0);
    if (!Number.isInteger(bits) || bits <= 0) return;

    const amountCents = bits;
    const state = stateSnapshot?.data();
    const update: Record<string, unknown> = {
      creatorId,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (connection.bitsCounterEnabled === true) {
      update.counterCents = Math.max(
        0,
        Number(state?.counterCents ?? 0) + amountCents,
      );
    }

    if (connection.showBitsAlerts === true) {
      const anonymous = message.event?.is_anonymous === true;
      update.twitchBitsAlert = {
        id: messageId,
        viewerName: anonymous
          ? "Anonymous"
          : String(message.event?.user_name ?? "Viewer").slice(0, 40),
        bits,
        amountCents,
        createdAtMs: now,
      };
    }

    if (connection.bitsCounterEnabled === true || connection.showBitsAlerts === true) {
      transaction.set(stateRef, update, { merge: true });
    }
  });

  if (creatorWentOffline) {
    await cancelOfflineSpinAuthorizations(creatorWentOffline);
  }
}

export const twitchEventSubWebhook = onRequest(
  { secrets: [twitchEventSubSecret, stripeSecret] },
  async (request, response) => {
    const verified = verifiedEventSubMessage(request);

    if (!verified) {
      response.status(403).send("Invalid signature");
      return;
    }

    const messageType = request.get("Twitch-Eventsub-Message-Type") ?? "";

    if (messageType === "webhook_callback_verification") {
      const broadcasterId = String(
        verified.body.subscription?.condition?.broadcaster_user_id ?? "",
      );
      const subscriptionType = String(verified.body.subscription?.type ?? "");
      const subscriptionId = String(verified.body.subscription?.id ?? "");
      const mapping = broadcasterId
        ? await getFirestore().doc(`twitchBroadcasters/${broadcasterId}`).get()
        : null;
      const creatorId = String(mapping?.data()?.creatorId ?? "");

      if (creatorId && subscriptionType) {
        await getFirestore().doc(`twitchConnections/${creatorId}`).update(
          new FieldPath("subscriptions", subscriptionType),
          { id: subscriptionId, status: "enabled" },
          "updatedAt",
          FieldValue.serverTimestamp(),
        );
      }

      response.status(200).type("text/plain").send(verified.body.challenge ?? "");
      return;
    }

    if (messageType === "notification") {
      await processEventSubNotification(verified.messageId, verified.body);
      response.status(204).send();
      return;
    }

    if (messageType === "revocation") {
      const broadcasterId = String(
        verified.body.subscription?.condition?.broadcaster_user_id ?? "",
      );
      const mapping = broadcasterId
        ? await getFirestore().doc(`twitchBroadcasters/${broadcasterId}`).get()
        : null;
      const creatorId = String(mapping?.data()?.creatorId ?? "");
      if (creatorId) {
        const type = String(verified.body.subscription?.type ?? "unknown");
        await getFirestore().doc(`twitchConnections/${creatorId}`).update(
          new FieldPath("subscriptions", type, "status"),
          verified.body.subscription?.status ?? "revoked",
          "updatedAt",
          FieldValue.serverTimestamp(),
        );
      }
      response.status(204).send();
      return;
    }

    response.status(204).send();
  },
);

export const validateTwitchConnections = onSchedule(
  {
    schedule: "every 60 minutes",
    secrets: [twitchClientId, twitchClientSecret],
  },
  async () => {
    const firestore = getFirestore();
    const snapshot = await firestore
      .collection("twitchConnections")
      .where("status", "==", "connected")
      .limit(500)
      .get();

    await Promise.allSettled(
      snapshot.docs.map(async (document) => {
        const connection = document.data() as TwitchConnection;
        if (!connection.accessToken) return;

        const validation = await fetch(`${twitchIdentityBase}/validate`, {
          headers: { Authorization: `OAuth ${connection.accessToken}` },
        });
        if (validation.ok) {
          await document.ref.set(
            {
              lastValidatedAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
          return;
        }

        if (!connection.refreshToken) {
          const sessionRef = firestore.doc(
            `creators/${document.id}/spinSessions/current`,
          );
          const sessionSnapshot = await sessionRef.get();
          const batch = firestore.batch();
          batch.set(
            document.ref,
            {
              status: "reconnect_required",
              isLive: false,
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
          batch.set(
            sessionRef,
            {
              twitchLive: false,
              status: manualSpinSessionIsLive(sessionSnapshot.data())
                ? "live"
                : "offline",
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
          await batch.commit();
          return;
        }

        try {
          const token = await refreshUserToken(connection.refreshToken);
          await document.ref.set(
            {
              accessToken: token.access_token,
              refreshToken: token.refresh_token ?? connection.refreshToken,
              tokenExpiresAtMs: Date.now() + token.expires_in * 1000,
              scopes: token.scope ?? connection.scopes ?? [],
              lastValidatedAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
        } catch {
          const sessionRef = firestore.doc(
            `creators/${document.id}/spinSessions/current`,
          );
          const sessionSnapshot = await sessionRef.get();
          const batch = firestore.batch();
          batch.set(
            document.ref,
            {
              status: "reconnect_required",
              isLive: false,
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
          batch.set(
            sessionRef,
            {
              twitchLive: false,
              status: manualSpinSessionIsLive(sessionSnapshot.data())
                ? "live"
                : "offline",
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
          await batch.commit();
        }
      }),
    );
  },
);
