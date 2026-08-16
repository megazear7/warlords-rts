import { SaveSystem, SAVE_SLOTS } from '../core/SaveSystem';
import { SettingsStore, GameSettings, DEFAULT_SETTINGS } from '../core/Settings';
import { ProfileStore, PlayerProfile } from '../core/Profile';

export type UIScreen =
  | 'main'
  | 'load'
  | 'save'
  | 'settings'
  | 'profile'
  | 'pause'
  | 'victory'
  | 'defeat'
  | 'none'; // in-game HUD only

export interface UICallbacks {
  onNewGame: () => void;
  onLoadSlot: (slot: number) => void;
  onSaveSlot: (slot: number) => void;
  onResume: () => void;
  onQuitToMenu: () => void;
  onSettingsChanged: (s: GameSettings) => void;
}

export class UIManager {
  private root: HTMLElement;
  private screen: UIScreen = 'main';
  private callbacks: UICallbacks;
  private settings: GameSettings;
  private profile: PlayerProfile;
  private toastEl: HTMLElement;
  private toastTimer = 0;

  constructor(callbacks: UICallbacks) {
    this.callbacks = callbacks;
    this.settings = SettingsStore.load();
    this.profile = ProfileStore.load();

    this.root = document.createElement('div');
    this.root.id = 'ui-overlay';
    document.getElementById('app')?.appendChild(this.root);

    this.toastEl = document.createElement('div');
    this.toastEl.id = 'toast';
    document.getElementById('app')?.appendChild(this.toastEl);

    this.show('main');
  }

  get currentScreen() {
    return this.screen;
  }

  getSettings() {
    return this.settings;
  }

  getProfile() {
    return this.profile;
  }

  show(screen: UIScreen) {
    this.screen = screen;
    this.root.innerHTML = '';
    this.root.className = screen === 'none' ? 'ui-hidden' : 'ui-visible';

    if (screen === 'none') return;

    switch (screen) {
      case 'main':
        this.renderMainMenu();
        break;
      case 'load':
        this.renderLoadMenu();
        break;
      case 'save':
        this.renderSaveMenu();
        break;
      case 'settings':
        this.renderSettings();
        break;
      case 'profile':
        this.renderProfile();
        break;
      case 'pause':
        this.renderPauseMenu();
        break;
      case 'victory':
        this.renderEndScreen(true);
        break;
      case 'defeat':
        this.renderEndScreen(false);
        break;
    }
  }

