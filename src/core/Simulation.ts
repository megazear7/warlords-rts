import { EntityId, createEntityId } from './types';
import { Vec3, distanceXZ } from './math';
import {
  NationId,
  getActiveBonuses,
  getEpoch,
  NATIONS,
} from '../data/nations';

export interface Unit {
  id: EntityId;
  position: Vec3;
  target?: Vec3;
  gatherTargetId?: EntityId;
  attackTargetId?: EntityId;
  attackBuildingId?: EntityId;
  speed: number;
  nation: NationId | string;
  type: string;
  hp: number;
  maxHp: number;
  attack: number;
  attackRange: number;
  attackCooldown: number;
  attackTimer: number;
  underAttrition?: boolean;
  carrying?: { type: 'food' | 'timber' | 'metal'; amount: number };
}

export interface Building {
  id: EntityId;
  position: Vec3;
  type: string;
  nation: NationId | string;
  hp: number;
  maxHp: number;
  productionTimer?: number;
  productionType?: string;
}

export interface ResourceNode {
  id: EntityId;
  position: Vec3;
  type: 'food' | 'timber' | 'metal';
  amount: number;
  maxAmount: number;
}

export interface Resources {
  food: number;
  timber: number;
  metal: number;
  wealth: number;
  knowledge: number;
}

export interface ResearchState {
  science: number;
  civic: number;
  military: number;
  commerce: number;
  current?: 'science' | 'civic' | 'military' | 'commerce';
  progress: number;
  timeRemaining: number;
}

const UNIT_STATS: Record<
  string,
  { hp: number; speed: number; attack: number; range: number; cooldown: number }
> = {
  citizen: { hp: 40, speed: 4, attack: 3, range: 1.5, cooldown: 1.2 },
  scout: { hp: 60, speed: 7, attack: 8, range: 2, cooldown: 1.0 },
  legionary: { hp: 120, speed: 3.5, attack: 18, range: 1.8, cooldown: 1.1 },
  supply_wagon: { hp: 80, speed: 3.2, attack: 0, range: 0, cooldown: 1 },
  enemy_warrior: { hp: 90, speed: 3.8, attack: 14, range: 1.8, cooldown: 1.15 },
};

const ATTRITION_DPS = 4;
const SUPPLY_RANGE = 14;
const WAGON_LINK_RANGE = 18;
const BUILDING_ATTACK_RANGE = 2.5;

export class Simulation {
  units: Map<EntityId, Unit> = new Map();
  buildings: Map<EntityId, Building> = new Map();
  resourceNodes: Map<EntityId, ResourceNode> = new Map();
  resources: Resources = {
    food: 200,
    timber: 200,
    metal: 80,
    wealth: 100,
    knowledge: 50,
  };

  research: ResearchState = {
    science: 0,
    civic: 0,
    military: 0,
    commerce: 0,
    progress: 0,
    timeRemaining: 0,
  };

  playerNation: NationId = 'rome';
  epochIndex = 0;

  selected: Set<EntityId> = new Set();
  selectedBuildingId: EntityId | null = null;
  time = 0;
  popCap = 30;
  cityLimit = 2;

  private aiTimer = 8;

  reset() {
    this.units.clear();
    this.buildings.clear();
    this.resourceNodes.clear();
    this.selected.clear();
    this.selectedBuildingId = null;
    this.resources = { food: 200, timber: 200, metal: 80, wealth: 100, knowledge: 50 };
    this.research = {
      science: 0,
      civic: 0,
      military: 0,
      commerce: 0,
      progress: 0,
      timeRemaining: 0,
    };
    this.time = 0;
    this.popCap = 30;
    this.cityLimit = 2;
    this.epochIndex = 0;
    this.aiTimer = 8;
  }

  getBonuses() {
    return getActiveBonuses(this.playerNation, this.epochIndex);
  }

  getCurrentEpochName(): string {
    return getEpoch(this.playerNation, this.epochIndex).name;
  }

  getTerritoryRadius(): number {
    const b = this.getBonuses();
    return b.territoryRadius + this.research.civic * 2;
  }

  isInFriendlyTerritory(pos: Vec3, nation: string = this.playerNation): boolean {
    const radius = nation === this.playerNation ? this.getTerritoryRadius() : 22;
    for (const b of this.buildings.values()) {
      if (b.type !== 'city_center' || b.nation !== nation) continue;
      if (distanceXZ(pos, b.position) <= radius) return true;
    }
    return false;
  }

