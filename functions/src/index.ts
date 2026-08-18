import { initializeApp } from "firebase-admin/app";
import { setGlobalOptions } from "firebase-functions/v2/options";

initializeApp();
setGlobalOptions({ maxInstances: 10, region: "us-central1" });

export {
  getCreatorAnalyticsDashboard,
  recordAnalyticsEvent,
} from "./analytics.js";

export {
  changeCreatorUsername,
  checkAdminAccess,
  getAdminOverview,
  resolveContentReport,
  searchAdminRecords,
  setAdminUserDisabled,
  setCreatorModerationStatus,
} from "./admin.js";

export { submitContentReport } from "./moderation.js";

export {
  createStripeConnectDashboardLink,
  createStripeConnectOnboardingLink,
  createSpinCheckoutSession,
  createTributeCheckoutSession,
  getCreatorPaymentAvailability,
  getCreatorPayments,
  refreshStripeConnectStatus,
  stripeWebhook,
} from "./stripe.js";

export {
  adjustSpinCounter,
  createMockSpinEntry,
  heartbeatSpinSession,
  setSpinLiveStatus,
  triggerSpin,
} from "./spin.js";

export {
  disconnectTwitch,
  getTwitchConnection,
  startTwitchConnection,
  twitchEventSubWebhook,
  twitchOAuthCallback,
  updateTwitchSettings,
  validateTwitchConnections,
} from "./twitch.js";
