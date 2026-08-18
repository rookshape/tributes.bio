# Twitch Setup

## Dev Application

Create a Twitch developer application with this OAuth redirect URL:

```text
https://us-central1-tributes-bio-dev.cloudfunctions.net/twitchOAuthCallback
```

Store its credentials in Firebase Functions secrets:

```bash
firebase functions:secrets:set TWITCH_CLIENT_ID --project dev
firebase functions:secrets:set TWITCH_CLIENT_SECRET --project dev
openssl rand -hex 32
firebase functions:secrets:set TWITCH_EVENTSUB_SECRET --project dev
```

Use the generated hex value for `TWITCH_EVENTSUB_SECRET`. Deploy after all three secrets are set:

```bash
firebase deploy --project dev --only functions,firestore:rules
```

The EventSub webhook URL is created and registered by the app:

```text
https://us-central1-tributes-bio-dev.cloudfunctions.net/twitchEventSubWebhook
```

## Verification

1. Open `/dashboard/settings` and connect Twitch.
2. Confirm `stream.online`, `stream.offline`, and `channel.cheer` are enabled in Firestore under the private `twitchConnections` document.
3. Start and stop a Twitch test stream and verify the Spin dashboard follows its status.
4. Send a Cheer after enabling Bits counter sync and verify the counter changes once.

The dev application is registered as `Tributes Dev`. Its credentials are stored only in Firebase Secret Manager.

Production uses the same process with `--project prod` and this redirect URL:

```text
https://us-central1-tributes-bio-prod.cloudfunctions.net/twitchOAuthCallback
```
