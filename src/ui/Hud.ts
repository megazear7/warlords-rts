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
  private marketEl: HTMLElement;
  private marketRatesEl: HTMLElement;

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
      <div class="hud-market" id="hud-market" style="display:none; margin-top:6px; padding:6px; background:rgba(0,0,0,0.55); border-radius:4px;">
        <div style="font-weight:600; margin-bottom:4px;">Market</div>
        <div id="hud-market-rates"></div>
        <div style="margin-top:4px; font-size:12px;">U sell food · I buy metal</div>
      </div>
      <div class="hud-help">
        A attack-move · Y tower (Mil1) · H wall (Mil2) · M market (Com1) · U/I trade · V citizen · G general<br/>
        T infantry · R elite · Q scout · W wagon · F1–F4 research · E epoch · Ctrl+0-9
      </div>
    `;

    this.resourcesEl = document.getElementById('hud-resources') as HTMLElement;
    this.selectionEl = document.getElementById('hud-selection') as HTMLElement;
    this.researchEl = document.getElementById('hud-research') as HTMLElement;
    this.epochEl = document.getElementById('hud-epoch') as HTMLElement;
    this.unitsEl = document.getElementById('hud-units') as HTMLElement;
    this.fpsEl = document.getElementById('hud-fps') as HTMLElement;
    this.marketEl = document.getElementById('hud-market') as HTMLElement;
    this.marketRatesEl = document.getElementById('hud-market-rates') as HTMLElement;
  }

  setVisible(v: boolean) {
    this.root.style.display = v ? 'block' : 'none';
  }

  update(sim: Simulation, fps?: number) {
    const r = sim.resources;
    const nation = NATIONS[sim.playerNation];
    const playerUnits = sim.getAllUnits().filter((u) => u.nation === sim.playerNation && u.hp > 0).length;
    const enemyUnits = sim.getAllUnits().filter((u) => u.nation !== sim.playerNation && u.hp > 0).length;
    const cityCount = sim.getAllBuildings().filter((b) => b.type === 'city_center' && b.nation === sim.playerNation).length;

    this.epochEl.textContent = `${nation?.name ?? sim.playerNation} · ${sim.getCurrentEpochName()} · cities ${cityCount}/${sim.cityLimit}`;

    this.resourcesEl.innerHTML = `
      <span>🌾 ${Math.floor(r.food)}</span>
      <span>🪵 ${Math.floor(r.timber)}</span>
      <span>⛏️ ${Math.floor(r.metal)}</span>
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
      if (building.type === 'market') {
        this.marketEl.style.display = 'block';
        const com = sim.research.commerce;
        const sellRate = 0.35 + com * 0.05;
        const buyCost = Math.max(1.2, 2.0 - com * 0.12);
        this.marketRatesEl.innerHTML = `Sell food → ${sellRate.toFixed(2)} wealth each<br/>Buy metal ← ${buyCost.toFixed(2)} wealth each`;
      } else {
        this.marketEl.style.display = 'none';
      }
    } else if (selected.length === 0) {
      this.marketEl.style.display = 'none';
      this.selectionEl.textContent = 'No selection';
    } else if (selected.length === 1) {
      const u = selected[0];
      let extra = '';
      if (u.gatherTargetId) extra = ' · gathering';
      if (u.attackTargetId) extra = ' · attacking';
      if (u.attackBuildingId) extra = ' · sieging';
      if (u.attackMove) extra += ' · attack-move';
      if (u.underAttrition) extra += ' · ⚠ attrition';
      if ((u as any).inAura) extra += ' · ⚔ aura';
      if (u.type === 'general') extra += ' · GENERAL (aura radius)';
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
      'V citizen · Y tower · M market · U/I trade · Barracks: ' +
      trainable.map((u) => `${u.name}${u.minEpoch > 0 ? '*' : ''}`).join(', ');

    this.fpsEl.textContent = fps != null ? `· ${fps} FPS` : '';
  }
}
