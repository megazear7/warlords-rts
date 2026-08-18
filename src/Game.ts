import { Simulation } from './core/Simulation';
import { Renderer } from './renderer/Renderer';
import { InputManager } from './renderer/InputManager';
import { Hud } from './ui/Hud';
import { UIManager } from './ui/UIManager';
import { Minimap } from './ui/Minimap';
import { ResearchPanel } from './ui/ResearchPanel';
import { SaveSystem } from './core/SaveSystem';
import { ProfileStore } from './core/Profile';
import { GameSettings } from './core/Settings';
import { NationId } from './data/nations';
import { DEFAULT_MAP_SIZE, MapSizeId } from './core/world';
import { audio } from './audio/AudioManager';

export type GameMode = 'menu' | 'playing' | 'paused' | 'ended';

export class Game {
  readonly simulation: Simulation;
  readonly renderer: Renderer;
  readonly input: InputManager;
  readonly hud: Hud;
  readonly ui: UIManager;
  readonly minimap: Minimap;
  readonly researchPanel: ResearchPanel;
  readonly audio = audio;

  private running = false;
  private lastTime = 0;
  private accumulator = 0;
  private readonly FIXED_DT = 1 / 20;

  mode: GameMode = 'menu';
  private endRecorded = false;
  private fpsFrames = 0;
  private fpsLast = 0;
  private fps = 0;
  private prevUnitCount = 0;
  private prevBuildingNations = new Map<string, string>();
  private prevResearchBusy = false;
  private prevEpoch = 0;
  private attritionAlerted = false;

