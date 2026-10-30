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
    // Brass route-token chime: two stacked riverboat-bell tones. Deliberately
    // NOT the classic arcade two-step interval — this is a ship's bell.
    const bell = (freq: number, at: number, dur: number, vol: number) => {
      const osc = this.ctx!.createOscillator();
      const shimmer = this.ctx!.createOscillator();
      const shGain = this.ctx!.createGain();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, at);
      shimmer.type = 'sine';
      shimmer.frequency.setValueAtTime(freq * 2.76, at); // inharmonic bell overtone
      shGain.gain.setValueAtTime(vol * 0.25, at);
      shGain.gain.exponentialRampToValueAtTime(0.0001, at + dur * 0.6);
      shimmer.connect(shGain);
      gain.gain.setValueAtTime(vol, at);
      gain.gain.exponentialRampToValueAtTime(0.001, at + dur);
      osc.connect(gain);
      shimmer.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(at);
      shimmer.start(at);
      osc.stop(at + dur);
      shimmer.stop(at + dur);
    };
    bell(659.25, now, 0.22, 0.12);        // E5 strike
    bell(987.77, now + 0.09, 0.45, 0.13); // B5 resolve
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

    // Arrival fanfare: the Turkey in the Straw tag played on the calliope,
    // ending with a big low whistle blow-off.
    const seq: Array<[number, number]> = [
      [783.99, 0.11], [783.99, 0.11], [880, 0.11], [987.77, 0.22],
      [880, 0.11], [739.99, 0.11], [587.33, 0.33], [783.99, 0.6]
    ];
    const now = this.ctx.currentTime;
    let t = now;
    seq.forEach(([freq, dur], idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = idx < seq.length - 1 ? 'square' : 'sine';
      osc.frequency.setValueAtTime(freq * 0.985, t);
      osc.frequency.exponentialRampToValueAtTime(freq, t + 0.04);
      gain.gain.setValueAtTime(idx < seq.length - 1 ? 0.075 : 0.16, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + dur + 0.02);
      t += dur;
    });
  }

  startBgm() {
    if (this.isMuted || this.bgmInterval) return;
    this.initCtx();
    if (!this.ctx) return;

    const whistle = (freq: number, at: number, dur: number, vol = 0.05) => {
      const ctx = this.ctx!;
      const osc = ctx.createOscillator();
      const vib = ctx.createOscillator();
      const vibGain = ctx.createGain();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * 0.97, at);
      // Steam pressurizes upward into pitch, then holds with a gentle wobble.
      osc.frequency.exponentialRampToValueAtTime(freq, at + Math.min(0.04, dur / 4));
      vib.frequency.setValueAtTime(6, at);
      vibGain.gain.setValueAtTime(freq * 0.006, at);
      vib.connect(vibGain);
      vibGain.connect(osc.frequency);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.linearRampToValueAtTime(vol, at + Math.min(0.02, dur / 4));
      gain.gain.setValueAtTime(vol, at + dur * 0.65);
      gain.gain.exponentialRampToValueAtTime(0.001, at + dur);
      osc.connect(gain);
      gain.connect(this.masterGain ?? ctx.destination);
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
      gain.connect(this.masterGain ?? ctx.destination);
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
      gain.gain.setValueAtTime(strong ? 0.06 : 0.038, at);
      gain.gain.exponentialRampToValueAtTime(0.001, at + 0.1);
      osc.connect(gain);
      gain.connect(this.masterGain ?? ctx.destination);
      osc.start(at);
      osc.stop(at + 0.11);
    };

    // -*- Turkey in the Straw -*- (traditional, public domain): the reel that
    // Steamboat Willie's fiddle-and-whistle scene is built around, so the BGM
    // reads instantly as "Steamboat Willie".
    // A-part, key G, raised one octave to sit in the steam-whistle register.
    const eighth = 0.115;                       // ~130 BPM reel
    const bar = eighth * 8;
    const G5 = 783.99;
    const note = (semi: number) => G5 * Math.pow(2, semi / 12);
    // [relative-to-G5 semitones, duration in eighths]; negative 999 = rest
    const MELODY: Array<[number, number]> = [
      [3, 1], [0, 1], [-5, 1], [3, 1], [0, 2], [-5, 1], [-1, 1],
      [2, 1], [4, 1], [2, 1], [-5, 1], [2, 2], [0, 1], [4, 1],
      [7, 2], [7, 2], [7, 1], [-1, 1], [-5, 1], [4, 1],
      [7, 2], [-1, 2], [7, 2], [0, 3]
    ];

    let nextNote = this.ctx.currentTime + 0.12;
    let noteIdx = 0;
    let nextBar = nextNote;
    let barCount = 0;
    this.bgmInterval = window.setInterval(() => {
      if (this.isMuted || this.bgmInterval === null) return;
      const ctx = this.ctx;
      if (!ctx) return;
      const horizon = ctx.currentTime + 1.4;

      while (nextBar < horizon) {
        const root = barCount % 2 === 0 ? 98.0 : 130.81;
        for (let b = 0; b < 8; b++) {
          const at = nextBar + b * eighth;
          chug(at, b % 2 === 0);
          if (b % 2 === 0) pah(root, at, 0.2, 0.052);
          else pah(root * 2, at, 0.09, 0.028, 'square');
        }
        nextBar += bar;
        barCount++;
      }
      while (nextNote < horizon) {
        const [semi, beats] = MELODY[noteIdx % MELODY.length];
        const dur = beats * eighth;
        if (semi > -999 && noteIdx % MELODY.length !== 0) whistle(note(semi) * 0.993, nextNote, Math.min(dur * 0.92, 0.6));
        else if (semi > -999 && semi === 3) whistle(note(semi), nextNote, 0.18);
        nextNote += dur;
        noteIdx++;
      }
      if (nextNote < ctx.currentTime || nextBar < ctx.currentTime) {
        nextNote = ctx.currentTime + 0.05;
        nextBar = ctx.currentTime + 0.05;
      }
    }, 600);
  }
}