  isSupplied(unit: Unit): boolean {
    if (this.isInFriendlyTerritory(unit.position, unit.nation)) return true;

    const wagons = [...this.units.values()].filter(
      (u) => u.nation === unit.nation && u.type === 'supply_wagon' && u.hp > 0
    );

    const reachable = new Set<EntityId>();
    const queue: Unit[] = [];

    for (const w of wagons) {
      if (distanceXZ(unit.position, w.position) <= SUPPLY_RANGE) {
        queue.push(w);
        reachable.add(w.id);
      }
    }

    while (queue.length) {
      const w = queue.shift()!;
      if (this.isInFriendlyTerritory(w.position, unit.nation)) return true;
      for (const other of wagons) {
        if (reachable.has(other.id)) continue;
        if (distanceXZ(w.position, other.position) <= WAGON_LINK_RANGE) {
          reachable.add(other.id);
          queue.push(other);
        }
      }
    }
    return false;
  }

  checkOutcome(): 'victory' | 'defeat' | null {
    let playerCities = 0;
    let enemyCities = 0;

    for (const b of this.buildings.values()) {
      if (b.type !== 'city_center') continue;
      if (b.nation === this.playerNation) playerCities++;
      else enemyCities++;
    }

    if (playerCities === 0) return 'defeat';
    if (enemyCities === 0) return 'victory';
    return null;
  }

  bootstrapDemoWorld(playerNation: NationId = 'rome') {
    this.playerNation = playerNation;
    this.epochIndex = 0;

    const enemyNation: NationId =
      playerNation === 'gaul' ? 'rome' : 'gaul';

    this.addBuilding('city_center', playerNation, { x: 0, y: 0, z: 0 }, 2000);

    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      this.spawnUnit('citizen', playerNation, {
        x: Math.cos(angle) * 8,
        y: 0,
        z: Math.sin(angle) * 8,
      });
    }
    this.spawnUnit('scout', playerNation, { x: 25, y: 0, z: 15 });
    this.spawnUnit('supply_wagon', playerNation, { x: 6, y: 0, z: -6 });

