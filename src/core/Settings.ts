const SETTINGS_KEY = 'warlords_settings';

export interface GameSettings {
  masterVolume: number; // 0-1
  musicVolume: number;
  sfxVolume: number;
  graphicsQuality: 'low' | 'medium' | 'high';
  showFPS: boolean;
  cameraPanSpeed: number;
  cameraZoomSpeed: number;
  edgeScroll: boolean;
  confirmActions: boolean;
}

export const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 0.8,
  musicVolume: 0.5,
  sfxVolume: 0.7,
  graphicsQuality: 'high',
  showFPS: false,
  cameraPanSpeed: 1.0,
  cameraZoomSpeed: 1.0,
  edgeScroll: true,
  confirmActions: false,
};

export class SettingsStore {
  static load(): GameSettings {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  static save(settings: GameSettings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }
}
