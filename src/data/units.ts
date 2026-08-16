import { NationId } from './nations';

export interface UnitDef {
  type: string;
  name: string;
  /** Minimum player epoch index required (0-based) */
  minEpoch: number;
  hp: number;
  speed: number;
  attack: number;
  range: number;
  cooldown: number;
  costFood: number;
  costMetal: number;
  costTimber?: number;
  trainTime: number;
  /** Nations that can train this unit (empty = all) */
  nations?: NationId[];
}

/** Shared + nation-unique military units trainable from Barracks */
export const TRAINABLE_UNITS: UnitDef[] = [
  {
    type: 'scout',
    name: 'Scout',
    minEpoch: 0,
    hp: 60,
    speed: 7,
    attack: 8,
    range: 2,
    cooldown: 1.0,
    costFood: 40,
    costMetal: 0,
    trainTime: 8,
  },
  {
    type: 'legionary',
    name: 'Legionary',
    minEpoch: 0,
    hp: 120,
    speed: 3.5,
    attack: 18,
    range: 1.8,
    cooldown: 1.1,
    costFood: 60,
    costMetal: 20,
    trainTime: 12,
    nations: ['rome'],
  },
  {
    type: 'praetorian',
    name: 'Praetorian',
    minEpoch: 2,
    hp: 160,
    speed: 3.6,
    attack: 24,
    range: 1.9,
    cooldown: 1.0,
    costFood: 80,
    costMetal: 40,
    trainTime: 16,
    nations: ['rome'],
  },
  {
    type: 'immortal',
    name: 'Immortal',
    minEpoch: 1,
    hp: 110,
    speed: 3.8,
    attack: 20,
    range: 2.0,
    cooldown: 1.05,
    costFood: 55,
    costMetal: 25,
    trainTime: 12,
    nations: ['persia'],
  },
  {
    type: 'cataphract',
    name: 'Cataphract',
    minEpoch: 2,
    hp: 180,
    speed: 5.0,
    attack: 28,
    range: 1.7,
    cooldown: 1.2,
    costFood: 90,
    costMetal: 50,
    trainTime: 18,
    nations: ['persia'],
  },
  {
    type: 'spearman',
    name: 'Spearman',
    minEpoch: 0,
    hp: 100,
    speed: 3.4,
    attack: 16,
    range: 2.2,
    cooldown: 1.15,
    costFood: 50,
    costMetal: 15,
    trainTime: 11,
    nations: ['egypt'],
  },
  {
    type: 'chariot',
    name: 'War Chariot',
    minEpoch: 2,
    hp: 140,
    speed: 6.0,
    attack: 22,
    range: 2.5,
    cooldown: 1.1,
    costFood: 70,
    costMetal: 35,
    costTimber: 20,
    trainTime: 15,
    nations: ['egypt'],
  },
  {
    type: 'swordsman',
    name: 'Gallic Swordsman',
    minEpoch: 0,
    hp: 105,
    speed: 3.9,
    attack: 19,
    range: 1.8,
    cooldown: 1.05,
    costFood: 55,
    costMetal: 15,
    trainTime: 11,
    nations: ['gaul'],
  },
  {
    type: 'fanatic',
    name: 'Fanatic',
    minEpoch: 2,
    hp: 90,
    speed: 4.5,
    attack: 30,
    range: 1.6,
    cooldown: 0.9,
    costFood: 45,
    costMetal: 10,
    trainTime: 10,
    nations: ['gaul'],
  },
  {
    type: 'general',
    name: 'General',
    minEpoch: 1,
    hp: 200,
    speed: 4.2,
    attack: 22,
    range: 2.0,
    cooldown: 1.0,
    costFood: 120,
    costMetal: 80,
    trainTime: 20,
  },
];

export function getUnitDef(type: string): UnitDef | undefined {
  return TRAINABLE_UNITS.find((u) => u.type === type);
}

export function getTrainableForNation(nation: NationId, epochIndex: number): UnitDef[] {
  return TRAINABLE_UNITS.filter((u) => {
    if (u.minEpoch > epochIndex) return false;
    if (u.nations && !u.nations.includes(nation)) return false;
    return true;
  });
}

/** Stats lookup used by Simulation spawn (includes non-trainable types) */
export const UNIT_STATS: Record<
  string,
  { hp: number; speed: number; attack: number; range: number; cooldown: number }
> = {
  citizen: { hp: 40, speed: 4, attack: 3, range: 1.5, cooldown: 1.2 },
  supply_wagon: { hp: 80, speed: 3.2, attack: 0, range: 0, cooldown: 1 },
  enemy_warrior: { hp: 90, speed: 3.8, attack: 14, range: 1.8, cooldown: 1.15 },
};

for (const u of TRAINABLE_UNITS) {
  UNIT_STATS[u.type] = {
    hp: u.hp,
    speed: u.speed,
    attack: u.attack,
    range: u.range,
    cooldown: u.cooldown,
  };
}
