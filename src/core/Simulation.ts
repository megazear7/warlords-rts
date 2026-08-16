import { EntityId, createEntityId } from './types';
import { Vec3, distanceXZ } from './math';

export interface Unit {
  id: EntityId;
  position: Vec3;
  target?: Vec3;
  gatherTargetId?: EntityId;
  attackTargetId?: EntityId;
  speed: number;
  nation: string;
  type: string;
  hp: number;
  maxHp: number;
  attack: number;
  attackRange: number;
  attackCooldown: number;
  attackTimer: number;
  carrying?: { type: 'food' | 'timber' | 'metal'; amount: number };
}

export interface Building {
  id: EntityId;
  position: Vec3;
  type: string;
  nation: string;
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

const UNIT_STATS: Record<string, { hp: number; speed: number; attack: number; range: number; cooldown: number }> = {
  citizen: { hp: 40, speed: 4, attack: 3, range: 1.5, cooldown: 1.2 },
  scout: { hp: 60, speed: 7, attack: 8, range: 2, cooldown: 1.0 },
  legionary: { hp: 120, speed: 3.5, attack: 18, range: 1.8, cooldown: 1.1 },
  enemy_warrior: { hp: 90, speed: 3.8, attack: 14, range: 1.8, cooldown: 1.15 },
};

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
    this.research = { science: 0, civic: 0, military: 0, commerce: 0, progress: 0, timeRemaining: 0 };
    this.time = 0;
    this.popCap = 30;
    this.cityLimit = 2;
    this.aiTimer = 8;
  }

  /**
   * Defeat: no player city centers remain.
   * Victory: all enemy units defeated (empty enemy cities are auto-captured).
   */
  checkOutcome(): 'victory' | 'defeat' | null {
    let playerCities = 0;
    let enemyUnits = 0;

    for (const b of this.buildings.values()) {
      if (b.type === 'city_center' && b.nation === 'rome') playerCities++;
    }
    for (const u of this.units.values()) {
      if (u.nation !== 'rome' && u.hp > 0) enemyUnits++;
    }

    if (playerCities === 0) return 'defeat';

    // Auto-capture undefended enemy cities
    if (enemyUnits === 0) {
      for (const b of this.buildings.values()) {
        if (b.nation !== 'rome') b.nation = 'rome';
      }
      return 'victory';
    }

    return null;
  }

  bootstrapDemoWorld() {
    this.addBuilding('city_center', 'rome', { x: 0, y: 0, z: 0 }, 2000);

    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      this.spawnUnit('citizen', 'rome', {
        x: Math.cos(angle) * 8,
        y: 0,
        z: Math.sin(angle) * 8,
      });
    }
    this.spawnUnit('scout', 'rome', { x: 25, y: 0, z: 15 });

    this.addBuilding('city_center', 'gaul', { x: 55, y: 0, z: -40 }, 1500);
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      this.spawnUnit('enemy_warrior', 'gaul', {
        x: 55 + Math.cos(angle) * 6,
        y: 0,
        z: -40 + Math.sin(angle) * 6,
      });
    }
    this.spawnUnit('enemy_warrior', 'gaul', { x: 48, y: 0, z: -32 });

    this.spawnResourceNode('food', { x: 18, y: 0, z: -12 }, 300);
    this.spawnResourceNode('food', { x: -15, y: 0, z: 20 }, 280);
    this.spawnResourceNode('timber', { x: -22, y: 0, z: -8 }, 400);
    this.spawnResourceNode('timber', { x: 30, y: 0, z: 8 }, 350);
    this.spawnResourceNode('metal', { x: 12, y: 0, z: 28 }, 200);
  }

  private spawnUnit(type: string, nation: string, position: Vec3): EntityId {
    const stats = UNIT_STATS[type] ?? UNIT_STATS.citizen;
    const id = createEntityId();
    this.units.set(id, {
      id,
      position: { ...position },
      speed: stats.speed,
      nation,
      type,
      hp: stats.hp,
      maxHp: stats.hp,
      attack: stats.attack,
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

  private spawnResourceNode(type: 'food' | 'timber' | 'metal', position: Vec3, amount: number) {
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

    for (const b of this.buildings.values()) {
      if (b.nation !== 'rome') continue;
      if (b.type === 'farm') this.resources.food += 1.2 * dt;
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
      this.research.timeRemaining -= dt;
      const total = this.researchTimeFor();
      this.research.progress = 1 - this.research.timeRemaining / total;
      if (this.research.timeRemaining <= 0) this.completeResearch();
    }

    const toRemove: EntityId[] = [];

    for (const unit of this.units.values()) {
      unit.attackTimer = Math.max(0, unit.attackTimer - dt);
      if (unit.hp <= 0) {
        toRemove.push(unit.id);
        continue;
      }
      if (unit.attackTargetId) {
        this.updateCombat(unit, dt);
        continue;
      }
      if (unit.nation === 'rome' && unit.type === 'citizen' && unit.gatherTargetId) {
        this.updateGathering(unit, dt);
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

    for (const id of toRemove) {
      this.units.delete(id);
      this.selected.delete(id);
    }

    this.aiTimer -= dt;
    if (this.aiTimer <= 0) {
      this.aiTimer = 5 + Math.random() * 4;
      this.runSimpleAI();
    }
  }

  private updateCombat(unit: Unit, dt: number) {
    const target = this.units.get(unit.attackTargetId!);
    if (!target || target.hp <= 0 || target.nation === unit.nation) {
      unit.attackTargetId = undefined;
      return;
    }
    const dist = distanceXZ(unit.position, target.position);
    if (dist > unit.attackRange) {
      unit.target = { ...target.position };
      const dx = target.position.x - unit.position.x;
      const dz = target.position.z - unit.position.z;
      const step = Math.min(unit.speed * dt, dist);
      unit.position.x += (dx / dist) * step;
      unit.position.z += (dz / dist) * step;
      return;
    }
    unit.target = undefined;
    if (unit.attackTimer <= 0) {
      target.hp -= unit.attack;
      unit.attackTimer = unit.attackCooldown;
      if (!target.attackTargetId && distanceXZ(target.position, unit.position) <= target.attackRange + 0.5) {
        target.attackTargetId = unit.id;
      }
    }
  }

  private updateGathering(unit: Unit, dt: number) {
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
    const rate = 8;
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
    const enemies = [...this.units.values()].filter((u) => u.nation === 'gaul' && u.hp > 0);
    const players = [...this.units.values()].filter((u) => u.nation === 'rome' && u.hp > 0);
    if (enemies.length === 0 || players.length === 0) return;
    const attackers = enemies.filter((e) => !e.attackTargetId).slice(0, 2);
    for (const a of attackers) {
      let nearest: Unit | null = null;
      let best = Infinity;
      for (const p of players) {
        const d = distanceXZ(a.position, p.position);
        if (d < best) {
          best = d;
          nearest = p;
        }
      }
      if (nearest && best < 70) a.attackTargetId = nearest.id;
    }
  }

  private finishProduction(b: Building) {
    const type = b.productionType;
    b.productionTimer = undefined;
    b.productionType = undefined;
    if (!type) return;
    if (this.countPlayerUnits() >= this.popCap) return;
    this.spawnUnit(type, 'rome', {
      x: b.position.x + 3 + (Math.random() - 0.5) * 4,
      y: 0,
      z: b.position.z + 3,
    });
  }

  private countPlayerUnits(): number {
    let n = 0;
    for (const u of this.units.values()) if (u.nation === 'rome') n++;
    return n;
  }

  private countPlayerCities(): number {
    let n = 0;
    for (const b of this.buildings.values()) {
      if (b.nation === 'rome' && b.type === 'city_center') n++;
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
    if (track === 'military') this.popCap += 10;
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
    if (u && u.nation === 'rome') this.selected.add(id);
  }

  selectUnits(ids: EntityId[], additive = false) {
    if (!additive) {
      this.selected.clear();
      this.selectedBuildingId = null;
    }
    for (const id of ids) {
      const u = this.units.get(id);
      if (u && u.nation === 'rome') this.selected.add(id);
    }
  }

  selectBuilding(id: EntityId) {
    this.selected.clear();
    const b = this.buildings.get(id);
    if (b && b.nation === 'rome') this.selectedBuildingId = id;
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
  }

  orderGatherSelected(nodeId: EntityId) {
    const node = this.resourceNodes.get(nodeId);
    if (!node || node.amount <= 0) return;
    for (const id of this.selected) {
      const unit = this.units.get(id);
      if (!unit || unit.type !== 'citizen') continue;
      unit.gatherTargetId = nodeId;
      unit.attackTargetId = undefined;
      unit.target = { ...node.position };
    }
  }

  orderAttackSelected(targetUnitId: EntityId) {
    const target = this.units.get(targetUnitId);
    if (!target || target.nation === 'rome') return;
    for (const id of this.selected) {
      const unit = this.units.get(id);
      if (!unit) continue;
      unit.attackTargetId = targetUnitId;
      unit.gatherTargetId = undefined;
      unit.target = undefined;
    }
  }

  private placeBuildingNearCitizens(type: string, costTimber: number, costWealth = 0): boolean {
    const citizens = this.getSelectedUnits().filter((u) => u.type === 'citizen');
    if (citizens.length === 0) return false;
    if (this.resources.timber < costTimber) return false;
    if (this.resources.wealth < costWealth) return false;
    let ax = 0, az = 0;
    for (const c of citizens) {
      ax += c.position.x;
      az += c.position.z;
    }
    ax /= citizens.length;
    az /= citizens.length;
    const pos = { x: ax + 5 + Math.random() * 2, y: 0, z: az + 3 + Math.random() * 2 };
    this.resources.timber -= costTimber;
    this.resources.wealth -= costWealth;
    const hp = type === 'barracks' ? 800 : type === 'library' ? 600 : 400;
    this.addBuilding(type, 'rome', pos, hp);
    return true;
  }

  tryBuildFarm(): boolean { return this.placeBuildingNearCitizens('farm', 60); }
  tryBuildBarracks(): boolean { return this.placeBuildingNearCitizens('barracks', 100, 20); }
  tryBuildLibrary(): boolean { return this.placeBuildingNearCitizens('library', 80, 40); }

  tryFoundCity(): boolean {
    if (this.countPlayerCities() >= this.cityLimit) return false;
    const citizens = this.getSelectedUnits().filter((u) => u.type === 'citizen');
    if (citizens.length < 1) return false;
    const costTimber = 120;
    const costWealth = 50;
    if (this.resources.timber < costTimber || this.resources.wealth < costWealth) return false;
    const c = citizens[0];
    for (const b of this.buildings.values()) {
      if (b.type === 'city_center' && b.nation === 'rome') {
        if (distanceXZ(c.position, b.position) < 25) return false;
      }
    }
    this.resources.timber -= costTimber;
    this.resources.wealth -= costWealth;
    this.addBuilding('city_center', 'rome', { ...c.position }, 1800);
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

  tryResearch(track: 'science' | 'civic' | 'military' | 'commerce'): boolean {
    const hasLibrary = [...this.buildings.values()].some((b) => b.type === 'library' && b.nation === 'rome');
    if (!hasLibrary) return false;
    if (this.research.current) return false;
    const level = this.research[track];
    if (level >= 5) return false;
    const costKnowledge = 40 + level * 30;
    const costWealth = 20 + level * 15;
    if (this.resources.knowledge < costKnowledge || this.resources.wealth < costWealth) return false;
    this.resources.knowledge -= costKnowledge;
    this.resources.wealth -= costWealth;
    this.research.current = track;
    this.research.timeRemaining = this.researchTimeFor();
    this.research.progress = 0;
    return true;
  }

  getAllUnits(): Unit[] { return Array.from(this.units.values()); }
  getAllBuildings(): Building[] { return Array.from(this.buildings.values()); }
  getAllResourceNodes(): ResourceNode[] { return Array.from(this.resourceNodes.values()); }
}
