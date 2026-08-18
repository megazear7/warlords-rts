import { Simulation, Unit, Building } from '../core/Simulation';
import { NATIONS } from '../data/nations';
import { getTrainableForNation } from '../data/units';
import { getExchangeRates } from '../data/market';
import {
  portraitForNation,
  buildingDisplayName,
  unitDisplayName,
} from '../data/portraits';
import type { HudAction, InputManager } from '../renderer/InputManager';

const BUTTON_ART = '/ui/building-button-placeholder.png';

export class Hud {
  private root: HTMLElement;
  private resourcesEl: HTMLElement;
  private portraitsEl: HTMLElement;
  private selectionEl: HTMLElement;
  private researchEl: HTMLElement;
  private epochEl: HTMLElement;
  private epochNextEl: HTMLElement;
  private fpsEl: HTMLElement;
  private marketEl: HTMLElement;
  private marketRatesEl: HTMLElement;
  private controlGroupsEl: HTMLElement;
  private commandsEl: HTMLElement;
  private lastPortraitKey = '';
  private lastCommandKey = '';
  private onAction: ((action: HudAction) => void) | null = null;

  constructor() {
    this.root = document.getElementById('hud') as HTMLElement;
    if (!this.root) {
      this.root = document.createElement('div');
      this.root.id = 'hud';
      document.getElementById('app')?.appendChild(this.root);
    }

    this.root.dataset.frame = 'generic';

    this.root.innerHTML = `
      <div class="hud-strip">
        <div class="hud-brand">Warlords <span id="hud-fps"></span></div>
        <div class="hud-resources" id="hud-resources"></div>
        <div class="hud-meta">
          <div class="hud-epoch" id="hud-epoch"></div>
          <div id="hud-epoch-next"></div>
          <div class="hud-research" id="hud-research"></div>
          <div id="hud-control-groups" style="letter-spacing:2px;margin-top:2px;"></div>
        </div>
      </div>
      <div class="hud-main">
        <div class="hud-portraits" id="hud-portraits"></div>
        <div class="hud-detail">
          <div class="hud-selection" id="hud-selection"></div>
          <div class="hud-market" id="hud-market" style="display:none;">
            <div style="font-weight:600; margin-bottom:3px;">Market</div>
            <div id="hud-market-rates"></div>
          </div>
        </div>
        <div class="hud-commands" id="hud-commands"></div>
      </div>
    `;

    this.resourcesEl = document.getElementById('hud-resources') as HTMLElement;
    this.portraitsEl = document.getElementById('hud-portraits') as HTMLElement;
    this.selectionEl = document.getElementById('hud-selection') as HTMLElement;
    this.researchEl = document.getElementById('hud-research') as HTMLElement;
    this.epochEl = document.getElementById('hud-epoch') as HTMLElement;
    this.epochNextEl = document.getElementById('hud-epoch-next') as HTMLElement;
    this.fpsEl = document.getElementById('hud-fps') as HTMLElement;
    this.marketEl = document.getElementById('hud-market') as HTMLElement;
    this.marketRatesEl = document.getElementById('hud-market-rates') as HTMLElement;
    this.controlGroupsEl = document.getElementById('hud-control-groups') as HTMLElement;
    this.commandsEl = document.getElementById('hud-commands') as HTMLElement;
    this.commandsEl.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
      if (!btn || btn.hasAttribute('disabled')) return;
      this.onAction?.(btn.dataset.action as HudAction);
    });
  }

  setOnAction(cb: (action: HudAction) => void) {
    this.onAction = cb;
  }

  setVisible(v: boolean) {
    this.root.style.display = v ? 'flex' : 'none';
  }

  update(sim: Simulation, fps?: number, input?: InputManager) {
    const r = sim.resources;
    const nation = NATIONS[sim.playerNation];
    const playerUnits = sim.getAllUnits().filter((u) => u.nation === sim.playerNation && u.hp > 0).length;
    const enemyUnits = sim.getAllUnits().filter((u) => u.nation !== sim.playerNation && u.hp > 0).length;
    const cityCount = sim.getAllBuildings().filter((b) => b.type === 'city_center' && b.nation === sim.playerNation).length;
    const enemyCityCount = sim.getAllBuildings().filter((b) => b.type === 'city_center' && b.nation !== sim.playerNation).length;

    const frame =
      sim.playerNation === 'rome' || sim.playerNation === 'persia' ? sim.playerNation : 'generic';
    this.root.dataset.frame = frame;

    this.epochEl.textContent = `${nation?.name ?? sim.playerNation} · ${sim.getCurrentEpochName()} · cities ${cityCount}/${sim.getPlayerCityLimit()} · enemy ${enemyCityCount}`;

    const nextEpoch = sim.getNextEpochDef();
    if (nextEpoch) {
      const canAdvance = sim.canAdvanceEpoch();
      const b = nextEpoch.bonuses;
      const bonusParts: string[] = [];
      if (b.attackMul) bonusParts.push(`atk ×${b.attackMul}`);
      if (b.gatherMul) bonusParts.push(`gather ×${b.gatherMul}`);
      if (b.researchSpeedMul) bonusParts.push(`research ×${b.researchSpeedMul}`);
      if (b.attritionResist) bonusParts.push(`attrition −${Math.round(b.attritionResist * 100)}%`);
      if (b.popCapBonus) bonusParts.push(`+${b.popCapBonus} pop`);
      const bonusStr = bonusParts.length ? ` [${bonusParts.join(', ')}]` : '';
      const readyMark = canAdvance ? ' · ready' : '';
      this.epochNextEl.textContent =
        `Next: ${nextEpoch.name} · 📚 ${nextEpoch.knowledgeCost} 💰 ${nextEpoch.wealthCost}${bonusStr}${readyMark}`;
      this.epochNextEl.style.color = canAdvance ? '#ffe97a' : '#888';
    } else {
      this.epochNextEl.textContent = 'Max epoch reached';
      this.epochNextEl.style.color = '#88ff88';
    }

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
    this.renderSelection(selected, building, sim);
    this.renderCommands(sim, selected, building, input);

    const rs = sim.research;
    let researchText = `Sci ${rs.science} · Civ ${rs.civic} · Mil ${rs.military} · Com ${rs.commerce}`;
    if (rs.current) researchText += ` · ${rs.current} ${Math.floor(rs.progress * 100)}%`;
    this.researchEl.textContent = researchText;

    this.fpsEl.textContent = fps != null ? `· ${fps} FPS` : '';

    const populated = sim.getPopulatedControlGroups();
    if (populated.size > 0) {
      const slots = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
      this.controlGroupsEl.innerHTML = slots
        .map((s) =>
          populated.has(s)
            ? `<span style="color:#44ff88;background:rgba(0,0,0,0.5);padding:0 3px;border-radius:2px">${s}</span>`
            : `<span style="opacity:0.3">${s}</span>`
        )
        .join(' ');
    } else {
      this.controlGroupsEl.textContent = '';
    }
  }

  private renderSelection(selected: Unit[], building: Building | null, sim: Simulation) {
    const key = building
      ? `b:${building.id}`
      : selected.map((u) => `${u.type}:${u.nation}`).join('|') + `#${selected.length}`;

    if (key !== this.lastPortraitKey) {
      this.lastPortraitKey = key;
      this.portraitsEl.innerHTML = this.portraitMarkup(selected, building);
    } else {
      this.syncPortraitBars(selected, building);
    }

    if (building) {
      const extras: string[] = [];
      if (building.productionTimer != null && building.productionTimer > 0) {
        extras.push(`training ${unitDisplayName(building.productionType ?? '')} (${building.productionTimer.toFixed(1)}s)`);
      }
      if (building.rallyPoint) {
        extras.push(`rally (${building.rallyPoint.x.toFixed(0)}, ${building.rallyPoint.z.toFixed(0)})`);
      }
      const hp = `${Math.ceil(building.hp)}/${building.maxHp}`;
      const pct = Math.max(0, building.hp / building.maxHp);
      this.selectionEl.innerHTML = `
        <div class="sel-name">${buildingDisplayName(building.type)}</div>
        <div class="sel-sub">${hp} HP · ${Math.round(pct * 100)}%</div>
        ${extras.length ? `<div class="sel-status">${extras.join(' · ')}</div>` : ''}
      `;
      if (building.type === 'market') {
        this.marketEl.style.display = 'block';
        const rates = getExchangeRates(sim.research.commerce);
        this.marketRatesEl.innerHTML =
          `Sell 50 food → ${(50 * rates.sellFood).toFixed(1)} wealth (${rates.sellFood.toFixed(2)}/ea)<br/>` +
          `Sell 50 timber → ${(50 * rates.sellTimber).toFixed(1)} wealth (${rates.sellTimber.toFixed(2)}/ea)<br/>` +
          `Buy 20 metal ← ${(20 * rates.buyMetal).toFixed(1)} wealth (${rates.buyMetal.toFixed(2)}/ea)<br/>` +
          `Buy 50 timber ← ${(50 * rates.buyTimber).toFixed(1)} wealth (${rates.buyTimber.toFixed(2)}/ea)`;
      } else {
        this.marketEl.style.display = 'none';
      }
      return;
    }

    this.marketEl.style.display = 'none';

    if (selected.length === 0) {
      this.selectionEl.innerHTML = `<div class="sel-sub">Nothing selected</div>`;
      return;
    }

    if (selected.length === 1) {
      const u = selected[0];
      const flags = unitFlags(u);
      this.selectionEl.innerHTML = `
        <div class="sel-name">${unitDisplayName(u.type)}</div>
        <div class="sel-sub">${Math.ceil(u.hp)}/${u.maxHp} HP</div>
        ${flags ? `<div class="sel-status${u.underAttrition ? ' warn' : ''}">${flags}</div>` : ''}
      `;
      return;
    }

    const groups = groupUnits(selected);
    const attr = selected.filter((u) => u.underAttrition).length;
    const summary = groups.map((g) => `${g.count} ${unitDisplayName(g.type)}`).join(' · ');
    this.selectionEl.innerHTML = `
      <div class="sel-name">${selected.length} units</div>
      <div class="sel-sub">${summary}</div>
      ${attr ? `<div class="sel-status warn">${attr} under attrition</div>` : ''}
    `;
  }

  private renderCommands(
    sim: Simulation,
    selected: Unit[],
    building: Building | null,
    input?: InputManager
  ) {
    const cmds = commandList(sim, selected, building);
    const key = cmds.map((c) => `${c.action}:${c.disabled ? 1 : 0}:${c.label}`).join('|');
    if (key !== this.lastCommandKey) {
      this.lastCommandKey = key;
      this.commandsEl.innerHTML = cmds
        .map(
          (c) => `
        <button type="button" class="hud-cmd" data-action="${c.action}" ${c.disabled ? 'disabled' : ''} title="${c.label}">
          <img src="${BUTTON_ART}" alt="" />
          <span>${c.label}</span>
        </button>`
        )
        .join('');
    }

    for (const btn of this.commandsEl.querySelectorAll<HTMLElement>('.hud-cmd')) {
      const action = btn.dataset.action;
      btn.classList.toggle(
        'is-active',
        (action === 'attack-move' && !!input?.isAttackMoveMode()) ||
          (action === 'found-city' && !!input?.isFoundCityMode())
      );
    }
  }

  private portraitMarkup(selected: Unit[], building: Building | null): string {
    if (building) {
      const pct = Math.max(0, building.hp / building.maxHp);
      return portraitCard({
        src: portraitForNation(building.nation),
        label: buildingDisplayName(building.type),
        pct,
        id: `b-${building.id}`,
      });
    }
    if (selected.length === 0) {
      return `<div class="hud-empty">Select a unit or building</div>`;
    }
    return groupUnits(selected)
      .map((g) =>
        portraitCard({
          src: portraitForNation(g.nation),
          label: unitDisplayName(g.type),
          pct: g.hp / g.maxHp,
          count: g.count,
          id: `u-${g.type}-${g.nation}`,
        })
      )
      .join('');
  }

  private syncPortraitBars(selected: Unit[], building: Building | null) {
    if (building) {
      const el = this.portraitsEl.querySelector('[data-id]') as HTMLElement | null;
      if (el) setCardHp(el, building.hp / building.maxHp);
      return;
    }
    for (const g of groupUnits(selected)) {
      const el = this.portraitsEl.querySelector(
        `[data-id="u-${g.type}-${g.nation}"]`
      ) as HTMLElement | null;
      if (el) setCardHp(el, g.hp / g.maxHp);
    }
  }
}

