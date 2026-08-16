import { EntityId } from './types';
import { Vec3 } from './math';
import { NationId } from '../data/nations';

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
  /** Move while auto-engaging enemies in acquisition range */
  attackMove?: boolean;
  carrying?: { type: 'food' | 'timber' | 'metal'; amount: number };
  /** Pathfinding waypoints; first element is the next immediate destination. */
  waypoints?: Vec3[];
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
  rallyPoint?: Vec3;
  /** Watchtower attack timer */
  attackTimer?: number;
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
