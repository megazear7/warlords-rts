/**
 * Warlords sound registry.
 *
 * PLACEHOLDER POLICY
 * ─────────────────
 * Every entry starts as `mode: 'placeholder'` and is synthesized with Web Audio
 * (beeps / noise bursts). To replace with real audio later:
 *
 * 1. Drop a file at the path in `file` (under public/)
 * 2. Set `mode: 'file'` on that entry
 * 3. Keep the same `id` — all call sites stay unchanged
 *
 * See also: docs/AUDIO_PLACEHOLDERS.md
 */

export type SoundId =
  | 'ui_click'
  | 'ui_confirm'
  | 'ui_error'
  | 'ui_toast'
  | 'order_move'
  | 'order_attack'
  | 'order_gather'
  | 'combat_hit'
  | 'combat_death'
  | 'siege_hit'
  | 'build_place'
  | 'train_complete'
  | 'research_complete'
  | 'epoch_advance'
  | 'city_capture'
  | 'alert_attrition'
  | 'victory'
  | 'defeat'
  | 'music_menu'
  | 'music_gameplay'
  | 'music_victory'
  | 'music_defeat';

export type SoundBus = 'sfx' | 'music';

export type SoundMode = 'placeholder' | 'file';

export interface PlaceholderSynth {
  /** Oscillator type for tonal cues */
  type: OscillatorType | 'noise';
  freq: number;
  freqEnd?: number;
  duration: number;
  gain?: number;
  /** Second tone for simple two-note stingers */
  freq2?: number;
}

export interface SoundDef {
  id: SoundId;
  bus: SoundBus;
  /** Intended real asset path relative to public/ */
  file: string;
  mode: SoundMode;
  /** Min ms between plays of this id (anti-spam) */
  throttleMs?: number;
  /** Random pitch variance for placeholders / files */
  pitchVariance?: number;
  placeholder: PlaceholderSynth;
  /** Music only: loop */
  loop?: boolean;
  notes?: string;
}