function groupUnits(units: Unit[]): {
  type: string;
  nation: string;
  count: number;
  hp: number;
  maxHp: number;
}[] {
  const map = new Map<string, { type: string; nation: string; count: number; hp: number; maxHp: number }>();
  for (const u of units) {
    const k = `${u.nation}:${u.type}`;
    const g = map.get(k);
    if (g) {
      g.count += 1;
      g.hp += u.hp;
      g.maxHp += u.maxHp;
    } else {
      map.set(k, { type: u.type, nation: u.nation, count: 1, hp: u.hp, maxHp: u.maxHp });
    }
  }
  return [...map.values()];
}

function unitFlags(u: Unit): string {
  const extra: string[] = [];
  if (u.gatherTargetId) extra.push('gathering');
  if (u.attackTargetId) extra.push('attacking');
  if (u.attackBuildingId) extra.push('sieging');
  if (u.attackMove) extra.push('attack-move');
  if (u.underAttrition) extra.push('⚠ attrition');
  if ((u as any).inAura) extra.push('aura');
  if (u.type === 'general') extra.push('command aura');
  return extra.join(' · ');
}

function portraitCard(opts: {
  src: string;
  label: string;
  pct: number;
  count?: number;
  id: string;
}): string {
  const hpClass = opts.pct > 0.5 ? '' : opts.pct > 0.25 ? ' is-mid' : ' is-low';
  const count =
    opts.count && opts.count > 1 ? `<span class="hud-card-count">${opts.count}</span>` : '';
  return `
    <div class="hud-card" data-id="${opts.id}" title="${opts.label}">
      <img src="${opts.src}" alt="${opts.label}" />
      ${count}
      <div class="hud-card-hp${hpClass}"><i style="width:${Math.round(opts.pct * 100)}%"></i></div>
    </div>
  `;
}

