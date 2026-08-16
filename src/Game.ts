import { Simulation } from './core/Simulation';
import { Renderer } from './renderer/Renderer';
import { InputManager } from './renderer/InputManager';
import { Hud } from './ui/Hud';
import { UIManager } from './ui/UIManager';
import { SaveSystem } from './core/SaveSystem';
import { ProfileStore } from './core/Profile';
import { GameSettings } from './core/Settings';
import { NationId } from './data/nations';

export type GameMode = 'menu' | 'playing' | 'paused' | 'ended';

export class Game {
  readonly simulation: Simulation;
  readonly renderer: Renderer;
  readonly input: InputManager;
  readonly hud: Hud;
  readonly ui: UIManager;

  private running = false;
  private lastTime = 0;
  private accumulator = 0;
  private readonly FIXED_DT = 1 / 20;

  mode: GameMode = 'menu';
  private endRecorded = false;
  private fpsFrames = 0;
  private fpsLast = 0;
  private fps = 0;

  constructor(container: HTMLElement) {
    this.simulation = new Simulation();
    this.renderer = new Renderer(container);
    this.input = new InputManager(this.renderer);
    this.input.setSimulation(this.simulation);
    this.input.setGame(this);
    this.hud = new Hud();
    this.hud.setVisible(false);

    this.ui = new UIManager({
      onNewGame: (nation) => this.newGame(nation),
      onLoadSlot: (slot) => this.loadSlot(slot),
      onSaveSlot: (slot) => this.saveSlot(slot),
      onResume: () => this.resume(),
      onQuitToMenu: () => this.quitToMenu(),
      onSettingsChanged: (s) => this.applySettings(s),
    });

    this.applySettings(this.ui.getSettings());
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.fpsLast = this.lastTime;
    requestAnimationFrame(this.loop);
  }

  stop() {
    this.running = false;
  }

  newGame(nation?: NationId) {
    const n = nation ?? this.ui.getProfile().preferredNation;
    this.simulation.reset();
    this.simulation.bootstrapDemoWorld(n);
    this.input.setSimulation(this.simulation);
    this.mode = 'playing';
    this.endRecorded = false;
    this.ui.show('none');
    this.hud.setVisible(true);
    this.ui.showToast(`Playing as ${n} — ${this.simulation.getCurrentEpochName()}`);
  }

  loadSlot(slot: number) {
    const ok = SaveSystem.loadFromSlot(this.simulation, slot);
    if (!ok) {
      this.ui.showToast('Failed to load save');
      return;
    }
    this.input.setSimulation(this.simulation);
    this.mode = 'playing';
    this.endRecorded = false;
    this.ui.show('none');
    this.hud.setVisible(true);
    this.ui.showToast(`Loaded slot ${slot}`);
  }

  saveSlot(slot: number) {
    if (this.mode !== 'playing' && this.mode !== 'paused') return;
    const ok = SaveSystem.saveToSlot(this.simulation, slot);
    this.ui.showToast(ok ? `Saved to slot ${slot}` : 'Save failed');
    if (ok) this.ui.show('pause');
  }

  pause() {
    if (this.mode !== 'playing') return;
    this.mode = 'paused';
    this.ui.show('pause');
    this.hud.setVisible(false);
  }

  resume() {
    if (this.mode !== 'paused') return;
    this.mode = 'playing';
    this.ui.show('none');
    this.hud.setVisible(true);
  }

  quitToMenu() {
    this.mode = 'menu';
    this.hud.setVisible(false);
    this.ui.show('main');
  }

  togglePause() {
    if (this.mode === 'playing') this.pause();
    else if (this.mode === 'paused') this.resume();
  }

  applySettings(s: GameSettings) {
    this.input.setPanSpeedMultiplier(s.cameraPanSpeed);
    this.input.setZoomSpeedMultiplier(s.cameraZoomSpeed);
    if (s.graphicsQuality === 'low') {
      this.renderer.renderer.setPixelRatio(1);
    } else if (s.graphicsQuality === 'medium') {
      this.renderer.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    } else {
      this.renderer.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }
  }

  private loop = (now: number) => {
    if (!this.running) return;

    const frameTime = Math.min((now - this.lastTime) / 1000, 0.25);
    this.lastTime = now;

    this.fpsFrames++;
    if (now - this.fpsLast >= 1000) {
      this.fps = this.fpsFrames;
      this.fpsFrames = 0;
      this.fpsLast = now;
    }

    if (this.mode === 'playing') {
      this.accumulator += frameTime;
      while (this.accumulator >= this.FIXED_DT) {
        this.simulation.step(this.FIXED_DT);
        this.accumulator -= this.FIXED_DT;
      }

      const outcome = this.simulation.checkOutcome();
      if (outcome === 'victory' || outcome === 'defeat') {
        this.mode = 'ended';
        this.hud.setVisible(false);
        if (!this.endRecorded) {
          ProfileStore.recordGameEnd(outcome === 'victory', this.simulation.time);
          this.endRecorded = true;
        }
        this.ui.show(outcome === 'victory' ? 'victory' : 'defeat');
      }
    }

    const alpha = this.accumulator / this.FIXED_DT;
    this.renderer.render(this.simulation, alpha);

    if (this.mode === 'playing') {
      this.hud.update(this.simulation, this.ui.getSettings().showFPS ? this.fps : undefined);
    }

    requestAnimationFrame(this.loop);
  };
}
