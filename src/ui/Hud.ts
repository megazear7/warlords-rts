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
        <strong>F</strong> Farm · <strong>B</strong> Barracks · <strong>L</strong> Library · <strong>C</strong> Found City<br/>
        Barracks + <strong>T</strong> = Train Legionary<br/>
        <strong>1–4</strong> Research · Right-click enemy = Attack<br/>
        Enemy camp is to the north-east (green units)
      </div>
    `;

    this.resourcesEl = document.getElementById('hud-resources') as HTMLElement;
    this.selectionEl = document.getElementById('hud-selection') as HTMLElement;
    this.researchEl = document.getElementById('hud-research') as HTMLElement;
  }

  update(sim: Simulation) {
    const r = sim.resources;
    const playerUnits = sim.getAllUnits().filter((u) => u.nation === 'rome').length;
    const enemyUnits = sim.getAllUnits().filter((u) => u.nation === 'gaul').length;

    this.resourcesEl.innerHTML = `
      <span title="Food">🍞 ${Math.floor(r.food)}</span>
      <span title="Timber">🪵 ${Math.floor(r.timber)}</span>
      <span title="Metal">⚙️ ${Math.floor(r.metal)}</span>
      <span title="Wealth">💰 ${Math.floor(r.wealth)}</span>
      <span title="Knowledge">📚 ${Math.floor(r.knowledge)}</span>
      <span title="Pop">👥 ${playerUnits}/${sim.popCap}</span>
      <span title="Enemies">⚔ ${enemyUnits}</span>
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
      if (u.carrying) extra += ` · carrying ${Math.floor(u.carrying.amount)} ${u.carrying.type}`;
      this.selectionEl.textContent = `Selected: ${u.type} (${Math.ceil(u.hp)}/${u.maxHp} HP)${extra}`;
    } else {
      this.selectionEl.textContent = `Selected: ${selected.length} units`;
    }

    const rs = sim.research;
    let researchText = `Sci ${rs.science} · Civ ${rs.civic} · Mil ${rs.military} · Com ${rs.commerce} · Cities ${sim.cityLimit}`;
    if (rs.current) {
      researchText += ` · ${rs.current} ${Math.floor(rs.progress * 100)}%`;
    }
    this.researchEl.textContent = researchText;
  }
}
