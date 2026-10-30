/**
 * Web Audio API riverboat sound synthesizer.
 * Zero external audio files required - 100% procedurally generated.
 */

export class AudioManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private bgmInterval: number | null = null;
  private bgmStep: number = 0;
  private masterGain: GainNode | null = null;

  constructor() {
    // Initialized on first user interaction
  }

  public initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.72;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.isMuted && this.bgmInterval) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    } else if (!this.isMuted) {
      this.startBgm();
    }
    return this.isMuted;
  }

  getMuted(): boolean {
    return this.isMuted;
  }

  playJump() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    const now = this.ctx.currentTime;
    // A small steam-whistle chirp, rather than a generic arcade blip.
    osc.frequency.setValueAtTime(330, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.16);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.16);

    osc.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(now);
    osc.stop(now + 0.12);
  }

  playStomp() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const now = this.ctx.currentTime;
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.18);

    gain.gain.setValueAtTime(0.16, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.18);

    osc.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  playKaizoBonk() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    // Resonant wooden "thud" with quick pitch drop
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    const now = this.ctx.currentTime;
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.08);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

    osc.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(now);
    osc.stop(now + 0.08);
  }

  playCoin() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(987.77, now); // B5
    osc1.frequency.setValueAtTime(1318.51, now + 0.08); // E6

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

    osc1.connect(gain);
    gain.connect(this.masterGain!);

    osc1.start(now);
    osc1.stop(now + 0.35);
  }

  playDeath() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    // A sad steam-whistle sigh — long descending blast with wobbling steam,
    // instead of a harsh falling sawtooth.
    const now = this.ctx.currentTime;
    const notes = [523.25, 466.16, 415.30, 392.00, 329.63];
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const vibrato = this.ctx!.createOscillator();
      const vibratoGain = this.ctx!.createGain();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      const startT = now + idx * 0.09;
      const dur = idx === notes.length - 1 ? 0.5 : 0.09;
      osc.frequency.setValueAtTime(freq, startT);
      vibrato.frequency.setValueAtTime(7, startT);
      vibratoGain.gain.setValueAtTime(freq * 0.008, startT);
      vibrato.connect(vibratoGain);
      vibratoGain.connect(osc.frequency);

      gain.gain.setValueAtTime(0.14, startT);
      gain.gain.exponentialRampToValueAtTime(0.005, startT + dur);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(startT);
      vibrato.start(startT);
      osc.stop(startT + dur);
      vibrato.stop(startT + dur);
    });
  }

  playMutationGlitch() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    const now = this.ctx.currentTime;
    // Two-note call: a low steam valve followed by a rising whistle.
    osc.frequency.setValueAtTime(92, now);
    osc.frequency.linearRampToValueAtTime(180, now + 0.12);
    osc.frequency.linearRampToValueAtTime(520, now + 0.32);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.32);

    osc.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(now);
    osc.stop(now + 0.32);
  }

  playVictory() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    // Short ragtime-style riverboat fanfare.
    const notes = [392.00, 523.25, 659.25, 523.25, 587.33, 783.99, 1046.50];
    const now = this.ctx.currentTime;

    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = idx < 2 ? 'triangle' : 'sine';
      const startT = now + idx * 0.1;
      osc.frequency.setValueAtTime(freq, startT);

      gain.gain.setValueAtTime(0.18, startT);
      gain.gain.exponentialRampToValueAtTime(0.01, startT + (idx === notes.length - 1 ? 0.6 : 0.12));

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(startT);
      osc.stop(startT + (idx === notes.length - 1 ? 0.6 : 0.12));
    });
  }

  startBgm() {
    if (this.isMuted || this.bgmInterval) return;
    this.initCtx();
    if (!this.ctx) return;

    const whistle = (freq: number, at: number, dur: number, vol = 0.055) => {
      const ctx = this.ctx!;
      const osc = ctx.createOscillator();
      const vib = ctx.createOscillator();
      const vibGain = ctx.createGain();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * 0.96, at);
      // Steam pressurizes upward into pitch, then holds with a gentle wobble.
      osc.frequency.exponentialRampToValueAtTime(freq, at + Math.min(0.05, dur / 3));
      vib.frequency.setValueAtTime(6.5, at);
      vibGain.gain.setValueAtTime(freq * 0.01, at);
      vib.connect(vibGain);
      vibGain.connect(osc.frequency);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.linearRampToValueAtTime(vol, at + Math.min(0.02, dur / 4));
      gain.gain.setValueAtTime(vol, at + dur * 0.7);
      gain.gain.exponentialRampToValueAtTime(0.001, at + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(at);
      vib.start(at);
      osc.stop(at + dur + 0.02);
      vib.stop(at + dur + 0.02);
    };

    const pah = (freq: number, at: number, dur: number, vol: number, type: OscillatorType = 'triangle') => {
      const ctx = this.ctx!;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, at);
      gain.gain.setValueAtTime(vol, at);
      gain.gain.exponentialRampToValueAtTime(0.001, at + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(at);
      osc.stop(at + dur);
    };

    /** The engine chug: a soft low thump that follows the paddle wheel. */
    const chug = (at: number, strong: boolean) => {
      const ctx = this.ctx!;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(strong ? 62 : 55, at);
      osc.frequency.exponentialRampToValueAtTime(38, at + 0.09);
      gain.gain.setValueAtTime(strong ? 0.075 : 0.045, at);
      gain.gain.exponentialRampToValueAtTime(0.001, at + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.11);
    };

    // One 8-beat bar at ~72 BPM (beat = 333ms): OOM-pah stride bass under a
    // signature steamboat whistle call. Public-domain cartoon-era idiom.
    // Whistle: two short calls, then a long answered blast.
    const beat = 0.3333;
    const bar = beat * 8;
    const G4 = 392.0, A4 = 440.0, C5 = 523.25, D5 = 587.33, E5 = 659.25, C6 = 1046.5;

    const scheduleBar = (base: number, phrase: number) => {
      for (let b = 0; b < 8; b++) {
        chug(base + b * beat, b % 2 === 0);
      }
      const alternator = phrase % 2;
      // stride bass: root on 1, 3, 5, 7; fifth on 2, 4, 6, 8
      const roots = alternator === 0 ? [98.0, 130.81] : [110.0, 146.83];
      for (let b = 0; b < 8; b++) {
        const at = base + b * beat;
        if (b % 2 === 0) pah(roots[(b / 2) % 2], at, 0.22, 0.06);
        else pah(roots[1] * 2, at, 0.1, 0.03, 'square'); // offbeat clip
      }
      if (alternator === 0) {
        // Phrase A: "tur-tur TUUUR - tu tur TUUUR" whistle call
        whistle(C5, base + 0 * beat, 0.32);
        whistle(E5, base + 1 * beat, 0.32);
        whistle(G4, base + 2 * beat, 1.0);
        whistle(C5, base + 4 * beat, 0.32);
        whistle(D5, base + 5 * beat, 0.32);
        whistle(E5, base + 6 * beat, 1.4);
      } else {
        // Phrase B: answer — one soft call, then the big blow-off.
        whistle(D5, base + 0 * beat, 0.24);
        whistle(C5, base + 1 * beat, 0.24);
        whistle(C6, base + 2 * beat, 0.9);
        whistle(A4, base + 5 * beat, 0.35);
        whistle(G4, base + 6 * beat, 1.5);
      }
    };

    let phrase = 0;
    let nextBar = this.ctx.currentTime + 0.12;
    this.bgmInterval = window.setInterval(() => {
      if (this.isMuted) return;
      if (!this.ctx) { this.ctx = null as any; return; }
      const ctx = this.ctx;
      while (nextBar < ctx.currentTime + 1.6) {
        scheduleBar(nextBar, phrase++);
        nextBar += bar;
      }
      // Keep the firebox lit: startBgm scheduled ahead, so rewind the cursor
      // if the tab throttled timers and fell behind.
      if (nextBar < ctx.currentTime) nextBar = ctx.currentTime + 0.05;
    }, 700);
  }
}
