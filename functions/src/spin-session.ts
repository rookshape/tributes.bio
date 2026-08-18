export type SpinSessionData = FirebaseFirestore.DocumentData | undefined;

const manualHeartbeatWindowMs = 120000;

export function manualSpinSessionIsLive(
  session: SpinSessionData,
  now = Date.now(),
) {
  const hasExplicitManualState = typeof session?.manualLive === "boolean";
  const manualLive = hasExplicitManualState
    ? session?.manualLive === true
    : session?.status === "live" && session?.twitchLive !== true;
  const heartbeatAtMs = Number(
    session?.manualHeartbeatAtMs ?? session?.heartbeatAtMs ?? 0,
  );

  return manualLive && heartbeatAtMs > 0 && now - heartbeatAtMs < manualHeartbeatWindowMs;
}

export function twitchSpinSessionIsLive(session: SpinSessionData) {
  return session?.twitchLive === true;
}

export function spinSessionIsLive(
  session: SpinSessionData,
  now = Date.now(),
) {
  return (
    twitchSpinSessionIsLive(session) || manualSpinSessionIsLive(session, now)
  );
}