  showToast(message: string, durationMs = 2200) {
    this.toastEl.textContent = message;
    this.toastEl.className = 'toast-show';
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.toastEl.className = '';
    }, durationMs);
  }

  // ── Screens ────────────────────────────────────────────────

  private renderMainMenu() {
    const hasSaves = SaveSystem.hasAnySave();
    this.root.innerHTML = `
      <div class="menu-panel main-menu">
        <div class="menu-brand">
          <h1>WARLORDS</h1>
          <p class="tagline">A Rise of Nations–inspired RTS</p>
        </div>
        <div class="menu-buttons">
          <button data-action="new">New Game</button>
          <button data-action="load" ${hasSaves ? '' : 'disabled'}>Load Game</button>
          <button data-action="settings">Settings</button>
          <button data-action="profile">Profile</button>
        </div>
        <div class="menu-footer">Commander: <strong>${escapeHtml(this.profile.displayName)}</strong></div>
      </div>
    `;

    this.bind(this.root, {
      new: () => this.callbacks.onNewGame(),
      load: () => this.show('load'),
      settings: () => this.show('settings'),
      profile: () => this.show('profile'),
    });
  }

  private renderLoadMenu() {
    const slots = SaveSystem.listSlots();
    const rows = slots
      .map((s) => {
        if (!s.exists) {
          return `<button class="slot-btn empty" disabled>Slot ${s.slot} — Empty</button>`;
        }
        const date = new Date(s.timestamp).toLocaleString();
        const mins = Math.floor(s.playTime / 60);
        return `<button class="slot-btn" data-action="load-${s.slot}">
          Slot ${s.slot}: ${escapeHtml(s.slotName)}<br/>
          <span class="slot-meta">${date} · ${mins}m play · 🍞 ${Math.floor(s.resources?.food ?? 0)}</span>
        </button>`;
      })
      .join('');

    this.root.innerHTML = `
      <div class="menu-panel">
        <h2>Load Game</h2>
        <div class="slot-list">${rows}</div>
        <button data-action="back" class="secondary">Back</button>
      </div>
    `;

    const actions: Record<string, () => void> = {
      back: () => this.show(this.wasPaused() ? 'pause' : 'main'),
    };
    for (let i = 1; i <= SAVE_SLOTS; i++) {
      actions[`load-${i}`] = () => this.callbacks.onLoadSlot(i);
    }
    this.bind(this.root, actions);
  }

  private renderSaveMenu() {
    const slots = SaveSystem.listSlots();
    const rows = slots
      .map((s) => {
        const label = s.exists
          ? `Slot ${s.slot}: ${escapeHtml(s.slotName)} (overwrite)`
          : `Slot ${s.slot}: Empty`;
        return `<button class="slot-btn" data-action="save-${s.slot}">${label}</button>`;
      })
      .join('');

    this.root.innerHTML = `
      <div class="menu-panel">
        <h2>Save Game</h2>
        <div class="slot-list">${rows}</div>
        <button data-action="back" class="secondary">Back</button>
      </div>
    `;

    const actions: Record<string, () => void> = {
      back: () => this.show('pause'),
    };
    for (let i = 1; i <= SAVE_SLOTS; i++) {
      actions[`save-${i}`] = () => this.callbacks.onSaveSlot(i);
    }
    this.bind(this.root, actions);
  }

  private renderSettings() {
    const s = this.settings;
    this.root.innerHTML = `
      <div class="menu-panel settings-panel">
        <h2>Settings</h2>
        <label>Master Volume <input type="range" min="0" max="100" value="${s.masterVolume * 100}" data-setting="masterVolume" /></label>
        <label>Music Volume <input type="range" min="0" max="100" value="${s.musicVolume * 100}" data-setting="musicVolume" /></label>
        <label>SFX Volume <input type="range" min="0" max="100" value="${s.sfxVolume * 100}" data-setting="sfxVolume" /></label>
        <label>Graphics
          <select data-setting="graphicsQuality">
            <option value="low" ${s.graphicsQuality === 'low' ? 'selected' : ''}>Low</option>
            <option value="medium" ${s.graphicsQuality === 'medium' ? 'selected' : ''}>Medium</option>
            <option value="high" ${s.graphicsQuality === 'high' ? 'selected' : ''}>High</option>
          </select>
        </label>
        <label>Camera Pan Speed <input type="range" min="50" max="200" value="${s.cameraPanSpeed * 100}" data-setting="cameraPanSpeed" /></label>
        <label>Camera Zoom Speed <input type="range" min="50" max="200" value="${s.cameraZoomSpeed * 100}" data-setting="cameraZoomSpeed" /></label>
        <label class="checkbox"><input type="checkbox" data-setting="edgeScroll" ${s.edgeScroll ? 'checked' : ''}/> Edge scroll</label>
        <label class="checkbox"><input type="checkbox" data-setting="showFPS" ${s.showFPS ? 'checked' : ''}/> Show FPS</label>
        <label class="checkbox"><input type="checkbox" data-setting="confirmActions" ${s.confirmActions ? 'checked' : ''}/> Confirm destructive actions</label>
        <div class="menu-row">
          <button data-action="reset" class="secondary">Reset Defaults</button>
          <button data-action="back">Back</button>
        </div>
      </div>
    `;

    this.root.querySelectorAll('[data-setting]').forEach((el) => {
      el.addEventListener('change', () => this.readSettingsFromDOM());
      el.addEventListener('input', () => this.readSettingsFromDOM());
    });

    this.bind(this.root, {
      back: () => {
        SettingsStore.save(this.settings);
        this.callbacks.onSettingsChanged(this.settings);
        this.show(this.wasPaused() ? 'pause' : 'main');
      },
      reset: () => {
        this.settings = { ...DEFAULT_SETTINGS };
        SettingsStore.save(this.settings);
        this.renderSettings();
        this.showToast('Settings reset');
      },
    });
  }

  private readSettingsFromDOM() {
    const panel = this.root;
    const num = (name: string) => {
      const el = panel.querySelector(`[data-setting="${name}"]`) as HTMLInputElement | null;
      return el ? Number(el.value) / 100 : 0;
    };
    const check = (name: string) => {
      const el = panel.querySelector(`[data-setting="${name}"]`) as HTMLInputElement | null;
      return el?.checked ?? false;
    };
    const sel = (name: string) => {
      const el = panel.querySelector(`[data-setting="${name}"]`) as HTMLSelectElement | null;
      return el?.value ?? 'high';
    };

    this.settings = {
      masterVolume: num('masterVolume'),
      musicVolume: num('musicVolume'),
      sfxVolume: num('sfxVolume'),
      graphicsQuality: sel('graphicsQuality') as GameSettings['graphicsQuality'],
      showFPS: check('showFPS'),
      cameraPanSpeed: num('cameraPanSpeed') || 1,
      cameraZoomSpeed: num('cameraZoomSpeed') || 1,
      edgeScroll: check('edgeScroll'),
      confirmActions: check('confirmActions'),
    };
  }

  private renderProfile() {
    const p = this.profile;
    const hours = (p.totalPlayTime / 3600).toFixed(1);
    this.root.innerHTML = `
      <div class="menu-panel">
        <h2>Profile</h2>
        <label>Display Name
          <input type="text" id="profile-name" maxlength="24" value="${escapeHtml(p.displayName)}" />
        </label>
        <label>Preferred Nation
          <select id="profile-nation">
            <option value="rome" ${p.preferredNation === 'rome' ? 'selected' : ''}>Rome</option>
            <option value="persia" ${p.preferredNation === 'persia' ? 'selected' : ''}>Persia</option>
            <option value="egypt" ${p.preferredNation === 'egypt' ? 'selected' : ''}>Egypt</option>
            <option value="gaul" ${p.preferredNation === 'gaul' ? 'selected' : ''}>Gauls</option>
          </select>
        </label>
        <div class="profile-stats">
          <div>Games played: <strong>${p.gamesPlayed}</strong></div>
          <div>Victories: <strong>${p.victories}</strong></div>
          <div>Defeats: <strong>${p.defeats}</strong></div>
          <div>Total play time: <strong>${hours}h</strong></div>
        </div>
        <div class="menu-row">
          <button data-action="save">Save Profile</button>
          <button data-action="back" class="secondary">Back</button>
        </div>
      </div>
    `;

    this.bind(this.root, {
      save: () => {
        const nameEl = document.getElementById('profile-name') as HTMLInputElement;
        const nationEl = document.getElementById('profile-nation') as HTMLSelectElement;
        this.profile.displayName = (nameEl.value || 'Commander').trim().slice(0, 24);
        this.profile.preferredNation = nationEl.value as PlayerProfile['preferredNation'];
        ProfileStore.save(this.profile);
        this.showToast('Profile saved');
        this.renderProfile();
      },
      back: () => this.show(this.wasPaused() ? 'pause' : 'main'),
    });
  }

  private renderPauseMenu() {
    this.root.innerHTML = `
      <div class="menu-panel">
        <h2>Paused</h2>
        <div class="menu-buttons">
          <button data-action="resume">Resume</button>
          <button data-action="save">Save Game</button>
          <button data-action="load">Load Game</button>
          <button data-action="settings">Settings</button>
          <button data-action="quit" class="danger">Quit to Menu</button>
        </div>
      </div>
    `;

    this.bind(this.root, {
      resume: () => this.callbacks.onResume(),
      save: () => this.show('save'),
      load: () => this.show('load'),
      settings: () => this.show('settings'),
      quit: () => this.callbacks.onQuitToMenu(),
    });
  }

  private renderEndScreen(victory: boolean) {
    this.root.innerHTML = `
      <div class="menu-panel end-screen">
        <h1 class="${victory ? 'victory' : 'defeat'}">${victory ? 'Victory' : 'Defeat'}</h1>
        <p>${victory ? 'The enemy has been vanquished.' : 'Your cities have fallen.'}</p>
        <div class="menu-buttons">
          <button data-action="new">New Game</button>
          <button data-action="menu" class="secondary">Main Menu</button>
        </div>
      </div>
    `;

    this.bind(this.root, {
      new: () => this.callbacks.onNewGame(),
      menu: () => this.callbacks.onQuitToMenu(),
    });
  }

  private wasPaused(): boolean {
    // Heuristic: if we navigated from pause context — Game tracks mode; UI uses simple back targets
    return false;
  }

  private bind(root: HTMLElement, actions: Record<string, () => void>) {
    root.querySelectorAll('[data-action]').forEach((btn) => {
      const key = (btn as HTMLElement).dataset.action!;
      btn.addEventListener('click', () => actions[key]?.());
    });
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"');
}
