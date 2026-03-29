const TONE_CDN_URL = "https://cdn.jsdelivr.net/npm/tone@15.1.22/+esm";
const SALAMANDER_BASE_URL = "https://tonejs.github.io/audio/salamander/";

export class PianoAudio {
  constructor() {
    this.tone = null;
    this.sampler = null;
    this.fallbackSynth = null;
    this.readyPromise = null;
    this.nativeAudioCtx = null;
    this.unlocked = false;
  }

  preload() {
    if (!this.readyPromise) {
      this.readyPromise = this.#init();
    }
    return this.readyPromise;
  }

  async playMidi(midi) {
    const fallbackFreq = midiToFrequency(midi);

    try {
      await this.unlock();

      const note = this.tone.Frequency(midi, "midi").toNote();
      if (this.sampler?.loaded) {
        this.sampler.triggerAttackRelease(note, "8n");
        return;
      }

      if (this.fallbackSynth) {
        this.fallbackSynth.triggerAttackRelease(note, "8n", undefined, 0.45);
        return;
      }
    } catch (error) {
      console.warn("Audio unavailable:", error);
    }

    this.#playNativeFallback(fallbackFreq);
  }

  async unlock() {
    this.#ensureNativeContext();
    if (this.nativeAudioCtx && this.nativeAudioCtx.state === "suspended") {
      await this.nativeAudioCtx.resume();
    }

    if (!this.unlocked) {
      this.#tickleNativeContext();
      this.unlocked = true;
    }

    try {
      await this.preload();
      await this.#startContextIfNeeded();
    } catch {
      // Keep native fallback available even when Tone.js is unavailable.
    }
  }

  async playInterval(baseMidi, semitones, options = {}) {
    const gapMs = options.gapMs ?? 430;
    const upperMidi = baseMidi + semitones;

    await this.playMidi(baseMidi);
    await sleep(gapMs);
    await this.playMidi(upperMidi);
  }

  async playMetronomeTick(options = {}) {
    const accent = Boolean(options.accent);
    this.#ensureNativeContext();
    if (!this.nativeAudioCtx) return;

    if (this.nativeAudioCtx.state === "suspended") {
      await this.nativeAudioCtx.resume();
    }

    const ctx = this.nativeAudioCtx;
    const now = ctx.currentTime;
    const freq = accent ? 1880 : 1320;
    const gainPeak = accent ? 0.23 : 0.16;
    const duration = accent ? 0.055 : 0.045;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = "square";
    osc.frequency.setValueAtTime(freq, now);

    filter.type = "highpass";
    filter.frequency.setValueAtTime(900, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainPeak, now + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  async #init() {
    const Tone = await import(TONE_CDN_URL);
    this.tone = Tone;

    this.sampler = new Tone.Sampler({
      urls: {
        A0: "A0.mp3",
        C1: "C1.mp3",
        "D#1": "Ds1.mp3",
        "F#1": "Fs1.mp3",
        A1: "A1.mp3",
        C2: "C2.mp3",
        "D#2": "Ds2.mp3",
        "F#2": "Fs2.mp3",
        A2: "A2.mp3",
        C3: "C3.mp3",
        "D#3": "Ds3.mp3",
        "F#3": "Fs3.mp3",
        A3: "A3.mp3",
        C4: "C4.mp3",
        "D#4": "Ds4.mp3",
        "F#4": "Fs4.mp3",
        A4: "A4.mp3",
        C5: "C5.mp3",
        "D#5": "Ds5.mp3",
        "F#5": "Fs5.mp3",
        A5: "A5.mp3",
        C6: "C6.mp3",
        "D#6": "Ds6.mp3",
        "F#6": "Fs6.mp3",
        A6: "A6.mp3",
        C7: "C7.mp3",
        "D#7": "Ds7.mp3",
        "F#7": "Fs7.mp3",
        A7: "A7.mp3",
        C8: "C8.mp3",
      },
      release: 1.1,
      baseUrl: SALAMANDER_BASE_URL,
    }).toDestination();

    this.fallbackSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.005, decay: 0.1, sustain: 0.18, release: 0.35 },
    }).toDestination();
    this.fallbackSynth.volume.value = -12;
  }

  async #startContextIfNeeded() {
    if (this.tone.context.state !== "running") {
      await this.tone.start();
    }
  }

  #playNativeFallback(freq) {
    this.#ensureNativeContext();
    if (!this.nativeAudioCtx) return;

    const ctx = this.nativeAudioCtx;
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    const lowpass = ctx.createBiquadFilter();

    osc1.type = "triangle";
    osc2.type = "sine";
    osc1.frequency.value = freq;
    osc2.frequency.value = freq * 2;

    lowpass.type = "lowpass";
    lowpass.frequency.value = 3800;

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.13, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);

    osc1.connect(lowpass);
    osc2.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.45);
    osc2.stop(now + 0.45);
  }

  #ensureNativeContext() {
    if (this.nativeAudioCtx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    this.nativeAudioCtx = new AudioCtx();
  }

  #tickleNativeContext() {
    if (!this.nativeAudioCtx) return;
    const ctx = this.nativeAudioCtx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.00001, now);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.01);
  }
}

function midiToFrequency(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
