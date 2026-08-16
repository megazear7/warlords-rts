const PROFILE_KEY = 'warlords_profile';

export interface PlayerProfile {
  displayName: string;
  preferredNation: 'rome' | 'persia' | 'egypt' | 'gaul';
  gamesPlayed: number;
  victories: number;
  defeats: number;
  totalPlayTime: number; // seconds
  createdAt: number;
}

export const DEFAULT_PROFILE: PlayerProfile = {
  displayName: 'Commander',
  preferredNation: 'rome',
  gamesPlayed: 0,
  victories: 0,
  defeats: 0,
  totalPlayTime: 0,
  createdAt: Date.now(),
};

export class ProfileStore {
  static load(): PlayerProfile {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      if (!raw) return { ...DEFAULT_PROFILE, createdAt: Date.now() };
      return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULT_PROFILE, createdAt: Date.now() };
    }
  }

  static save(profile: PlayerProfile) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  }

  static recordGameEnd(won: boolean, playTime: number) {
    const p = this.load();
    p.gamesPlayed += 1;
    if (won) p.victories += 1;
    else p.defeats += 1;
    p.totalPlayTime += playTime;
    this.save(p);
  }
}
