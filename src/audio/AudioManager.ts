import { GameSettings } from '../core/Settings';
import {
  SOUND_CATALOG,
  SoundId,
  SoundDef,
  listPlaceholders,
} from './SoundCatalog';

/**
 * Central audio system. Uses Web Audio API.
 * Placeholder mode synthesizes tones; file mode loads from public/ paths.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;

  private unlocked = false;
  private masterVol = 0.8;
  private sfxVol = 0.7;
  private musicVol = 0.5;
  private muted = false;

  private lastPlayed = new Map<SoundId, number>();
  private buffers = new Map<SoundId, AudioBuffer>();
  private musicSource: AudioBufferSourceNode | OscillatorNode | null = null;
  private musicOscStop: (() => void) | null = null;
  private currentMusic: SoundId | null = null;
  private musicDucked = false;

  /** Call once from UI gesture (menu click) to unlock autoplay */
  async unlock() {
    if (this.unlocked) return;
    this.ensureContext();
    if (this.ctx?.state === 'suspended') {
      await this.ctx.resume();
    }
    this.unlocked = true;
  }

  applySettings(s: GameSettings) {
    this.masterVol = s.masterVolume;
    this.sfxVol = s.sfxVolume;
    this.musicVol = s.musicVolume;
    this.updateGains();
  }

  setMuted(m: boolean) {
    this.muted = m;
    this.updateGains();
  }

  play(id: SoundId) {
    const def = SOUND_CATALOG[id];
    if (!def || def.bus !== 'sfx') return;
    if (!this.unlocked) return;

    const now = performance.now();
    const last = this.lastPlayed.get(id) ?? 0;
    if (def.throttleMs && now - last < def.throttleMs) return;
    this.lastPlayed.set(id, now);

    this.ensureContext();
    if (!this.ctx || !this.sfxGain) return;

    if (def.mode === 'file' && this.buffers.has(id)) {
      this.playBuffer(id, def, this.sfxGain);
      return;
    }
    this.playPlaceholder(def, this.sfxGain);
  }

  playMusic(id: SoundId) {
    const def = SOUND_CATALOG[id];
    if (!def || def.bus !== 'music') return;
    if (this.currentMusic === id) return;

    this.stopMusic();
    this.currentMusic = id;
    if (!this.unlocked) return;

    this.ensureContext();
    if (!this.ctx || !this.musicGain) return;

    if (def.mode === 'file' && this.buffers.has(id)) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.buffers.get(id)!;
      src.loop = !!def.loop;
      src.connect(this.musicGain);
      src.start();
      this.musicSource = src;
      return;
    }

    // Placeholder: soft looping drone via oscillator
    this.startPlaceholderMusic(def);
  }

  stopMusic() {
    if (this.musicOscStop) {
      this.musicOscStop();
      this.musicOscStop = null;
    }
    if (this.musicSource) {
      try {
        (this.musicSource as AudioBufferSourceNode).stop?.();
      } catch {
        /* already stopped */
      }
      try {
        this.musicSource.disconnect();
      } catch {
        /* */
      }
      this.musicSource = null;
    }
    this.currentMusic = null;
  }

  /** Soften music while paused */
  setMusicDucked(ducked: boolean) {
    this.musicDucked = ducked;
    this.updateGains();
  }

  /** Try loading any catalog entries marked mode:'file' */
  async preloadFiles() {
    this.ensureContext();
    if (!this.ctx) return;
    for (const def of Object.values(SOUND_CATALOG)) {
      if (def.mode !== 'file') continue;
      try {
        const res = await fetch('/' + def.file);
        if (!res.ok) continue;
        const arr = await res.arrayBuffer();
        const buf = await this.ctx.decodeAudioData(arr.slice(0));
        this.buffers.set(def.id, buf);
      } catch (e) {
        console.warn('[audio] failed to load', def.file, e);
      }
    }
  }

  /** Debug: how many placeholders remain */
  placeholderStatus() {
    const left = listPlaceholders();
    return {
      total: Object.keys(SOUND_CATALOG).length,
      placeholders: left.length,
      ids: left.map((s) => s.id),
    };
  }

  // ── Internals ──────────────────────────────────────────────

  private ensureContext() {
    if (this.ctx) return;
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.masterGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();
    this.sfxGain.connect(this.masterGain);
    this.musicGain.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);
    this.updateGains();
  }

  private updateGains() {
    if (!this.masterGain || !this.sfxGain || !this.musicGain) return;
    const m = this.muted ? 0 : this.masterVol;
    this.masterGain.gain.value = m;
    this.sfxGain.gain.value = this.sfxVol;
    this.musicGain.gain.value = this.musicVol * (this.musicDucked ? 0.35 : 1);
  }

  private playBuffer(id: SoundId, def: SoundDef, dest: GainNode) {
    if (!this.ctx) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffers.get(id)!;
    const rate = 1 + (Math.random() * 2 - 1) * (def.pitchVariance ?? 0);
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = 1;
    src.connect(g);
    g.connect(dest);
    src.start();
  }

  private playPlaceholder(def: SoundDef, dest: GainNode) {
    if (!this.ctx) return;
    const p = def.placeholder;
    const t0 = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    const base = (p.gain ?? 0.15) * (0.9 + Math.random() * 0.2);
    gain.gain.setValueAtTime(base, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + p.duration);
    gain.connect(dest);

    const variance = def.pitchVariance ?? 0;
    const pitchMul = 1 + (Math.random() * 2 - 1) * variance;

    if (p.type === 'noise') {
      const bufferSize = Math.floor(this.ctx.sampleRate * p.duration);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 800 + Math.random() * 400;
      src.connect(filter);
      filter.connect(gain);
      src.start(t0);
      src.stop(t0 + p.duration);
      return;
    }

    const osc = this.ctx.createOscillator();
    osc.type = p.type;
    osc.frequency.setValueAtTime(p.freq * pitchMul, t0);
    if (p.freqEnd != null) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, p.freqEnd * pitchMul),
        t0 + p.duration
      );
    }
    osc.connect(gain);
    osc.start(t0);
    osc.stop(t0 + p.duration);

    if (p.freq2 != null) {
      const osc2 = this.ctx.createOscillator();
      const g2 = this.ctx.createGain();
      g2.gain.setValueAtTime(base * 0.8, t0 + p.duration * 0.35);
      g2.gain.exponentialRampToValueAtTime(0.001, t0 + p.duration);
      osc2.type = p.type;
      osc2.frequency.value = p.freq2 * pitchMul;
      osc2.connect(g2);
      g2.connect(dest);
      osc2.start(t0 + p.duration * 0.35);
      osc2.stop(t0 + p.duration);
    }
  }

  private startPlaceholderMusic(def: SoundDef) {
    if (!this.ctx || !this.musicGain) return;
    const p = def.placeholder;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = p.type === 'noise' ? 'sine' : p.type;
    osc.frequency.value = p.freq;
    gain.gain.value = p.gain ?? 0.04;
    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start();
    this.musicSource = osc;
    this.musicOscStop = () => {
      try {
        osc.stop();
        osc.disconnect();
        gain.disconnect();
      } catch {
        /* */
      }
    };
  }
}

/** Shared singleton for the app */
export const audio = new AudioManager();