  constructor(container: HTMLElement) {
    this.simulation = new Simulation();
    this.renderer = new Renderer(container);
    this.input = new InputManager(this.renderer);
    this.input.setSimulation(this.simulation);
    this.input.setGame(this);
    this.hud = new Hud();
    this.hud.setOnAction((action) => this.input.performAction(action));
    this.hud.setVisible(false);
    this.minimap = new Minimap();
    this.minimap.setOnJump((x, z) => {
      this.renderer.cameraTarget.set(x, 0, z);
    });
    this.minimap.setVisible(false);
    this.researchPanel = new ResearchPanel();
    this.researchPanel.setOnResearch((track) => {
      const ok = this.simulation.tryResearch(track);
      if (ok) {
        this.ui.showToast(`Researching ${track}…`);
      } else {
        const reason = this.simulation.canTryResearch(track);
        this.ui.showToast(reason ?? 'Cannot research now');
      }
    });

    this.ui = new UIManager({
      onNewGame: (nation, mapSize) => this.newGame(nation, mapSize),
      onLoadSlot: (slot) => this.loadSlot(slot),
      onSaveSlot: (slot) => this.saveSlot(slot),
      onResume: () => this.resume(),
      onQuitToMenu: () => this.quitToMenu(),
      onSettingsChanged: (s) => this.applySettings(s),
    });

    const unlock = () => {
      void audio.unlock();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    this.applySettings(this.ui.getSettings());
    void audio.preloadFiles();
    audio.playMusic('music_menu');
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

  newGame(nation?: NationId, mapSize: MapSizeId = DEFAULT_MAP_SIZE) {
    void audio.unlock();
    audio.play('ui_confirm');
    const n = nation ?? this.ui.getProfile().preferredNation;
    this.simulation.reset();
    this.simulation.bootstrapDemoWorld(n, mapSize);
    this.applyWorldSize();
    this.input.setSimulation(this.simulation);
    this.mode = 'playing';
    this.endRecorded = false;
    this.attritionAlerted = false;
    this.snapshotAudioState();
    this.ui.show('none');
    this.hud.setVisible(true);
    this.minimap.setVisible(true);
    audio.setMusicDucked(false);
    audio.playMusic('music_gameplay');
    this.ui.showToast(`Playing as ${n} — ${this.simulation.getCurrentEpochName()}`);
  }

  loadSlot(slot: number) {
    void audio.unlock();
    const ok = SaveSystem.loadFromSlot(this.simulation, slot);
    if (!ok) {
      audio.play('ui_error');
      this.ui.showToast('Failed to load save');
      return;
    }
    audio.play('ui_confirm');
    this.applyWorldSize();
    this.input.setSimulation(this.simulation);
    this.mode = 'playing';
    this.endRecorded = false;
    this.snapshotAudioState();
    this.ui.show('none');
    this.hud.setVisible(true);
    this.minimap.setVisible(true);
    audio.setMusicDucked(false);
    audio.playMusic('music_gameplay');
    this.ui.showToast(`Loaded slot ${slot}`);
  }

  private applyWorldSize() {
    const size = this.simulation.worldSize;
    this.renderer.setWorldSize(size);
    this.input.setMapHalf(size / 2);
  }

  saveSlot(slot: number) {
    if (this.mode !== 'playing' && this.mode !== 'paused') return;
    const ok = SaveSystem.saveToSlot(this.simulation, slot);
    audio.play(ok ? 'ui_confirm' : 'ui_error');
    this.ui.showToast(ok ? `Saved to slot ${slot}` : 'Save failed');
    if (ok) this.ui.show('pause');
  }

  pause() {
    if (this.mode !== 'playing') return;
    this.mode = 'paused';
    this.ui.show('pause');
    this.hud.setVisible(false);
    this.minimap.setVisible(false);
    this.researchPanel.hide();
    audio.setMusicDucked(true);
    audio.play('ui_click');
  }

  resume() {
    if (this.mode !== 'paused') return;
    this.mode = 'playing';
    this.ui.show('none');
    this.hud.setVisible(true);
    this.minimap.setVisible(true);
    audio.setMusicDucked(false);
    audio.play('ui_click');
  }

  quitToMenu() {
    this.mode = 'menu';
    this.hud.setVisible(false);
    this.minimap.setVisible(false);
    this.researchPanel.hide();
    audio.setMusicDucked(false);
    audio.playMusic('music_menu');
    audio.play('ui_click');
    this.ui.show('main');
  }

  togglePause() {
    if (this.mode === 'playing') this.pause();
    else if (this.mode === 'paused') this.resume();
  }

  applySettings(s: GameSettings) {
    this.input.setPanSpeedMultiplier(s.cameraPanSpeed);
    this.input.setZoomSpeedMultiplier(s.cameraZoomSpeed);
    this.input.setEdgeScroll(s.edgeScroll);
    audio.applySettings(s);
    if (s.graphicsQuality === 'low') {
      this.renderer.renderer.setPixelRatio(1);
    } else if (s.graphicsQuality === 'medium') {
      this.renderer.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    } else {
      this.renderer.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }
  }

  private snapshotAudioState() {
    this.prevUnitCount = this.simulation.getAllUnits().filter((u) => u.hp > 0).length;
    this.prevBuildingNations.clear();
    for (const b of this.simulation.getAllBuildings()) {
      this.prevBuildingNations.set(b.id, b.nation as string);
    }
    this.prevResearchBusy = !!this.simulation.research.current;
    this.prevEpoch = this.simulation.epochIndex;
  }

  private processAudioCues() {
    const sim = this.simulation;
    const units = sim.getAllUnits().filter((u) => u.hp > 0);
    const unitCount = units.length;

    if (unitCount < this.prevUnitCount) audio.play('combat_death');
    this.prevUnitCount = unitCount;

    for (const b of sim.getAllBuildings()) {
      const prev = this.prevBuildingNations.get(b.id);
      if (prev != null && prev !== b.nation) audio.play('city_capture');
      this.prevBuildingNations.set(b.id, b.nation as string);
    }

    const busy = !!sim.research.current;
    if (this.prevResearchBusy && !busy) audio.play('research_complete');
    this.prevResearchBusy = busy;

    if (sim.epochIndex > this.prevEpoch) audio.play('epoch_advance');
    this.prevEpoch = sim.epochIndex;

    if (sim.lastTrainComplete) audio.play('train_complete');

    for (const u of units) {
      if (u.attackTimer > 0 && u.attackTimer < 0.08) {
        if (u.attackBuildingId) audio.play('siege_hit');
        else if (u.attackTargetId) audio.play('combat_hit');
      }
    }

    const selectedAttrition = sim.getSelectedUnits().some((u) => u.underAttrition);
    if (selectedAttrition && !this.attritionAlerted) {
      audio.play('alert_attrition');
      this.attritionAlerted = true;
    }
    if (!selectedAttrition) this.attritionAlerted = false;
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
      this.input.updateEdgeScroll(frameTime);

      this.accumulator += frameTime;
      while (this.accumulator >= this.FIXED_DT) {
        this.simulation.step(this.FIXED_DT);
        this.accumulator -= this.FIXED_DT;
      }

      this.processAudioCues();

      const outcome = this.simulation.checkOutcome();
      if (outcome === 'victory' || outcome === 'defeat') {
        this.mode = 'ended';
        this.hud.setVisible(false);
        this.minimap.setVisible(false);
        if (!this.endRecorded) {
          ProfileStore.recordGameEnd(outcome === 'victory', this.simulation.time);
          this.endRecorded = true;
        }
        if (outcome === 'victory') {
          audio.play('victory');
          audio.playMusic('music_victory');
        } else {
          audio.play('defeat');
          audio.playMusic('music_defeat');
        }
        this.ui.show(outcome === 'victory' ? 'victory' : 'defeat');
      }
    }

    const alpha = this.accumulator / this.FIXED_DT;
    this.renderer.render(this.simulation, alpha);

    if (this.mode === 'playing') {
      this.hud.update(
        this.simulation,
        this.ui.getSettings().showFPS ? this.fps : undefined,
        this.input
      );
      this.minimap.update(
        this.simulation,
        this.renderer.cameraTheta,
        this.renderer.cameraTarget
      );
      this.researchPanel.update(this.simulation);
    }

    requestAnimationFrame(this.loop);
  };
}