    this.addBuilding('city_center', enemyNation, { x: 55, y: 0, z: -40 }, 1500);
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      this.spawnUnit('enemy_warrior', enemyNation, {
        x: 55 + Math.cos(angle) * 6,
        y: 0,
        z: -40 + Math.sin(angle) * 6,
      });
    }
    this.spawnUnit('enemy_warrior', enemyNation, { x: 48, y: 0, z: -32 });

    this.spawnResourceNode('food', { x: 18, y: 0, z: -12 }, 300);
    this.spawnResourceNode('food', { x: -15, y: 0, z: 20 }, 280);
    this.spawnResourceNode('timber', { x: -22, y: 0, z: -8 }, 400);
    this.spawnResourceNode('timber', { x: 30, y: 0, z: 8 }, 350);
    this.spawnResourceNode('metal', { x: 12, y: 0, z: 28 }, 200);

    this.applyEpochPopCap();
  }

  private applyEpochPopCap() {
    const base = 30 + this.research.military * 10;
    this.popCap = base + this.getBonuses().popCapBonus;
  }

  private spawnUnit(type: string, nation: string, position: Vec3): EntityId {
    const stats = UNIT_STATS[type] ?? UNIT_STATS.citizen;
    const id = createEntityId();
    const attackMul = nation === this.playerNation ? this.getBonuses().attackMul : 1;
    this.units.set(id, {
      id,
      position: { ...position },
      speed: stats.speed,
      nation,
      type,
      hp: stats.hp,
      maxHp: stats.hp,
      attack: stats.attack * attackMul,
      attackRange: stats.range,
      attackCooldown: stats.cooldown,
      attackTimer: 0,
    });
    return id;
  }

  private addBuilding(type: string, nation: string, position: Vec3, hp: number): EntityId {
    const id = createEntityId();
    this.buildings.set(id, {
      id,
      position: { ...position },
      type,
      nation,
      hp,
      maxHp: hp,
    });
    return id;
  }

  private spawnResourceNode(
    type: 'food' | 'timber' | 'metal',
    position: Vec3,
    amount: number
  ) {
    const id = createEntityId();
    this.resourceNodes.set(id, {
      id,
      position: { ...position },
      type,
      amount,
      maxAmount: amount,
    });
  }

  step(dt: number) {
    this.time += dt;
    const bonuses = this.getBonuses();

    for (const b of this.buildings.values()) {
      if (b.nation !== this.playerNation) continue;
      if (b.type === 'farm') this.resources.food += 1.2 * dt * bonuses.gatherMul;
      if (b.type === 'city_center') {
        this.resources.knowledge += 0.4 * dt;
        this.resources.wealth += 0.3 * dt;
      }
      if (b.type === 'library') this.resources.knowledge += 1.5 * dt;
      if (b.productionTimer != null && b.productionTimer > 0) {
        b.productionTimer -= dt;
        if (b.productionTimer <= 0) this.finishProduction(b);
      }
    }

    if (this.research.current && this.research.timeRemaining > 0) {
      this.research.timeRemaining -= dt * bonuses.researchSpeedMul;
      this.research.progress = Math.min(
        1,
        1 - this.research.timeRemaining / this.researchTimeFor()
      );
      if (this.research.timeRemaining <= 0) this.completeResearch();
    }

    const toRemoveUnits: EntityId[] = [];
    const toRemoveBuildings: EntityId[] = [];

    for (const unit of this.units.values()) {
      unit.attackTimer = Math.max(0, unit.attackTimer - dt);
      if (unit.hp <= 0) {
        toRemoveUnits.push(unit.id);
        continue;
      }

      this.updateAttrition(unit, dt, bonuses.attritionResist);

      if (unit.attackTargetId || unit.attackBuildingId) {
        this.updateCombat(unit, dt);
        continue;
      }
      if (
        unit.nation === this.playerNation &&
        unit.type === 'citizen' &&
        unit.gatherTargetId
      ) {
        this.updateGathering(unit, dt, bonuses.gatherMul);
        continue;
      }
      if (!unit.target) continue;

      const dx = unit.target.x - unit.position.x;
      const dz = unit.target.z - unit.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 0.15) {
        unit.position.x = unit.target.x;
        unit.position.z = unit.target.z;
        unit.target = undefined;
        continue;
      }
      const step = Math.min(unit.speed * dt, dist);
      unit.position.x += (dx / dist) * step;
      unit.position.z += (dz / dist) * step;
    }

    for (const id of toRemoveUnits) {
      this.units.delete(id);
      this.selected.delete(id);
    }
    for (const id of toRemoveBuildings) this.buildings.delete(id);

    this.aiTimer -= dt;
    if (this.aiTimer <= 0) {
      this.aiTimer = 4 + Math.random() * 3;
      this.runSimpleAI();
    }
  }

  private updateAttrition(unit: Unit, dt: number, resist: number) {
    const friendly = this.isInFriendlyTerritory(unit.position, unit.nation);
    const supplied = friendly || this.isSupplied(unit);
    unit.underAttrition = !supplied;
    if (supplied) return;
    unit.hp -= ATTRITION_DPS * (1 - resist) * dt;
  }

  private updateCombat(unit: Unit, dt: number) {
    // Prefer unit target
    if (unit.attackTargetId) {
      const target = this.units.get(unit.attackTargetId);
      if (!target || target.hp <= 0 || target.nation === unit.nation) {
        unit.attackTargetId = undefined;
        return;
      }
      this.chaseAndStrike(unit, target.position, target.attackRange, dt, () => {
        target.hp -= unit.attack;
        if (
          !target.attackTargetId &&
          !target.attackBuildingId &&
          distanceXZ(target.position, unit.position) <= target.attackRange + 0.5
        ) {
          target.attackTargetId = unit.id;
        }
      });
      return;
    }

    // Building siege
    if (unit.attackBuildingId) {
      const b = this.buildings.get(unit.attackBuildingId);
      if (!b || b.nation === unit.nation) {
        unit.attackBuildingId = undefined;
        return;
      }
      this.chaseAndStrike(unit, b.position, BUILDING_ATTACK_RANGE, dt, () => {
        // Siege deals reduced damage vs buildings
        b.hp -= unit.attack * 0.65;
        if (b.hp <= 0) this.resolveBuildingDestroyed(b, unit.nation);
      });
    }
  }

  private chaseAndStrike(
    unit: Unit,
    targetPos: Vec3,
    range: number,
    dt: number,
    onHit: () => void
  ) {
    const dist = distanceXZ(unit.position, targetPos);
    if (dist > range) {
      unit.target = { ...targetPos };
      const dx = targetPos.x - unit.position.x;
      const dz = targetPos.z - unit.position.z;
      const step = Math.min(unit.speed * dt, dist);
      unit.position.x += (dx / dist) * step;
      unit.position.z += (dz / dist) * step;
      return;
    }
    unit.target = undefined;
    if (unit.attackTimer <= 0 && unit.attack > 0) {
      onHit();
      unit.attackTimer = unit.attackCooldown;
    }
  }

  /** Cities are captured, not destroyed. Other buildings are removed. */
  private resolveBuildingDestroyed(b: Building, capturerNation: string) {
    if (b.type === 'city_center') {
      b.nation = capturerNation;
      b.hp = b.maxHp * 0.4;
      // Clear siege orders targeting this building from former owners
      for (const u of this.units.values()) {
        if (u.attackBuildingId === b.id && u.nation !== capturerNation) {
          u.attackBuildingId = undefined;
        }
      }
      if (this.selectedBuildingId === b.id && capturerNation !== this.playerNation) {
        this.selectedBuildingId = null;
      }
    } else {
      this.buildings.delete(b.id);
      if (this.selectedBuildingId === b.id) this.selectedBuildingId = null;
      for (const u of this.units.values()) {
        if (u.attackBuildingId === b.id) u.attackBuildingId = undefined;
      }
    }
  }

  private updateGathering(unit: Unit, dt: number, gatherMul: number) {
    const node = this.resourceNodes.get(unit.gatherTargetId!);
    if (!node || node.amount <= 0) {
      unit.gatherTargetId = undefined;
      unit.target = undefined;
      return;
    }
    const dist = distanceXZ(unit.position, node.position);
    if (dist > 2.2) {
      unit.target = { ...node.position };
      const dx = node.position.x - unit.position.x;
      const dz = node.position.z - unit.position.z;
      const step = Math.min(unit.speed * dt, dist);
      unit.position.x += (dx / dist) * step;
      unit.position.z += (dz / dist) * step;
      return;
    }
    unit.target = undefined;
    const rate = 8 * gatherMul;
    const gathered = Math.min(rate * dt, node.amount);
    node.amount -= gathered;
    if (!unit.carrying || unit.carrying.type !== node.type) {
      unit.carrying = { type: node.type, amount: 0 };
    }
    unit.carrying.amount += gathered;
    if (unit.carrying.amount >= 15) {
      this.resources[unit.carrying.type] += unit.carrying.amount;
      unit.carrying = undefined;
    }
    if (node.amount <= 0) unit.gatherTargetId = undefined;
  }

  private runSimpleAI() {
    const enemies = [...this.units.values()].filter(
      (u) => u.nation !== this.playerNation && u.hp > 0 && u.type !== 'supply_wagon'
    );
    const players = [...this.units.values()].filter(
      (u) => u.nation === this.playerNation && u.hp > 0
    );
    const playerCities = [...this.buildings.values()].filter(
      (b) => b.nation === this.playerNation && b.type === 'city_center'
    );

    for (const a of enemies) {
      if (a.attackTargetId || a.attackBuildingId) continue;

      // Prefer nearby player units
      let nearestUnit: Unit | null = null;
      let bestU = Infinity;
      for (const p of players) {
        const d = distanceXZ(a.position, p.position);
        if (d < bestU) {
          bestU = d;
          nearestUnit = p;
        }
      }
      if (nearestUnit && bestU < 55) {
        a.attackTargetId = nearestUnit.id;
        continue;
      }

      // Otherwise siege nearest player city
      let nearestCity: Building | null = null;
      let bestC = Infinity;
      for (const c of playerCities) {
        const d = distanceXZ(a.position, c.position);
        if (d < bestC) {
          bestC = d;
          nearestCity = c;
        }
      }
      if (nearestCity && bestC < 80) {
        a.attackBuildingId = nearestCity.id;
      }
    }
  }

  private finishProduction(b: Building) {
    const type = b.productionType;
    b.productionTimer = undefined;
    b.productionType = undefined;
    if (!type) return;
    if (this.countPlayerUnits() >= this.popCap) return;
    this.spawnUnit(type, this.playerNation, {
      x: b.position.x + 3 + (Math.random() - 0.5) * 4,
      y: 0,
      z: b.position.z + 3,
    });
  }

  private countPlayerUnits(): number {
    let n = 0;
    for (const u of this.units.values()) if (u.nation === this.playerNation) n++;
    return n;
  }

  private countPlayerCities(): number {
    let n = 0;
    for (const b of this.buildings.values()) {
      if (b.nation === this.playerNation && b.type === 'city_center') n++;
    }
    return n;
  }

  private researchTimeFor(): number {
    const scienceBonus = 1 - this.research.science * 0.08;
    return 25 * Math.max(0.5, scienceBonus);
  }

  private completeResearch() {
    const track = this.research.current;
    if (!track) return;
    this.research[track] += 1;
    this.research.current = undefined;
    this.research.progress = 0;
    this.research.timeRemaining = 0;
    if (track === 'military') this.applyEpochPopCap();
    if (track === 'civic') this.cityLimit += 1;
  }

  clearSelection() {
    this.selected.clear();
    this.selectedBuildingId = null;
  }

  selectUnit(id: EntityId, additive = false) {
    if (!additive) {
      this.selected.clear();
      this.selectedBuildingId = null;
    }
    const u = this.units.get(id);
    if (u && u.nation === this.playerNation) this.selected.add(id);
  }

  selectUnits(ids: EntityId[], additive = false) {
    if (!additive) {
      this.selected.clear();
      this.selectedBuildingId = null;
    }
    for (const id of ids) {
      const u = this.units.get(id);
      if (u && u.nation === this.playerNation) this.selected.add(id);
    }
  }

  selectBuilding(id: EntityId) {
    this.selected.clear();
    const b = this.buildings.get(id);
    if (b && b.nation === this.playerNation) this.selectedBuildingId = id;
  }

  getSelectedUnits(): Unit[] {
    const result: Unit[] = [];
    for (const id of this.selected) {
      const u = this.units.get(id);
      if (u) result.push(u);
    }
    return result;
  }

  getSelectedBuilding(): Building | null {
    if (!this.selectedBuildingId) return null;
    return this.buildings.get(this.selectedBuildingId) ?? null;
  }

  orderMoveSelected(target: Vec3) {
    for (const id of this.selected) this.orderMove(id, target);
  }

  orderMove(unitId: EntityId, target: Vec3) {
    const unit = this.units.get(unitId);
    if (!unit) return;
    unit.target = { ...target };
    unit.gatherTargetId = undefined;
    unit.attackTargetId = undefined;
    unit.attackBuildingId = undefined;
  }

  orderGatherSelected(nodeId: EntityId) {
    const node = this.resourceNodes.get(nodeId);
    if (!node || node.amount <= 0) return;
    for (const id of this.selected) {
      const unit = this.units.get(id);
      if (!unit || unit.type !== 'citizen') continue;
      unit.gatherTargetId = nodeId;
      unit.attackTargetId = undefined;
      unit.attackBuildingId = undefined;
      unit.target = { ...node.position };
    }
  }

  orderAttackSelected(targetUnitId: EntityId) {
    const target = this.units.get(targetUnitId);
    if (!target || target.nation === this.playerNation) return;
    for (const id of this.selected) {
      const unit = this.units.get(id);
      if (!unit || unit.type === 'supply_wagon') continue;
      unit.attackTargetId = targetUnitId;
      unit.attackBuildingId = undefined;
      unit.gatherTargetId = undefined;
      unit.target = undefined;
    }
  }

  orderAttackBuildingSelected(buildingId: EntityId) {
    const b = this.buildings.get(buildingId);
    if (!b || b.nation === this.playerNation) return;
    for (const id of this.selected) {
      const unit = this.units.get(id);
      if (!unit || unit.type === 'supply_wagon') continue;
      unit.attackBuildingId = buildingId;
      unit.attackTargetId = undefined;
      unit.gatherTargetId = undefined;
      unit.target = undefined;
    }
  }

  private placeBuildingNearCitizens(
    type: string,
    costTimber: number,
    costWealth = 0
  ): boolean {
    const citizens = this.getSelectedUnits().filter((u) => u.type === 'citizen');
    if (citizens.length === 0) return false;
    if (this.resources.timber < costTimber) return false;
    if (this.resources.wealth < costWealth) return false;
    let ax = 0,
      az = 0;
    for (const c of citizens) {
      ax += c.position.x;
      az += c.position.z;
    }
    ax /= citizens.length;
    az /= citizens.length;
    const pos = {
      x: ax + 5 + Math.random() * 2,
      y: 0,
      z: az + 3 + Math.random() * 2,
    };
    this.resources.timber -= costTimber;
    this.resources.wealth -= costWealth;
    const hp = type === 'barracks' ? 800 : type === 'library' ? 600 : 400;
    this.addBuilding(type, this.playerNation, pos, hp);
    return true;
  }

  tryBuildFarm(): boolean {
    return this.placeBuildingNearCitizens('farm', 60);
  }
  tryBuildBarracks(): boolean {
    return this.placeBuildingNearCitizens('barracks', 100, 20);
  }
  tryBuildLibrary(): boolean {
    return this.placeBuildingNearCitizens('library', 80, 40);
  }

  tryFoundCity(): boolean {
    if (this.countPlayerCities() >= this.cityLimit) return false;
    const citizens = this.getSelectedUnits().filter((u) => u.type === 'citizen');
    if (citizens.length < 1) return false;
    if (this.resources.timber < 120 || this.resources.wealth < 50) return false;
    const c = citizens[0];
    for (const b of this.buildings.values()) {
      if (b.type === 'city_center' && b.nation === this.playerNation) {
        if (distanceXZ(c.position, b.position) < 25) return false;
      }
    }
    this.resources.timber -= 120;
    this.resources.wealth -= 50;
    this.addBuilding('city_center', this.playerNation, { ...c.position }, 1800);
    return true;
  }

  tryTrainLegionary(): boolean {
    const b = this.getSelectedBuilding();
    if (!b || b.type !== 'barracks') return false;
    if (b.productionTimer != null && b.productionTimer > 0) return false;
    if (this.countPlayerUnits() >= this.popCap) return false;
    if (this.resources.food < 60 || this.resources.metal < 20) return false;
    this.resources.food -= 60;
    this.resources.metal -= 20;
    b.productionType = 'legionary';
    b.productionTimer = 12;
    return true;
  }

  tryTrainSupplyWagon(): boolean {
    const b = this.getSelectedBuilding();
    if (!b || b.type !== 'barracks') return false;
    if (b.productionTimer != null && b.productionTimer > 0) return false;
    if (this.countPlayerUnits() >= this.popCap) return false;
    if (this.resources.timber < 40 || this.resources.food < 30) return false;
    this.resources.timber -= 40;
    this.resources.food -= 30;
    b.productionType = 'supply_wagon';
    b.productionTimer = 10;
    return true;
  }

  tryResearch(track: 'science' | 'civic' | 'military' | 'commerce'): boolean {
    const hasLibrary = [...this.buildings.values()].some(
      (b) => b.type === 'library' && b.nation === this.playerNation
    );
    if (!hasLibrary) return false;
    if (this.research.current) return false;
    const level = this.research[track];
    if (level >= 5) return false;
    const costKnowledge = 40 + level * 30;
    const costWealth = 20 + level * 15;
    if (this.resources.knowledge < costKnowledge || this.resources.wealth < costWealth)
      return false;
    this.resources.knowledge -= costKnowledge;
    this.resources.wealth -= costWealth;
    this.research.current = track;
    this.research.timeRemaining = this.researchTimeFor();
    this.research.progress = 0;
    return true;
  }

  tryAdvanceEpoch(): boolean {
    const epochs = NATIONS[this.playerNation].epochs;
    if (this.epochIndex >= epochs.length - 1) return false;
    const next = epochs[this.epochIndex + 1];
    if (this.resources.knowledge < next.knowledgeCost) return false;
    if (this.resources.wealth < next.wealthCost) return false;
    this.resources.knowledge -= next.knowledgeCost;
    this.resources.wealth -= next.wealthCost;
    this.epochIndex += 1;
    this.applyEpochPopCap();
    const mul = this.getBonuses().attackMul;
    for (const u of this.units.values()) {
      if (u.nation !== this.playerNation) continue;
      const base = UNIT_STATS[u.type]?.attack ?? u.attack;
      u.attack = base * mul;
    }
    return true;
  }

  getAllUnits(): Unit[] {
    return Array.from(this.units.values());
  }
  getAllBuildings(): Building[] {
    return Array.from(this.buildings.values());
  }
  getAllResourceNodes(): ResourceNode[] {
    return Array.from(this.resourceNodes.values());
  }
}
