import { MUSIC, noteFrequency, SOUNDS, type Voice } from '@/config/audio';

export interface Volumes {
  master: number;
  sfx: number;
  music: number;
}

/**
 * All audio, synthesised live with the Web Audio API. The context is only created after the
 * first user gesture (browsers require it), so every method is safe to call before then.
 */
export class Sound {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private music!: GainNode;
  private noise!: AudioBuffer;
  private volumes: Volumes = { master: 0.7, sfx: 0.8, music: 0.5 };
  private nextNote = 0;
  /** Limits how often the same sound may retrigger, so bursts of events do not stack into noise. */
  private lastPlayed = new Map<string, number>();

  /** Call from a click or key press: creates (or resumes) the audio context. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const ctx = new AudioContext();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.sfx = ctx.createGain();
      this.music = ctx.createGain();
      // Music runs through a feedback echo for a soft, roomy tail.
      const echo = ctx.createDelay(1);
      const feedback = ctx.createGain();
      echo.delayTime.value = MUSIC.echoSeconds;
      feedback.gain.value = MUSIC.echoFeedback;
      this.music.connect(echo).connect(feedback).connect(echo);
      echo.connect(this.master);
      this.music.connect(this.master);
      this.sfx.connect(this.master);
      this.master.connect(ctx.destination);
      this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.setVolumes(this.volumes);
    } catch {
      this.ctx = null;
    }
  }

  setVolumes(volumes: Volumes): void {
    this.volumes = volumes;
    if (!this.ctx) return;
    this.master.gain.value = volumes.master;
    this.sfx.gain.value = volumes.sfx;
    this.music.gain.value = volumes.music;
  }

  private voice(v: Voice, out: AudioNode, start: number, pitch: number, loudness: number): void {
    const ctx = this.ctx!;
    const t0 = start + (v.at ?? 0);
    const gain = ctx.createGain();
    const attack = v.attack ?? 0.004;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(v.gain * loudness, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + v.for);
    let source: AudioScheduledSourceNode;
    if (v.wave === 'noise') {
      const node = ctx.createBufferSource();
      node.buffer = this.noise;
      node.loop = true;
      source = node;
    } else {
      const node = ctx.createOscillator();
      node.type = v.wave;
      node.frequency.setValueAtTime(v.freq[0] * pitch, t0);
      if (v.freq[1] !== v.freq[0]) node.frequency.exponentialRampToValueAtTime(v.freq[1] * pitch, t0 + v.for);
      source = node;
    }
    let chain: AudioNode = source;
    if (v.lowpass) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = v.lowpass;
      chain = chain.connect(filter);
    }
    chain.connect(gain).connect(out);
    source.start(t0);
    source.stop(t0 + v.for + 0.05);
  }

  /** Play a named sound. `pitch` multiplies its frequencies; `gap` is the minimum time before it may repeat. */
  play(name: string, pitch = 1, loudness = 1, gap = 0.03): void {
    const ctx = this.ctx;
    const recipe = SOUNDS[name];
    if (!ctx || !recipe || ctx.state !== 'running' || this.volumes.sfx <= 0) return;
    const now = ctx.currentTime;
    if (now - (this.lastPlayed.get(name) ?? -1) < gap) return;
    this.lastPlayed.set(name, now);
    for (const v of recipe) this.voice(v, this.sfx, now, pitch, loudness);
  }

  /** Advance the music. Call every frame; `night` is 0..1. */
  update(night: number): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || this.volumes.music <= 0) return;
    const now = ctx.currentTime;
    if (now < this.nextNote) return;
    this.nextNote = now + MUSIC.gap[0] + Math.random() * (MUSIC.gap[1] - MUSIC.gap[0]);
    const scale = night > 0.5 ? MUSIC.night : MUSIC.day;
    const freq = noteFrequency(scale[Math.floor(Math.random() * scale.length)]);
    this.voice({ wave: 'sine', freq: [freq, freq], for: MUSIC.noteLength, gain: MUSIC.gain, attack: 0.25 }, this.music, now, 1, 1);
    this.voice({ wave: 'triangle', freq: [freq / 2, freq / 2], for: MUSIC.noteLength * 0.8, gain: MUSIC.gain * 0.45, attack: 0.4 }, this.music, now, 1, 1);

    // The world has a voice too: birdsong by day, crickets after dark.
    if (night < 0.4 && Math.random() < MUSIC.birdChance) {
      const base = 2400 + Math.random() * 1400;
      for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) this.voice({ wave: 'sine', freq: [base, base * (1.1 + Math.random() * 0.25)], for: 0.07, at: 0.4 + i * 0.11, gain: 0.03 }, this.sfx, now, 1, 1);
    } else if (night > 0.6 && Math.random() < MUSIC.cricketChance) {
      for (let i = 0; i < 5; i++) this.voice({ wave: 'square', freq: [4200, 4200], for: 0.03, at: 0.3 + i * 0.07, gain: 0.006, lowpass: 5200 }, this.sfx, now, 1, 1);
    }
  }
}
