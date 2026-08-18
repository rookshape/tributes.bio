/**
 * Overlay sounds, synthesised rather than sampled.
 *
 * Every sound here is built from oscillators and noise at playback time. That
 * means no audio files to license, host, or wait on before the overlay can make
 * a noise, and the whole set costs nothing in bundle size — which matters for a
 * browser source a streamer reloads mid-broadcast.
 *
 * OBS browser sources autoplay without a gesture. Ordinary tabs do not, so the
 * context starts suspended and is resumed on the first interaction.
 */

export type OverlaySoundName = "spin" | "tick" | "result" | "win" | "queue";

export type SoundSettings = {
  enabled: boolean;
  /** 0-100, applied on top of each sound's own level. */
  volume: number;
  spin: boolean;
  tick: boolean;
  result: boolean;
  win: boolean;
  queue: boolean;
};

export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  enabled: false,
  volume: 60,
  spin: true,
  tick: true,
  result: true,
  win: true,
  queue: true,
};

export const SOUND_LABELS: { id: OverlaySoundName; label: string; hint: string }[] = [
  { id: "spin", label: "Spin", hint: "When the wheel starts moving" },
  { id: "tick", label: "Ticks", hint: "Each slice passing the pointer" },
  { id: "result", label: "Result", hint: "When the wheel settles" },
  { id: "win", label: "Big win", hint: "A multiplier or extra spins" },
  { id: "queue", label: "Queue", hint: "Someone joins the queue" },
];

let context: AudioContext | null = null;

function audio() {
  if (typeof window === "undefined") return null;

  if (!context) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    context = new Ctor();
  }

  // A tab that has not been interacted with keeps the context suspended.
  if (context.state === "suspended") void context.resume();

  return context;
}

/** Call from a click handler so previews are audible in an ordinary tab. */
export function unlockOverlayAudio() {
  const ctx = audio();
  if (ctx?.state === "suspended") void ctx.resume();
}

type ToneOptions = {
  type?: OscillatorType;
  from: number;
  to?: number;
  duration: number;
  gain: number;
  delay?: number;
};

/** One swept oscillator with a short attack and an exponential tail. */
function tone(ctx: AudioContext, master: number, options: ToneOptions) {
  const { type = "sine", from, to = from, duration, gain, delay = 0 } = options;
  const start = ctx.currentTime + delay;
  const oscillator = ctx.createOscillator();
  const envelope = ctx.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(from, start);
  if (to !== from) {
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + duration);
  }

  const peak = Math.max(0.0001, gain * master);
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(peak, start + 0.012);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  oscillator.connect(envelope).connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

/** Filtered noise burst, used for the wheel's initial whoosh. */
function noise(ctx: AudioContext, master: number, duration: number, gain: number) {
  const frames = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const channel = buffer.getChannelData(0);

  for (let index = 0; index < frames; index += 1) {
    // Fades across the buffer so the burst does not end on a click.
    channel[index] = (Math.random() * 2 - 1) * (1 - index / frames);
  }

  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const envelope = ctx.createGain();

  source.buffer = buffer;
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(1200, ctx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + duration);
  envelope.gain.setValueAtTime(Math.max(0.0001, gain * master), ctx.currentTime);
  envelope.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

  source.connect(filter).connect(envelope).connect(ctx.destination);
  source.start();
}

export function playOverlaySound(name: OverlaySoundName, settings: SoundSettings) {
  if (!settings.enabled || !settings[name]) return;

  const ctx = audio();
  if (!ctx) return;

  const master = Math.min(1, Math.max(0, settings.volume / 100));
  if (master <= 0) return;

  if (name === "spin") {
    noise(ctx, master, 0.45, 0.18);
    tone(ctx, master, { type: "triangle", from: 160, to: 520, duration: 0.4, gain: 0.1 });
    return;
  }

  if (name === "tick") {
    // Deliberately tiny: this fires many times a second at full speed.
    tone(ctx, master, { type: "square", from: 1900, duration: 0.028, gain: 0.045 });
    return;
  }

  if (name === "result") {
    tone(ctx, master, { type: "sine", from: 660, duration: 0.16, gain: 0.16 });
    tone(ctx, master, { type: "sine", from: 990, duration: 0.28, gain: 0.13, delay: 0.1 });
    return;
  }

  if (name === "win") {
    // Rising arpeggio — the one sound allowed to feel like a payout.
    [523, 659, 784, 1047].forEach((frequency, index) =>
      tone(ctx, master, {
        type: "triangle",
        from: frequency,
        duration: 0.34,
        gain: 0.15,
        delay: index * 0.075,
      }),
    );
    return;
  }

  tone(ctx, master, { type: "sine", from: 880, to: 1180, duration: 0.16, gain: 0.11 });
}
