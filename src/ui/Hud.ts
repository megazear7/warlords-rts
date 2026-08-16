import { Simulation } from '../core/Simulation';
import { NATIONS } from '../data/nations';
import { getTrainableForNation } from '../data/units';

export class Hud {
  private root: HTMLElement;
  private resourcesEl: HTMLElement;
  private selectionEl: HTMLElement;
  private researchEl: HTMLElement;
  private epochEl: HTMLElement;
  private unitsEl: HTMLElement;
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
      <div class="hud-epoch" id="hud-epoch"></div>
      <div class="hud-resources" id="hud-resources"></div>
      <div class="hud-selection" id="hud-selection"></div>
      <div class="hud-research" id="hud-research"></div>
      <div class="hud-units" id="hud-units"></div>
      <div class="hud-help">
        V citizen (city) · T infantry · R elite · Q scout · W wagon · edge-scroll camera<br/>
        Select barracks/city → right-click ground = rally · Ctrl+0-9 groups · F1–F4 research · E epoch
      </div>
    `;

    this.resourcesEl = document.getElementById('hud-resources') as HTMLElement;
    this.selectionEl = document.getElementById('hud-selection') as HTMLElement;
    this.researchEl = document.getElementById('hud-research') as HTMLElement;
    this.epochEl = document.getElementById('hud-epoch') as HTMLElement;
    this.unitsEl = document.getElementById('hud-units') as HTMLElement;
    this.fpsEl = document.getElementById('hud-fps') as HTMLElement;
  }

  setVisible(v: boolean) {
    this.root.style.display = v ? 'block' : 'none';
  }

  update(sim: Simulation, fps?: number) {
    const r = sim.resources;
    const nation = NATIONS[sim.playerNation];
    const playerUnits = sim.getAllUnits().filter((u) => u.nation === sim.playerNation).length;
    const enemyUnits = sim.getAllUnits().filter((u) => u.nation !== sim.playerNation).length;

    this.epochEl.textContent = `${nation.name} — ${sim.getCurrentEpochName()} (E)`;

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
      if (building.rallyPoint) {
        extra += ` · rally (${building.rallyPoint.x.toFixed(0)}, ${building.rallyPoint.z.toFixed(0)})`;
      }
      const hp = `${Math.ceil(building.hp)}/${building.maxHp}`;
      this.selectionEl.textContent = `Building: ${building.type} (${hp})${extra}`;
    } else if (selected.length === 0) {
      this.selectionEl.textContent = 'No selection';
    } else if (selected.length === 1) {
      const u = selected[0];
      let extra = '';
      if (u.gatherTargetId) extra = ' · gathering';
      if (u.attackTargetId) extra = ' · attacking';
      if (u.attackBuildingId) extra = ' · sieging';
      if (u.underAttrition) extra += ' · ⚠ attrition';
      this.selectionEl.textContent = `Selected: ${u.type} (${Math.ceil(u.hp)}/${u.maxHp} HP)${extra}`;
    } else {
      const attr = selected.filter((u) => u.underAttrition).length;
      this.selectionEl.textContent =
        `Selected: ${selected.length} units` + (attr ? ` (${attr} under attrition)` : '');
    }

    const rs = sim.research;
    let researchText = `Sci ${rs.science} · Civ ${rs.civic} · Mil ${rs.military} · Com ${rs.commerce}`;
    if (rs.current) researchText += ` · ${rs.current} ${Math.floor(rs.progress * 100)}%`;
    this.researchEl.textContent = researchText;

    const trainable = getTrainableForNation(sim.playerNation, sim.epochIndex);
    this.unitsEl.textContent =
      'City: Citizen (V) · Barracks: ' +
      trainable.map((u) => `${u.name}${u.minEpoch > 0 ? '*' : ''}`).join(', ') +
      ' · Wagon';

    this.fpsEl.textContent = fps != null ? `· ${fps} FPS` : '';
  }
}
