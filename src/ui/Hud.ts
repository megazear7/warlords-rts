import { Simulation } from '../core/Simulation';

export class Hud {
  private root: HTMLElement;
  private resourcesEl: HTMLElement;
  private selectionEl: HTMLElement;
  private researchEl: HTMLElement;
  private fpsEl: HTMLElement;

  constructor() {
    this.root = document.getElementById('hud') as HTMLElement;
    if (!this.root) {
      this.root = document.createElement('div');
      this.root.id = 'hud';
      document.getElementById('app')?.appendChild(this.root);
    }

    this.root.innerHTML = `
      <div class="hud-title"><strong>Warlords</strong> <span id="hud-fps"></span></div>
      <div class="hud-resources" id="hud-resources"></div>
      <div class="hud-selection" id="hud-selection"></div>
      <div class="hud-research" id="hud-research"></div>
      <div class="hud-help">
        Esc Pause · S Quick-save · F/B/L/C build · T train · 1–4 research
      </div>
    `;

    this.resourcesEl = document.getElementById('hud-resources') as HTMLElement;
    this.selectionEl = document.getElementById('hud-selection') as HTMLElement;
    this.researchEl = document.getElementById('hud-research') as HTMLElement;
    this.fpsEl = document.getElementById('hud-fps') as HTMLElement;
  }

  setVisible(v: boolean) {
    this.root.style.display = v ? 'block' : 'none';
  }

  update(sim: Simulation, fps?: number) {
    const r = sim.resources;
    const playerUnits = sim.getAllUnits().filter((u) => u.nation === 'rome').length;
    const enemyUnits = sim.getAllUnits().filter((u) => u.nation === 'gaul').length;

    this.resourcesEl.innerHTML = `
      <span>🍞 ${Math.floor(r.food)}</span>
      <span>🪵 ${Math.floor(r.timber)}</span>
      <span>⚙️ ${Math.floor(r.metal)}</span>
      <span>💰 ${Math.floor(r.wealth)}</span>
      <span>📚 ${Math.floor(r.knowledge)}</span>
      <span>👥 ${playerUnits}/${sim.popCap}</span>
      <span>⚔ ${enemyUnits}</span>
    `;

    const selected = sim.getSelectedUnits();
    const building = sim.getSelectedBuilding();

    if (building) {
      let extra = '';
      if (building.productionTimer != null && building.productionTimer > 0) {
        extra = ` · training ${building.productionType} (${building.productionTimer.toFixed(1)}s)`;
      }
      this.selectionEl.textContent = `Building: ${building.type}${extra}`;
    } else if (selected.length === 0) {
      this.selectionEl.textContent = 'No selection';
    } else if (selected.length === 1) {
      const u = selected[0];
      let extra = '';
      if (u.gatherTargetId) extra = ' · gathering';
      if (u.attackTargetId) extra = ' · attacking';
      this.selectionEl.textContent = `Selected: ${u.type} (${Math.ceil(u.hp)}/${u.maxHp} HP)${extra}`;
    } else {
      this.selectionEl.textContent = `Selected: ${selected.length} units`;
    }

    const rs = sim.research;
    let researchText = `Sci ${rs.science} · Civ ${rs.civic} · Mil ${rs.military} · Com ${rs.commerce}`;
    if (rs.current) researchText += ` · ${rs.current} ${Math.floor(rs.progress * 100)}%`;
    this.researchEl.textContent = researchText;

    this.fpsEl.textContent = fps != null ? `· ${fps} FPS` : '';
  }
}