export const SOUND_CATALOG: Record<SoundId, SoundDef> = {
  ui_click: {
    id: 'ui_click',
    bus: 'sfx',
    file: 'audio/sfx/ui_click.ogg',
    mode: 'placeholder',
    throttleMs: 30,
    placeholder: { type: 'sine', freq: 880, duration: 0.04, gain: 0.15 },
  },
  ui_confirm: {
    id: 'ui_confirm',
    bus: 'sfx',
    file: 'audio/sfx/ui_confirm.ogg',
    mode: 'placeholder',
    placeholder: { type: 'sine', freq: 520, freq2: 780, duration: 0.12, gain: 0.18 },
  },
  ui_error: {
    id: 'ui_error',
    bus: 'sfx',
    file: 'audio/sfx/ui_error.ogg',
    mode: 'placeholder',
    placeholder: { type: 'square', freq: 200, freqEnd: 120, duration: 0.15, gain: 0.12 },
  },
  ui_toast: {
    id: 'ui_toast',
    bus: 'sfx',
    file: 'audio/sfx/ui_toast.ogg',
    mode: 'placeholder',
    throttleMs: 200,
    placeholder: { type: 'sine', freq: 660, duration: 0.06, gain: 0.1 },
  },
  order_move: {
    id: 'order_move',
    bus: 'sfx',
    file: 'audio/sfx/order_move.ogg',
    mode: 'placeholder',
    throttleMs: 80,
    placeholder: { type: 'triangle', freq: 400, freqEnd: 320, duration: 0.08, gain: 0.1 },
  },
  order_attack: {
    id: 'order_attack',
    bus: 'sfx',
    file: 'audio/sfx/order_attack.ogg',
    mode: 'placeholder',
    throttleMs: 80,
    placeholder: { type: 'sawtooth', freq: 180, freqEnd: 90, duration: 0.1, gain: 0.12 },
  },
  order_gather: {
    id: 'order_gather',
    bus: 'sfx',
    file: 'audio/sfx/order_gather.ogg',
    mode: 'placeholder',
    throttleMs: 100,
    placeholder: { type: 'triangle', freq: 300, duration: 0.07, gain: 0.1 },
  },
  combat_hit: {
    id: 'combat_hit',
    bus: 'sfx',
    file: 'audio/sfx/combat_hit.ogg',
    mode: 'placeholder',
    throttleMs: 70,
    pitchVariance: 0.08,
    placeholder: { type: 'noise', freq: 0, duration: 0.05, gain: 0.2 },
    notes: 'Replace with layered metal/flesh hits; keep throttle',
  },
  combat_death: {
    id: 'combat_death',
    bus: 'sfx',
    file: 'audio/sfx/combat_death.ogg',
    mode: 'placeholder',
    throttleMs: 50,
    pitchVariance: 0.1,
    placeholder: { type: 'sawtooth', freq: 140, freqEnd: 40, duration: 0.25, gain: 0.15 },
  },
  siege_hit: {
    id: 'siege_hit',
    bus: 'sfx',
    file: 'audio/sfx/siege_hit.ogg',
    mode: 'placeholder',
    throttleMs: 100,
    pitchVariance: 0.05,
    placeholder: { type: 'noise', freq: 0, duration: 0.08, gain: 0.22 },
  },
  build_place: {
    id: 'build_place',
    bus: 'sfx',
    file: 'audio/sfx/build_place.ogg',
    mode: 'placeholder',
    placeholder: { type: 'triangle', freq: 220, freq2: 330, duration: 0.15, gain: 0.14 },
  },
  train_complete: {
    id: 'train_complete',
    bus: 'sfx',
    file: 'audio/sfx/train_complete.ogg',
    mode: 'placeholder',
    placeholder: { type: 'sine', freq: 440, freq2: 660, duration: 0.18, gain: 0.16 },
  },
  research_complete: {
    id: 'research_complete',
    bus: 'sfx',
    file: 'audio/sfx/research_complete.ogg',
    mode: 'placeholder',
    placeholder: { type: 'sine', freq: 500, freq2: 750, duration: 0.22, gain: 0.16 },
  },
  epoch_advance: {
    id: 'epoch_advance',
    bus: 'sfx',
    file: 'audio/sfx/epoch_advance.ogg',
    mode: 'placeholder',
    placeholder: { type: 'sine', freq: 360, freq2: 720, duration: 0.35, gain: 0.2 },
    notes: 'Important moment — use a short fanfare when replacing',
  },
  city_capture: {
    id: 'city_capture',
    bus: 'sfx',
    file: 'audio/sfx/city_capture.ogg',
    mode: 'placeholder',
    placeholder: { type: 'square', freq: 300, freq2: 450, duration: 0.3, gain: 0.18 },
  },
  alert_attrition: {
    id: 'alert_attrition',
    bus: 'sfx',
    file: 'audio/sfx/alert_attrition.ogg',
    mode: 'placeholder',
    throttleMs: 4000,
    placeholder: { type: 'sine', freq: 240, freqEnd: 180, duration: 0.2, gain: 0.1 },
  },
  victory: {
    id: 'victory',
    bus: 'sfx',
    file: 'audio/sfx/victory.ogg',
    mode: 'placeholder',
    placeholder: { type: 'sine', freq: 523, freq2: 784, duration: 0.5, gain: 0.22 },
  },
  defeat: {
    id: 'defeat',
    bus: 'sfx',
    file: 'audio/sfx/defeat.ogg',
    mode: 'placeholder',
    placeholder: { type: 'sawtooth', freq: 200, freqEnd: 80, duration: 0.6, gain: 0.18 },
  },
  music_menu: {
    id: 'music_menu',
    bus: 'music',
    file: 'audio/music/menu.ogg',
    mode: 'placeholder',
    loop: true,
    placeholder: { type: 'sine', freq: 110, duration: 2, gain: 0.04 },
    notes: 'Placeholder is a soft low drone; replace with real loop',
  },
  music_gameplay: {
    id: 'music_gameplay',
    bus: 'music',
    file: 'audio/music/gameplay.ogg',
    mode: 'placeholder',
    loop: true,
    placeholder: { type: 'triangle', freq: 98, duration: 2, gain: 0.035 },
    notes: 'Placeholder drone; replace with exploration/combat bed',
  },
  music_victory: {
    id: 'music_victory',
    bus: 'music',
    file: 'audio/music/victory.ogg',
    mode: 'placeholder',
    loop: false,
    placeholder: { type: 'sine', freq: 392, freq2: 587, duration: 1.2, gain: 0.12 },
  },
  music_defeat: {
    id: 'music_defeat',
    bus: 'music',
    file: 'audio/music/defeat.ogg',
    mode: 'placeholder',
    loop: false,
    placeholder: { type: 'triangle', freq: 130, freqEnd: 65, duration: 1.5, gain: 0.1 },
  },
};

/** List every placeholder still needing a real file */
export function listPlaceholders(): SoundDef[] {
  return Object.values(SOUND_CATALOG).filter((s) => s.mode === 'placeholder');
}

export function listFileReady(): SoundDef[] {
  return Object.values(SOUND_CATALOG).filter((s) => s.mode === 'file');
}
