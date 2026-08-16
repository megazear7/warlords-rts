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

export type { Unit, Building, ResourceNode, Resources, ResearchState } from './simTypes';

// PLACEHOLDER - full body follows in next commits if this truncates
export class Simulation {
  units: Map<EntityId, Unit> = new Map();
  buildings: Map<EntityId, Building> = new Map();
  resourceNodes: Map<EntityId, ResourceNode> = new Map();
  resources: Resources = { food: 200, timber: 200, metal: 80, wealth: 100, knowledge: 50 };
  research: ResearchState = { science: 0, civic: 0, military: 0, commerce: 0, progress: 0, timeRemaining: 0 };
  playerNation: NationId = 'rome';
  epochIndex = 0;
  selected: Set<EntityId> = new Set();
  selectedBuildingId: EntityId | null = null;
  controlGroups: Map<number, EntityId[]> = new Map();
  exploredCells: Set<string> = new Set();
  private exploreTimer = 0;
  time = 0;
  popCap = 30;
  cityLimit = 2;
  lastTrainComplete = false;
  aiFood = 180;
  aiTimber = 160;
  aiMetal = 60;
  aiTimer = 5;
  aiWaveTimer = 45;
  private ai = new SimulationAI(this);

  reset() {
    this.units.clear();
    this.buildings.clear();
    this.resourceNodes.clear();
    this.selected.clear();
    this.selectedBuildingId = null;
    this.exploredCells.clear();
    this.resources = { food: 200, timber: 200, metal: 80, wealth: 100, knowledge: 50 };
    this.research = { science: 0, civic: 0, military: 0, commerce: 0, progress: 0, timeRemaining: 0 };
    this.time = 0;
    this.popCap = 30;
    this.cityLimit = 2;
    this.epochIndex = 0;
    this.aiTimer = 5;
    this.aiWaveTimer = 45;
    this.aiFood = 180;
    this.aiTimber = 160;
    this.aiMetal = 60;
    this.lastTrainComplete = false;
  }

  getAllUnits(): Unit[] { return Array.from(this.units.values()); }
  getAllBuildings(): Building[] { return Array.from(this.buildings.values()); }
  getAllResourceNodes(): ResourceNode[] { return Array.from(this.resourceNodes.values()); }
  enemyNation(): string { return 'gaul'; }
  countBuildingsOf(_t: string, _n: string): number { return 0; }
  countUnitsOf(_n: string, _t?: string): number { return 0; }
  getEnemyCity(): Building | null { return null; }
  getPlayerCity(): Building | null { return null; }
  spawnUnit(_type: string, _nation: string, _pos: Vec3): EntityId { return createEntityId(); }
  addBuilding(_type: string, _nation: string, _pos: Vec3, _hp: number): EntityId { return createEntityId(); }
}