function commandList(
  sim: Simulation,
  selected: Unit[],
  building: Building | null
): { action: HudAction; label: string; disabled?: boolean }[] {
  const cmds: { action: HudAction; label: string; disabled?: boolean }[] = [
    { action: 'research', label: 'Research' },
    { action: 'epoch', label: 'Epoch', disabled: !sim.canAdvanceEpoch() },
  ];

  const hasUnits = selected.length > 0;
  const hasCitizen = selected.some((u) => u.type === 'citizen');

  if (hasUnits) {
    cmds.push({ action: 'attack-move', label: 'Attack' });
  }
  if (hasCitizen) {
    cmds.push({ action: 'found-city', label: 'Found City' });
    cmds.push({ action: 'build-farm', label: 'Farm' });
    cmds.push({ action: 'build-barracks', label: 'Barracks' });
    cmds.push({ action: 'build-library', label: 'Library' });
    cmds.push({ action: 'build-tower', label: 'Tower', disabled: sim.research.military < 1 });
    cmds.push({ action: 'build-market', label: 'Market', disabled: sim.research.commerce < 1 });
    cmds.push({ action: 'build-wall', label: 'Wall', disabled: sim.research.military < 2 });
  }

  if (building?.type === 'city_center') {
    cmds.push({ action: 'train-citizen', label: 'Citizen' });
  }

  if (building?.type === 'barracks') {
    const trainable = getTrainableForNation(sim.playerNation, sim.epochIndex);
    const infantry = trainable.find((u) => u.type !== 'scout' && u.minEpoch === 0);
    const elite = trainable
      .filter((u) => u.minEpoch >= 1 && u.type !== 'general')
      .sort((a, b) => b.minEpoch - a.minEpoch)[0];
    cmds.push({ action: 'train-scout', label: 'Scout' });
    cmds.push({ action: 'train-infantry', label: infantry?.name ?? 'Infantry' });
    cmds.push({ action: 'train-elite', label: elite?.name ?? 'Elite', disabled: !elite });
    cmds.push({ action: 'train-wagon', label: 'Wagon' });
    cmds.push({ action: 'train-general', label: 'General', disabled: sim.research.military < 1 });
  }

  if (building?.type === 'market') {
    cmds.push({ action: 'trade-sell-food', label: 'Sell Food' });
    cmds.push({ action: 'trade-buy-metal', label: 'Buy Metal' });
    cmds.push({ action: 'trade-sell-timber', label: 'Sell Wood' });
    cmds.push({ action: 'trade-buy-timber', label: 'Buy Wood' });
  }

  return cmds;
}

function setCardHp(card: HTMLElement, pct: number) {
  const bar = card.querySelector('.hud-card-hp') as HTMLElement | null;
  const fill = card.querySelector('.hud-card-hp > i') as HTMLElement | null;
  if (!bar || !fill) return;
  const clamped = Math.max(0, Math.min(1, pct));
  fill.style.width = `${Math.round(clamped * 100)}%`;
  bar.classList.toggle('is-mid', clamped <= 0.5 && clamped > 0.25);
  bar.classList.toggle('is-low', clamped <= 0.25);
}
