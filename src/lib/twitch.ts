import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

export type TwitchSubscriptionStatus = {
  status: string;
  error: string | null;
};

export type TwitchConnection = {
  connected: boolean;
  status: "not_connected" | "connected" | "reconnect_required";
  broadcasterId: string | null;
  broadcasterLogin: string | null;
  broadcasterDisplayName: string | null;
  broadcasterProfileImageUrl: string | null;
  autoLiveEnabled: boolean;
  bitsCounterEnabled: boolean;
  showBitsAlerts: boolean;
  isLive: boolean;
  subscriptions: Record<string, TwitchSubscriptionStatus>;
};

export type TwitchSettings = Pick<
  TwitchConnection,
  "autoLiveEnabled" | "bitsCounterEnabled" | "showBitsAlerts"
>;

const getConnectionCall = httpsCallable<
  Record<string, never>,
  TwitchConnection
>(functions, "getTwitchConnection");

const startConnectionCall = httpsCallable<
  { origin: string },
  { url: string }
>(functions, "startTwitchConnection");

const updateSettingsCall = httpsCallable<TwitchSettings, TwitchSettings>(
  functions,
  "updateTwitchSettings",
);

const disconnectCall = httpsCallable<
  Record<string, never>,
  { disconnected: boolean }
>(functions, "disconnectTwitch");

export async function getTwitchConnection() {
  const result = await getConnectionCall({});
  return result.data;
}

export async function startTwitchConnection() {
  const result = await startConnectionCall({ origin: window.location.origin });
  return result.data.url;
}

export async function updateTwitchSettings(settings: TwitchSettings) {
  const result = await updateSettingsCall(settings);
  return result.data;
}

export async function disconnectTwitch() {
  const result = await disconnectCall({});
  return result.data.disconnected;
}
