import { Simulation } from '../core/Simulation';

/**
 * Simple DOM-based heads-up display.
 */
export class Hud {
  private root: HTMLElement;
  private resourcesEl: HTMLElement;
  private selectionEl: HTMLElement;

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
      <div class="hud-help">
        Left-click / drag: select · Shift+drag: pan<br/>
        Right-click unit/ground: move · Right-click resource: gather<br/>
        <strong>F</strong> = Build Farm (needs citizens + 60 timber)
      </div>
    `;

    this.resourcesEl = document.getElementById('hud-resources') as HTMLElement;
    this.selectionEl = document.getElementById('hud-selection') as HTMLElement;
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

    const selected = sim.getSelectedUnits();
    if (selected.length === 0) {
      this.selectionEl.textContent = 'No units selected';
    } else if (selected.length === 1) {
      const u = selected[0];
      let extra = '';
      if (u.gatherTargetId) extra = ' · gathering';
      if (u.carrying) extra += ` · carrying ${Math.floor(u.carrying.amount)} ${u.carrying.type}`;
      this.selectionEl.textContent = `Selected: ${u.type} (${u.hp}/${u.maxHp} HP)${extra}`;
    } else {
      this.selectionEl.textContent = `Selected: ${selected.length} units`;
    }
  }
}
