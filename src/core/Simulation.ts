import { EntityId, createEntityId } from './types';
import { Vec3, distanceXZ } from './math';
import {
  NationId,
  getActiveBonuses,
  getEpoch,
  NATIONS,
} from '../data/nations';
import { UNIT_STATS, getUnitDef, getTrainableForNation } from '../data/units';
import type {
  Unit,
  Building,
  ResourceNode,
  Resources,
  ResearchState,
} from './simTypes';
import { SimulationAI } from './simAI';
import { NavGrid } from './pathfinding';
import { executeTrade as _executeTrade, canTrade as _canTrade, type TradeResource } from '../data/market';
export { getExchangeRates } from '../data/market';
export type { TradeResource, ExchangeRates, TradeResult } from '../data/market';

export type { Unit, Building, ResourceNode, Resources, ResearchState } from './simTypes';

const ATTRITION_DPS = 4;
const SUPPLY_RANGE = 14;
const WAGON_LINK_RANGE = 18;
const BUILDING_ATTACK_RANGE = 2.5;
const CITIZEN_COST_FOOD = 50;
const CITIZEN_TRAIN_TIME = 8;
const TOWER_RANGE = 14;
const TOWER_DAMAGE = 12;
const TOWER_COOLDOWN = 1.2;
const ATTACK_MOVE_ACQUIRE = 12;
const SEPARATION_RADIUS = 1.35;
const SEPARATION_STRENGTH = 2.8;
const AURA_RADIUS = 12;
const AURA_ATTACK_MUL = 1.25;
const AURA_SPEED_MUL = 1.12;
const EXPLORED_CELL = 8; // world units per fog cell
const CITY_FOUNDING_COST_TIMBER = 120;
const CITY_FOUNDING_COST_WEALTH = 50;
const CITY_FOUNDING_MIN_DISTANCE = 25;
const CITY_FOUNDING_MAX_CITIES = 5;

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
  controlGroups: Map<number, EntityId[]> = new Map();
  /** Coarse explored fog cells "gx,gz" the player has ever seen */
  exploredCells: Set<string> = new Set();
  private exploreTimer = 0;

  time = 0;
  popCap = 30;
  cityLimit = CITY_FOUNDING_MAX_CITIES;

  lastTrainComplete = false;

  /** Abstract AI economy (not shown in HUD) */
  aiFood = 180;
  aiTimber = 160;
  aiMetal = 60;
  aiWealth = 100;
  aiKnowledge = 50;
  aiEpochIndex = 0;
  aiResearch = { science: 0, civic: 0, military: 0, commerce: 0 };
  // private aiPhase: 'build' | 'train' | 'attack' = 'build';
  aiTimer = 5;
  aiWaveTimer = 45;
  gameOver = false;
  private ai = new SimulationAI(this);
  /** Navigation grid for unit pathfinding. */
  readonly navGrid = new NavGrid();

  reset() {
    this.units.clear();
    this.buildings.clear();
    this.resourceNodes.clear();
    this.selected.clear();
    this.selectedBuildingId = null;
    this.controlGroups.clear();
    this.exploredCells.clear();
    this.exploreTimer = 0;
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
    this.cityLimit = CITY_FOUNDING_MAX_CITIES;
    this.epochIndex = 0;
    this.aiTimer = 5;
    this.aiWaveTimer = 45;
    this.aiFood = 180;
    this.aiTimber = 160;
    this.aiMetal = 60;
    this.aiWealth = 100;
    this.aiKnowledge = 50;
    this.aiEpochIndex = 0;
    this.aiResearch = { science: 0, civic: 0, military: 0, commerce: 0 };
    // this.aiPhase = 'build';
    this.lastTrainComplete = false;
    this.gameOver = false;
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

  getWealthIncomeRate(): number {
    const base = 0.3;
    const com = this.research.commerce;
    return base * (1 + com * 0.25);
  }

  isInFriendlyTerritory(pos: Vec3, nation: string = this.playerNation): boolean {
    const radius = nation === this.playerNation ? this.getTerritoryRadius() : 22;
    for (const b of this.buildings.values()) {
      if (b.type !== 'city_center' || b.nation !== nation) continue;
      if (distanceXZ(pos, b.position) <= radius) return true;
    }
    return false;
  }

  /** Vision radius by entity type (scout has superior vision) */
  getVisionRadius(entity: { type: string }): number {
    switch (entity.type) {
      case 'scout': return 22;
      case 'general': return 20;
      case 'tower': return 16;
      case 'city_center': return 18;
      case 'supply_wagon': return 10;
      case 'market':
      case 'library':
      case 'barracks':
      case 'farm': return 12;
      default: return 12;
    }
  }

  /** True if position is currently revealed by any player unit or building */
  isVisibleToPlayer(pos: Vec3): boolean {
    for (const u of this.units.values()) {
      if (u.nation !== this.playerNation || u.hp <= 0) continue;
      if (distanceXZ(pos, u.position) <= this.getVisionRadius(u)) return true;
    }
    for (const b of this.buildings.values()) {
      if (b.nation !== this.playerNation || b.hp <= 0) continue;
      if (distanceXZ(pos, b.position) <= this.getVisionRadius(b)) return true;
    }
    return false;
  }

  isExplored(pos: Vec3): boolean {
    const gx = Math.floor(pos.x / EXPLORED_CELL);
    const gz = Math.floor(pos.z / EXPLORED_CELL);
    return this.exploredCells.has(`${gx},${gz}`);
  }

  private markExploredAround() {
    const mark = (pos: Vec3, radius: number) => {
      const r = Math.ceil(radius / EXPLORED_CELL) + 1;
      const cx = Math.floor(pos.x / EXPLORED_CELL);
      const cz = Math.floor(pos.z / EXPLORED_CELL);
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          // approximate circle
          if (dx * dx + dz * dz <= r * r) {
            this.exploredCells.add(`${cx + dx},${cz + dz}`);
          }
        }
      }
    };
    for (const u of this.units.values()) {
      if (u.nation !== this.playerNation || u.hp <= 0) continue;
      mark(u.position, this.getVisionRadius(u));
    }
    for (const b of this.buildings.values()) {
      if (b.nation !== this.playerNation || b.hp <= 0) continue;
      mark(b.position, this.getVisionRadius(b));
    }
  }

  /** Apply general aura attack/speed multipliers to friendly units in range */
  private applyGeneralAuras() {
    const generals = [...this.units.values()].filter(
      (u) => u.type === 'general' && u.hp > 0
    );
    for (const unit of this.units.values()) {
      if (unit.hp <= 0 || unit.type === 'general' || unit.type === 'supply_wagon') continue;
      const base = UNIT_STATS[unit.type] ?? UNIT_STATS.citizen;
      let inAura = false;
      for (const g of generals) {
        if (g.nation !== unit.nation) continue;
        if (distanceXZ(unit.position, g.position) <= AURA_RADIUS) {
          inAura = true;
          break;
        }
      }
      const epochMul = unit.nation === this.playerNation ? this.getBonuses().attackMul : 1;
      if (inAura) {
        unit.attack = base.attack * epochMul * AURA_ATTACK_MUL;
        unit.speed = base.speed * AURA_SPEED_MUL;
        (unit as any).inAura = true;
      } else {
        unit.attack = base.attack * epochMul;
        unit.speed = base.speed;
        (unit as any).inAura = false;
      }
    }
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
    if (this.gameOver) return null;
    let playerCities = 0;
    let enemyCities = 0;
    for (const b of this.buildings.values()) {
      if (b.type !== 'city_center') continue;
      if (b.nation === this.playerNation) playerCities++;
      else enemyCities++;
    }
    if (playerCities === 0) { this.gameOver = true; return 'defeat'; }
    if (enemyCities === 0) { this.gameOver = true; return 'victory'; }
    return null;
  }

  bootstrapDemoWorld(playerNation: NationId = 'rome') {
    this.playerNation = playerNation;
    this.epochIndex = 0;
    const enemyNation: NationId = playerNation === 'gaul' ? 'rome' : 'gaul';

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

    // Reveal starting area
    this.markExploredAround();

    this.spawnResourceNode('food', { x: 18, y: 0, z: -12 }, 300);
    this.spawnResourceNode('food', { x: -15, y: 0, z: 20 }, 280);
    this.spawnResourceNode('timber', { x: -22, y: 0, z: -8 }, 400);
    this.spawnResourceNode('timber', { x: 30, y: 0, z: 8 }, 350);
    this.spawnResourceNode('metal', { x: 12, y: 0, z: 28 }, 200);
    // Enemy-side resources
    this.spawnResourceNode('food', { x: 48, y: 0, z: -28 }, 250);
    this.spawnResourceNode('timber', { x: 62, y: 0, z: -48 }, 300);

    this.applyEpochPopCap();
  }

  private applyEpochPopCap() {
    this.popCap = 30 + this.research.military * 10 + this.getBonuses().popCapBonus;
  }

  spawnUnit(type: string, nation: string, position: Vec3): EntityId {
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

  addBuilding(type: string, nation: string, position: Vec3, hp: number): EntityId {
    const id = createEntityId();
    const b: Building = {
      id,
      position: { ...position },
      type,
      nation,
      hp,
      maxHp: hp,
    };
    this.buildings.set(id, b);
    this.navGrid.markBuilding(b);
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
    this.lastTrainComplete = false;
    const bonuses = this.getBonuses();

    // Player economy + all production queues
    for (const b of this.buildings.values()) {
      if (b.nation === this.playerNation) {
        if (b.type === 'farm') this.resources.food += (1.2 + this.research.civic * 0.35) * dt * bonuses.gatherMul;
        if (b.type === 'city_center') {
          this.resources.knowledge += 0.4 * dt;
          this.resources.wealth += this.getWealthIncomeRate() * dt;
        }
        if (b.type === 'library') this.resources.knowledge += 1.5 * dt;
      }
      if (b.productionTimer != null && b.productionTimer > 0) {
        b.productionTimer -= dt;
        if (b.productionTimer <= 0) this.finishProduction(b);
      }
    }

    // Abstract AI income scales with farms / time
    const aiFarms = this.countBuildingsOf('farm', this.enemyNation());
    this.aiFood += (2.5 + aiFarms * 1.5) * dt;
    this.aiTimber += 1.8 * dt;
    this.aiMetal += 0.6 * dt;
    this.aiWealth += 0.8 * dt;
    this.aiKnowledge += 0.5 * dt;

    // Fog exploration + general auras
    this.exploreTimer += 1 / 20; // approx if fixed 20Hz
    if (this.exploreTimer >= 0.4) {
      this.exploreTimer = 0;
      this.markExploredAround();
    }
    this.applyGeneralAuras();

    // Watchtower auto-fire
    this.updateTowers(dt);

    if (this.research.current && this.research.timeRemaining > 0) {
      this.research.timeRemaining -= dt * bonuses.researchSpeedMul;
      this.research.progress = Math.min(
        1,
        1 - this.research.timeRemaining / this.researchTimeFor()
      );
      if (this.research.timeRemaining <= 0) this.completeResearch();
    }

    const toRemoveUnits: EntityId[] = [];
    const liveUnits = [...this.units.values()].filter((u) => u.hp > 0);

    for (const unit of this.units.values()) {
      unit.attackTimer = Math.max(0, unit.attackTimer - dt);
      if (unit.hp <= 0) {
        toRemoveUnits.push(unit.id);
        continue;
      }

      this.updateAttrition(unit, dt, bonuses.attritionResist);

      if (unit.attackMove && !unit.attackTargetId && !unit.attackBuildingId) {
        this.tryAcquireOnAttackMove(unit);
      }

      if (unit.attackTargetId || unit.attackBuildingId) {
        this.updateCombat(unit, dt);
      } else if (
        unit.nation === this.playerNation &&
        unit.type === 'citizen' &&
        unit.gatherTargetId
      ) {
        this.updateGathering(unit, dt, bonuses.gatherMul);
      } else if (unit.target) {
        this.moveToward(unit, unit.target, dt);
        if (unit.target && distanceXZ(unit.position, unit.target) < 0.15) {
          unit.position.x = unit.target.x;
          unit.position.z = unit.target.z;
          // Advance to next waypoint, if any
          if (unit.waypoints && unit.waypoints.length > 1) {
            unit.waypoints.pop(); // discard current (stored in reverse)
            unit.target = { ...unit.waypoints[unit.waypoints.length - 1] };
          } else {
            unit.waypoints = undefined;
            unit.target = undefined;
            unit.attackMove = false;
          }
        }
      }

      // Soft separation so armies don't perfectly stack
      this.applySeparation(unit, liveUnits, dt);
    }

    for (const id of toRemoveUnits) {
      this.units.delete(id);
      this.selected.delete(id);
      for (const [, ids] of this.controlGroups) {
        const idx = ids.indexOf(id);
        if (idx >= 0) ids.splice(idx, 1);
      }
    }

    this.aiTimer -= dt;
    this.aiWaveTimer -= dt;
    if (!this.gameOver && this.aiTimer <= 0) {
      this.aiTimer = 3.5 + Math.random() * 2.5;
      this.ai.run();
    }
  }

  private moveToward(unit: Unit, target: Vec3, dt: number) {
    const dx = target.x - unit.position.x;
    const dz = target.z - unit.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 0.001) return;
    const step = Math.min(unit.speed * dt, dist);
    unit.position.x += (dx / dist) * step;
    unit.position.z += (dz / dist) * step;
  }

  private applySeparation(unit: Unit, others: Unit[], dt: number) {
    let fx = 0;
    let fz = 0;
    let n = 0;
    for (const o of others) {
      if (o.id === unit.id || o.hp <= 0) continue;
      const d = distanceXZ(unit.position, o.position);
      if (d < 0.01 || d > SEPARATION_RADIUS) continue;
      const push = (SEPARATION_RADIUS - d) / SEPARATION_RADIUS;
      fx += ((unit.position.x - o.position.x) / d) * push;
      fz += ((unit.position.z - o.position.z) / d) * push;
      n++;
      if (n > 8) break; // cap neighbors checked
    }
    if (n === 0) return;
    unit.position.x += fx * SEPARATION_STRENGTH * dt;
    unit.position.z += fz * SEPARATION_STRENGTH * dt;
  }

  private updateAttrition(unit: Unit, dt: number, resist: number) {
    const friendly = this.isInFriendlyTerritory(unit.position, unit.nation);
    const supplied = friendly || this.isSupplied(unit);
    unit.underAttrition = !supplied;
    if (supplied) return;
    // AI gets slight attrition resist so they can siege
    const r = unit.nation === this.playerNation ? resist : Math.max(resist, 0.15);
    unit.hp -= ATTRITION_DPS * (1 - r) * dt;
  }

  private updateCombat(unit: Unit, dt: number) {
    if (unit.attackTargetId) {
      const target = this.units.get(unit.attackTargetId);
      if (!target || target.hp <= 0 || target.nation === unit.nation) {
        unit.attackTargetId = undefined;
        return;
      }
      this.chaseAndStrike(unit, target.position, unit.attackRange, dt, () => {
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

    if (unit.attackBuildingId) {
      const b = this.buildings.get(unit.attackBuildingId);
      if (!b || b.nation === unit.nation) {
        unit.attackBuildingId = undefined;
        return;
      }
      this.chaseAndStrike(unit, b.position, BUILDING_ATTACK_RANGE, dt, () => {
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
      unit.waypoints = undefined;
      unit.target = { ...targetPos };
      this.moveToward(unit, targetPos, dt);
      return;
    }
    unit.waypoints = undefined;
    unit.target = undefined;
    if (unit.attackTimer <= 0 && unit.attack > 0) {
      onHit();
      unit.attackTimer = unit.attackCooldown;
    }
  }

  private resolveBuildingDestroyed(b: Building, capturerNation: string) {
    if (b.type === 'city_center') {
      b.nation = capturerNation;
      b.hp = b.maxHp * 0.4;
      for (const u of this.units.values()) {
        if (u.attackBuildingId === b.id && u.nation !== capturerNation) {
          u.attackBuildingId = undefined;
        }
      }
      if (this.selectedBuildingId === b.id && capturerNation !== this.playerNation) {
        this.selectedBuildingId = null;
      }
    } else {
      this.navGrid.clearBuilding(b);
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
      this.moveToward(unit, node.position, dt);
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

  enemyNation(): string {
    for (const b of this.buildings.values()) {
      if (b.type === 'city_center' && b.nation !== this.playerNation) return b.nation as string;
    }
    for (const u of this.units.values()) {
      if (u.nation !== this.playerNation) return u.nation as string;
    }
    return 'gaul';
  }

  countBuildingsOf(type: string, nation: string): number {
    let n = 0;
    for (const b of this.buildings.values()) {
      if (b.type === type && b.nation === nation) n++;
    }
    return n;
  }

  countUnitsOf(nation: string, type?: string): number {
    let n = 0;
    for (const u of this.units.values()) {
      if (u.nation !== nation || u.hp <= 0) continue;
      if (type && u.type !== type) continue;
      n++;
    }
    return n;
  }

  getEnemyCity(): Building | null {
    for (const b of this.buildings.values()) {
      if (b.type === 'city_center' && b.nation !== this.playerNation) return b;
    }
    return null;
  }

  getPlayerCity(): Building | null {
    for (const b of this.buildings.values()) {
      if (b.type === 'city_center' && b.nation === this.playerNation) return b;
    }
    return null;
  }

  /** Stronger AI: economy → barracks → train → wave attacks with supply */



  private finishProduction(b: Building) {
    const type = b.productionType;
    b.productionTimer = undefined;
    b.productionType = undefined;
    if (!type) return;

    const isPlayer = b.nation === this.playerNation;
    if (isPlayer && this.countPlayerUnits() >= this.popCap) return;

    const spawnPos = {
      x: b.position.x + 3 + (Math.random() - 0.5) * 4,
      y: 0,
      z: b.position.z + 3,
    };
    const id = this.spawnUnit(type, b.nation as string, spawnPos);
    const unit = this.units.get(id);
    if (unit && b.rallyPoint) {
      unit.target = { ...b.rallyPoint };
    }
    if (isPlayer) this.lastTrainComplete = true;
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

  private countCitiesOf(nation: string): number {
    let n = 0;
    for (const b of this.buildings.values()) {
      if (b.nation === nation && b.type === 'city_center') n++;
    }
    return n;
  }

  private researchTimeFor(): number {
    return 25 * Math.max(0.5, 1 - this.research.science * 0.08);
  }

  private completeResearch() {
    const track = this.research.current;
    if (!track) return;
    this.research[track] += 1;
    this.research.current = undefined;
    this.research.progress = 0;
    this.research.timeRemaining = 0;
    if (track === 'military') this.applyEpochPopCap();
  }

  setControlGroup(slot: number) {
    if (slot < 0 || slot > 9) return;
    this.controlGroups.set(slot, [...this.selected]);
  }

  selectControlGroup(slot: number) {
    const ids = this.controlGroups.get(slot);
    if (!ids || ids.length === 0) return;
    this.selected.clear();
    this.selectedBuildingId = null;
    for (const id of ids) {
      if (this.units.has(id)) this.selected.add(id);
    }
  }

  selectAllOfType(type: string) {
    this.selected.clear();
    this.selectedBuildingId = null;
    for (const u of this.units.values()) {
      if (u.nation === this.playerNation && u.type === type) this.selected.add(u.id);
    }
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

  setRallyPoint(pos: Vec3): boolean {
    const b = this.getSelectedBuilding();
    if (!b) return false;
    if (b.type !== 'barracks' && b.type !== 'city_center') return false;
    b.rallyPoint = { ...pos };
    return true;
  }

  /** Simple formation offsets so multi-unit orders don't all stack on one point */
  private formationOffsets(count: number): { x: number; z: number }[] {
    if (count <= 1) return [{ x: 0, z: 0 }];
    const offsets: { x: number; z: number }[] = [];
    const cols = Math.ceil(Math.sqrt(count));
    const spacing = 1.6;
    let i = 0;
    for (let row = 0; i < count; row++) {
      for (let col = 0; col < cols && i < count; col++, i++) {
        offsets.push({
          x: (col - (cols - 1) / 2) * spacing,
          z: (row - (Math.ceil(count / cols) - 1) / 2) * spacing,
        });
      }
    }
    return offsets;
  }

  orderMoveSelected(target: Vec3) {
    const ids = [...this.selected];
    const offsets = this.formationOffsets(ids.length);
    ids.forEach((id, i) => {
      const o = offsets[i] || { x: 0, z: 0 };
      this.orderMove(id, { x: target.x + o.x, y: 0, z: target.z + o.z });
    });
  }

  orderMove(unitId: EntityId, target: Vec3) {
    const unit = this.units.get(unitId);
    if (!unit) return;
    unit.gatherTargetId = undefined;
    unit.attackTargetId = undefined;
    unit.attackBuildingId = undefined;
    unit.attackMove = false;
    this._assignPath(unit, target);
  }

  /** Compute a path from unit's position to target and store as waypoints.
   *  Falls back to straight-line (single waypoint) if pathfinding finds no route.
   *  Waypoints are stored in reverse order; use Array.pop() to advance. */
  private _assignPath(unit: Unit, target: Vec3) {
    const waypoints = this.navGrid.findPath(unit.position, target);
    if (waypoints.length > 0) {
      unit.waypoints = waypoints;
      unit.target = { ...waypoints[waypoints.length - 1] };
    } else {
      unit.waypoints = undefined;
      unit.target = { ...target };
    }
  }

  orderAttackMoveSelected(target: Vec3) {
    const ids = [...this.selected].filter((id) => {
      const u = this.units.get(id);
      return u && u.type !== 'supply_wagon' && u.type !== 'citizen';
    });
    const offsets = this.formationOffsets(ids.length);
    ids.forEach((id, i) => {
      const unit = this.units.get(id);
      if (!unit) return;
      const o = offsets[i] || { x: 0, z: 0 };
      const dest = { x: target.x + o.x, y: 0, z: target.z + o.z };
      unit.gatherTargetId = undefined;
      unit.attackTargetId = undefined;
      unit.attackBuildingId = undefined;
      unit.attackMove = true;
      this._assignPath(unit, dest);
    });
  }

  private tryAcquireOnAttackMove(unit: Unit) {
    let best: Unit | null = null;
    let bestD = ATTACK_MOVE_ACQUIRE;
    for (const o of this.units.values()) {
      if (o.nation === unit.nation || o.hp <= 0) continue;
      const d = distanceXZ(unit.position, o.position);
      if (d < bestD) {
        bestD = d;
        best = o;
      }
    }
    if (best) {
      unit.attackTargetId = best.id;
      return;
    }
    let bestB: Building | null = null;
    bestD = ATTACK_MOVE_ACQUIRE;
    for (const b of this.buildings.values()) {
      if (b.nation === unit.nation) continue;
      const d = distanceXZ(unit.position, b.position);
      if (d < bestD) {
        bestD = d;
        bestB = b;
      }
    }
    if (bestB) unit.attackBuildingId = bestB.id;
  }

  private updateTowers(dt: number) {
    for (const b of this.buildings.values()) {
      if (b.type !== 'tower' || b.hp <= 0) continue;
      b.attackTimer = (b.attackTimer ?? 0) - dt;
      if ((b.attackTimer ?? 0) > 0) continue;
      let best: Unit | null = null;
      let bestD = TOWER_RANGE;
      for (const u of this.units.values()) {
        if (u.nation === b.nation || u.hp <= 0) continue;
        const d = distanceXZ(b.position, u.position);
        if (d < bestD) {
          bestD = d;
          best = u;
        }
      }
      if (best) {
        best.hp -= TOWER_DAMAGE;
        b.attackTimer = TOWER_COOLDOWN;
      }
    }
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
      unit.waypoints = undefined;
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
      unit.waypoints = undefined;
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
      unit.waypoints = undefined;
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
    const hp =
      type === 'barracks' ? 800 : type === 'library' ? 600 : type === 'tower' ? 700 : type === 'market' ? 500 : type === 'wall' ? 1200 : 400;
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
  tryBuildTower(): boolean {
    if (this.research.military < 1) return false;
    return this.placeBuildingNearCitizens('tower', 80, 30);
  }
  tryBuildMarket(): boolean {
    if (this.research.commerce < 1) return false;
    return this.placeBuildingNearCitizens('market', 70, 25);
  }

  /** Defensive wall segment — requires Military research ≥ 2 */
  tryBuildWall(): boolean {
    if (this.research.military < 2) return false;
    return this.placeBuildingNearCitizens('wall', 40, 20);
  }

  /** Returns true if the player owns at least one market building. */
  hasPlayerMarket(): boolean {
    return [...this.buildings.values()].some(
      (b) => b.type === 'market' && b.nation === this.playerNation
    );
  }

  /**
   * Execute a market trade for the player.
   * `from`/`to` are resource keys or 'wealth'; `amount` is units of the `from` resource.
   * Returns true and mutates resources on success, false on failure.
   */
  executeTrade(from: TradeResource | 'wealth', to: TradeResource | 'wealth', amount: number): boolean {
    const r = this.resources as unknown as import('../data/market').TradeResources;
    const result = _executeTrade(r, from, to, amount, this.research.commerce, this.hasPlayerMarket());
    return result.ok;
  }

  /** Returns the reason the last checked trade would fail, or undefined if valid. */
  checkTrade(from: TradeResource | 'wealth', to: TradeResource | 'wealth', amount: number): string | undefined {
    const r = this.resources as unknown as import('../data/market').TradeResources;
    const result = _canTrade(r, from, to, amount, this.research.commerce, this.hasPlayerMarket());
    return result.ok ? undefined : result.reason;
  }

  /** Commerce trade: sell food for wealth (better rate with Commerce research) */
  trySellFood(amount = 50): boolean {
    return this.executeTrade('food', 'wealth', amount);
  }

  tryBuyMetal(amount = 20): boolean {
    return this.executeTrade('wealth', 'metal', amount);
  }

  private cityCivicRequirementForNext(currentCities: number): number {
    return currentCities;
  }

  getPlayerCityLimit(): number {
    const owned = this.countPlayerCities();
    const unlocked = Math.min(this.cityLimit, 1 + this.research.civic);
    return Math.max(owned, unlocked);
  }

  getCityFoundingCost() {
    return { timber: CITY_FOUNDING_COST_TIMBER, wealth: CITY_FOUNDING_COST_WEALTH };
  }

  getCityFoundingPrecheckFailure(): string | null {
    const citizens = this.getSelectedUnits().filter((u) => u.type === 'citizen');
    if (citizens.length < 1) return 'Select at least 1 citizen to found a city';
    const cityCount = this.countPlayerCities();
    const reason = this.cityFoundingValidation(
      cityCount,
      this.research.civic,
      this.resources.timber,
      this.resources.wealth
    );
    return reason;
  }

  getCityFoundingPlacementFailure(position: Vec3): string | null {
    const cityCount = this.countPlayerCities();
    return this.cityFoundingValidation(
      cityCount,
      this.research.civic,
      this.resources.timber,
      this.resources.wealth,
      position
    );
  }

  private cityFoundingValidation(
    cityCount: number,
    civicLevel: number,
    timber: number,
    wealth: number,
    position?: Vec3
  ): string | null {
    if (cityCount >= this.cityLimit) return `City cap reached (${this.cityLimit})`;
    const civicRequired = this.cityCivicRequirementForNext(cityCount);
    if (civicLevel < civicRequired) return `Need Civic ${civicRequired} to found city #${cityCount + 1}`;
    if (timber < CITY_FOUNDING_COST_TIMBER || wealth < CITY_FOUNDING_COST_WEALTH) {
      return `Need ${CITY_FOUNDING_COST_TIMBER} timber and ${CITY_FOUNDING_COST_WEALTH} wealth`;
    }
    if (!position) return null;
    if (!this.navGrid.canPlaceBuilding('city_center', position)) {
      return 'Invalid ground (blocked or outside map)';
    }
    for (const b of this.buildings.values()) {
      if (b.type !== 'city_center') continue;
      if (distanceXZ(position, b.position) < CITY_FOUNDING_MIN_DISTANCE) {
        return `Too close to an existing city (min ${CITY_FOUNDING_MIN_DISTANCE})`;
      }
    }
    return null;
  }

  tryFoundCityAt(position: Vec3): boolean {
    const citizens = this.getSelectedUnits().filter((u) => u.type === 'citizen');
    if (citizens.length < 1) return false;
    const reason = this.getCityFoundingPlacementFailure(position);
    if (reason) return false;
    this.resources.timber -= CITY_FOUNDING_COST_TIMBER;
    this.resources.wealth -= CITY_FOUNDING_COST_WEALTH;
    this.addBuilding('city_center', this.playerNation, { x: position.x, y: 0, z: position.z }, 1800);
    return true;
  }

  tryAIFoundCity(position: Vec3): boolean {
    const nation = this.enemyNation();
    const cityCount = this.countCitiesOf(nation);
    const reason = this.cityFoundingValidation(
      cityCount,
      this.aiResearch.civic,
      this.aiTimber,
      this.aiWealth,
      position
    );
    if (reason) return false;
    this.aiTimber -= CITY_FOUNDING_COST_TIMBER;
    this.aiWealth -= CITY_FOUNDING_COST_WEALTH;
    this.addBuilding('city_center', nation, { x: position.x, y: 0, z: position.z }, 1600);
    return true;
  }

  tryTrainCitizen(): boolean {
    const b = this.getSelectedBuilding();
    if (!b || b.type !== 'city_center') return false;
    if (b.productionTimer != null && b.productionTimer > 0) return false;
    if (this.countPlayerUnits() >= this.popCap) return false;
    if (this.resources.food < CITIZEN_COST_FOOD) return false;
    this.resources.food -= CITIZEN_COST_FOOD;
    b.productionType = 'citizen';
    b.productionTimer = CITIZEN_TRAIN_TIME;
    return true;
  }

  tryTrainUnit(type: string): boolean {
    const b = this.getSelectedBuilding();
    if (!b || b.type !== 'barracks') return false;
    if (b.productionTimer != null && b.productionTimer > 0) return false;
    if (this.countPlayerUnits() >= this.popCap) return false;

    if (type === 'supply_wagon') {
      if (this.resources.timber < 40 || this.resources.food < 30) return false;
      this.resources.timber -= 40;
      this.resources.food -= 30;
      b.productionType = 'supply_wagon';
      b.productionTimer = 10;
      return true;
    }

    const def = getUnitDef(type);
    if (!def) return false;
    if (def.minEpoch > this.epochIndex) return false;
    if (def.nations && !def.nations.includes(this.playerNation)) return false;
    if (this.resources.food < def.costFood) return false;
    if (this.resources.metal < def.costMetal) return false;
    if ((def.costTimber ?? 0) > this.resources.timber) return false;

    this.resources.food -= def.costFood;
    this.resources.metal -= def.costMetal;
    if (def.costTimber) this.resources.timber -= def.costTimber;

    b.productionType = type;
    b.productionTimer = def.trainTime;
    return true;
  }

  tryTrainLegionary(): boolean {
    const list = getTrainableForNation(this.playerNation, this.epochIndex).filter(
      (u) => u.type !== 'scout' && u.minEpoch === 0
    );
    const primary = list[0]?.type ?? 'legionary';
    return this.tryTrainUnit(primary);
  }

  tryTrainElite(): boolean {
    const elites = getTrainableForNation(this.playerNation, this.epochIndex).filter(
      (u) => u.minEpoch >= 1 && u.type !== 'general'
    );
    if (elites.length === 0) return false;
    elites.sort((a, b) => b.minEpoch - a.minEpoch);
    return this.tryTrainUnit(elites[0].type);
  }

  tryTrainSupplyWagon(): boolean {
    return this.tryTrainUnit('supply_wagon');
  }

  tryTrainScout(): boolean {
    return this.tryTrainUnit('scout');
  }

  tryTrainGeneral(): boolean {
    if (this.research.military < 1) return false;
    // Limit: max 2 generals for player
    const count = [...this.units.values()].filter(
      (u) => u.nation === this.playerNation && u.type === 'general' && u.hp > 0
    ).length;
    if (count >= 2) return false;
    return this.tryTrainUnit('general');
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

  canAdvanceEpoch(): boolean {
    const epochs = NATIONS[this.playerNation].epochs;
    if (this.epochIndex >= epochs.length - 1) return false;
    const next = epochs[this.epochIndex + 1];
    return (
      this.resources.knowledge >= next.knowledgeCost &&
      this.resources.wealth >= next.wealthCost
    );
  }

  getNextEpochDef() {
    const epochs = NATIONS[this.playerNation].epochs;
    if (this.epochIndex >= epochs.length - 1) return null;
    return epochs[this.epochIndex + 1];
  }

  tryAIAdvanceEpoch(): boolean {
    // Only advance if there is still an active enemy city
    const hasEnemyCity = [...this.buildings.values()].some(
      (b) => b.type === 'city_center' && b.nation !== this.playerNation
    );
    if (!hasEnemyCity) return false;
    const nation = this.enemyNation() as NationId;
    const epochs = NATIONS[nation]?.epochs;
    if (!epochs) return false;
    if (this.aiEpochIndex >= epochs.length - 1) return false;
    const next = epochs[this.aiEpochIndex + 1];
    if (this.aiKnowledge < next.knowledgeCost) return false;
    if (this.aiWealth < next.wealthCost) return false;
    this.aiKnowledge -= next.knowledgeCost;
    this.aiWealth -= next.wealthCost;
    this.aiEpochIndex += 1;
    // Apply updated attack multiplier to all existing AI units
    const mul = getActiveBonuses(nation, this.aiEpochIndex).attackMul;
    for (const u of this.units.values()) {
      if (u.nation !== nation) continue;
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
