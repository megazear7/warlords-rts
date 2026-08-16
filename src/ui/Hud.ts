import { Simulation } from '../core/Simulation';

/**
 * Simple DOM-based heads-up display.
 * Shows resources, selection count, and controls help.
 */
export class Hud {
  private root: HTMLElement;
  private resourcesEl: HTMLElement;
  private selectionEl: HTMLElement;
  private helpEl: HTMLElement;

  constructor() {
    this.root = document.getElementById('hud') as HTMLElement;
    if (!this.root) {
      this.root = document.createElement('div');
      this.root.id = 'hud';
      document.getElementById('app')?.appendChild(this.root);
    }

    this.root.innerHTML = `
      <div class="hud-title"><strong>Warlords</strong> — Vertical Slice</div>
      <div class="hud-resources" id="hud-resources"></div>
      <div class="hud-selection" id="hud-selection"></div>
      <div class="hud-help" id="hud-help">
        Left-click: select · Shift+click: add · Right-click: move<br/>
        Left-drag: pan · Right-drag: orbit · Wheel: zoom
      </div>
    `;

    this.resourcesEl = document.getElementById('hud-resources') as HTMLElement;
    this.selectionEl = document.getElementById('hud-selection') as HTMLElement;
    this.helpEl = document.getElementById('hud-help') as HTMLElement;
  }

  update(sim: Simulation) {
    const r = sim.resources;
    this.resourcesEl.innerHTML = `
      <span title="Food">🍞 ${Math.floor(r.food)}</span>
      <span title="Timber">🪵 ${Math.floor(r.timber)}</span>
      <span title="Metal">⚙️ ${Math.floor(r.metal)}</span>
      <span title="Wealth">💰 ${Math.floor(r.wealth)}</span>
      <span title="Knowledge">📚 ${Math.floor(r.knowledge)}</span>
    `;

    const count = sim.selected.size;
    if (count === 0) {
      this.selectionEl.textContent = 'No units selected';
    } else if (count === 1) {
      const unit = sim.getSelectedUnits()[0];
      this.selectionEl.textContent = `Selected: ${unit.type} (${unit.hp}/${unit.maxHp} HP)`;
    } else {
      this.selectionEl.textContent = `Selected: ${count} units`;
    }
  }
}
