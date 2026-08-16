import { Simulation } from './core/Simulation';
import { Renderer } from './renderer/Renderer';
import { InputManager } from './renderer/InputManager';

/**
 * Top-level orchestrator.
 * Owns the pure simulation and the Three.js renderer.
 * Keeps a fixed timestep for simulation and interpolates for rendering.
 */
export class Game {
  readonly simulation: Simulation;
  readonly renderer: Renderer;
  readonly input: InputManager;

  private running = false;
  private lastTime = 0;
  private accumulator = 0;

  /** Fixed simulation step (20 Hz) */
  private readonly FIXED_DT = 1 / 20;

  constructor(container: HTMLElement) {
    this.simulation = new Simulation();
    this.renderer = new Renderer(container);
    this.input = new InputManager(this.renderer);

    // Initial world setup (Phase 0 placeholder)
    this.simulation.bootstrapDemoWorld();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop);
  }

  stop() {
    this.running = false;
  }

  private loop = (now: number) => {
    if (!this.running) return;

    const frameTime = Math.min((now - this.lastTime) / 1000, 0.25); // clamp large spikes
    this.lastTime = now;
    this.accumulator += frameTime;

    // Fixed-step simulation
    while (this.accumulator >= this.FIXED_DT) {
      this.simulation.step(this.FIXED_DT);
      this.accumulator -= this.FIXED_DT;
    }

    // Render with interpolation alpha
    const alpha = this.accumulator / this.FIXED_DT;
    this.renderer.render(this.simulation, alpha);

    requestAnimationFrame(this.loop);
  };
}
