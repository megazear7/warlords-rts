import { Simulation } from '../core/Simulation';

export class Hud {
  private root: HTMLElement;
  private resourcesEl: HTMLElement;
  private selectionEl: HTMLElement;
  private researchEl: HTMLElement;

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
      <div class="hud-research" id="hud-research"></div>
      <div class="hud-help">
        <strong>F</strong> Farm · <strong>B</strong> Barracks · <strong>L</strong> Library<br/>
        Select Barracks + <strong>T</strong> = Train Legionary<br/>
        <strong>1</strong> Science · <strong>2</strong> Civic · <strong>3</strong> Military · <strong>4</strong> Commerce<br/>
        Click building to select · Right-click resource to gather
      </div>
    `;

    this.resourcesEl = document.getElementById('hud-resources') as HTMLElement;
    this.selectionEl = document.getElementById('hud-selection') as HTMLElement;
    this.researchEl = document.getElementById('hud-research') as HTMLElement;
  }

  update(sim: Simulation) {
    const r = sim.resources;
    this.resourcesEl.innerHTML = `
      <span title="Food">🍞 ${Math.floor(r.food)}</span>
      <span title="Timber">🪵 ${Math.floor(r.timber)}</span>
      <span title="Metal">⚙️ ${Math.floor(r.metal)}</span>
      <span title="Wealth">💰 ${Math.floor(r.wealth)}</span>
      <span title="Knowledge">📚 ${Math.floor(r.knowledge)}</span>
      <span title="Pop">👥 ${sim.units.size}/${sim.popCap}</span>
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
      if (u.carrying) extra += ` · carrying ${Math.floor(u.carrying.amount)} ${u.carrying.type}`;
      this.selectionEl.textContent = `Selected: ${u.type} (${u.hp}/${u.maxHp} HP)${extra}`;
    } else {
      this.selectionEl.textContent = `Selected: ${selected.length} units`;
    }

    const rs = sim.research;
    let researchText = `Sci ${rs.science} · Civ ${rs.civic} · Mil ${rs.military} · Com ${rs.commerce}`;
    if (rs.current) {
      researchText += ` · Researching ${rs.current} (${Math.floor(rs.progress * 100)}%)`;
    }
    this.researchEl.textContent = researchText;
  }
}
