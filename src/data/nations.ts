export type NationId = 'rome' | 'persia' | 'egypt' | 'gaul';

export interface EpochDef {
  id: string;
  name: string;
  /** Knowledge cost to advance INTO this epoch from the previous */
  knowledgeCost: number;
  wealthCost: number;
  /** Flat bonuses applied while in this epoch or later */
  bonuses: {
    attackMul?: number;
    gatherMul?: number;
    researchSpeedMul?: number;
    territoryRadius?: number;
    attritionResist?: number; // 0-1 damage reduction
    popCapBonus?: number;
  };
}

export interface NationDef {
  id: NationId;
  name: string;
  color: number;
  epochs: EpochDef[];
}

export const NATIONS: Record<NationId, NationDef> = {
  rome: {
    id: 'rome',
    name: 'Rome',
    color: 0xb22222,
    epochs: [
      {
        id: 'kingdom',
        name: 'Roman Kingdom',
        knowledgeCost: 0,
        wealthCost: 0,
        bonuses: { territoryRadius: 22 },
      },
      {
        id: 'republic',
        name: 'Republic',
        knowledgeCost: 80,
        wealthCost: 40,
        bonuses: { attackMul: 1.1, territoryRadius: 26, popCapBonus: 5 },
      },
      {
        id: 'empire',
        name: 'Empire',
        knowledgeCost: 140,
        wealthCost: 80,
        bonuses: {
          attackMul: 1.2,
          researchSpeedMul: 1.15,
          territoryRadius: 32,
          popCapBonus: 15,
        },
      },
      {
        id: 'dominate',
        name: 'Dominate',
        knowledgeCost: 220,
        wealthCost: 120,
        bonuses: {
          attackMul: 1.3,
          gatherMul: 1.15,
          territoryRadius: 38,
          attritionResist: 0.25,
          popCapBonus: 25,
        },
      },
    ],
  },
  persia: {
    id: 'persia',
    name: 'Persia',
    color: 0xc9a227,
    epochs: [
      {
        id: 'tribal',
        name: 'Iranian Tribes',
        knowledgeCost: 0,
        wealthCost: 0,
        bonuses: { territoryRadius: 24, gatherMul: 1.05 },
      },
      {
        id: 'achaemenid',
        name: 'Achaemenid Rise',
        knowledgeCost: 70,
        wealthCost: 50,
        bonuses: { territoryRadius: 30, gatherMul: 1.15, researchSpeedMul: 1.1 },
      },
      {
        id: 'imperial',
        name: 'Imperial Persia',
        knowledgeCost: 130,
        wealthCost: 90,
        bonuses: {
          territoryRadius: 38,
          gatherMul: 1.25,
          attackMul: 1.1,
          popCapBonus: 10,
        },
      },
      {
        id: 'king_of_kings',
        name: 'King of Kings',
        knowledgeCost: 200,
        wealthCost: 130,
        bonuses: {
          territoryRadius: 45,
          gatherMul: 1.35,
          researchSpeedMul: 1.2,
          attritionResist: 0.15,
          popCapBonus: 20,
        },
      },
    ],
  },
  egypt: {
    id: 'egypt',
    name: 'Egypt',
    color: 0x2e8b57,
    epochs: [
      {
        id: 'early',
        name: 'Early Dynastic',
        knowledgeCost: 0,
        wealthCost: 0,
        bonuses: { territoryRadius: 20, researchSpeedMul: 1.1 },
      },
      {
        id: 'old_kingdom',
        name: 'Old Kingdom',
        knowledgeCost: 75,
        wealthCost: 35,
        bonuses: { territoryRadius: 25, researchSpeedMul: 1.2, gatherMul: 1.1 },
      },
      {
        id: 'new_kingdom',
        name: 'New Kingdom',
        knowledgeCost: 135,
        wealthCost: 70,
        bonuses: {
          territoryRadius: 30,
          researchSpeedMul: 1.35,
          attackMul: 1.1,
          popCapBonus: 10,
        },
      },
      {
        id: 'ptolemaic',
        name: 'Ptolemaic Age',
        knowledgeCost: 210,
        wealthCost: 110,
        bonuses: {
          territoryRadius: 36,
          researchSpeedMul: 1.5,
          gatherMul: 1.2,
          attritionResist: 0.2,
          popCapBonus: 20,
        },
      },
    ],
  },
  gaul: {
    id: 'gaul',
    name: 'Gauls',
    color: 0x3d6b2a,
    epochs: [
      {
        id: 'tribal',
        name: 'Tribal Lands',
        knowledgeCost: 0,
        wealthCost: 0,
        bonuses: { territoryRadius: 20, attackMul: 1.05, attritionResist: 0.1 },
      },
      {
        id: 'confederation',
        name: 'Tribal Confederation',
        knowledgeCost: 65,
        wealthCost: 30,
        bonuses: {
          territoryRadius: 26,
          attackMul: 1.15,
          attritionResist: 0.2,
          gatherMul: 1.1,
        },
      },
      {
        id: 'high_chiefdom',
        name: 'High Chiefdom',
        knowledgeCost: 120,
        wealthCost: 60,
        bonuses: {
          territoryRadius: 32,
          attackMul: 1.25,
          attritionResist: 0.3,
          popCapBonus: 10,
        },
      },
      {
        id: 'gallic_empire',
        name: 'Gallic Empire',
        knowledgeCost: 190,
        wealthCost: 100,
        bonuses: {
          territoryRadius: 40,
          attackMul: 1.35,
          attritionResist: 0.4,
          gatherMul: 1.15,
          popCapBonus: 20,
        },
      },
    ],
  },
};

export function getEpoch(nation: NationId, index: number): EpochDef {
  const list = NATIONS[nation].epochs;
  return list[Math.min(index, list.length - 1)];
}

export function getActiveBonuses(nation: NationId, epochIndex: number) {
  // Merge bonuses from epoch 0..epochIndex (later overrides / stacks multiplicatively where noted)
  const epochs = NATIONS[nation].epochs.slice(0, epochIndex + 1);
  let attackMul = 1;
  let gatherMul = 1;
  let researchSpeedMul = 1;
  let territoryRadius = 20;
  let attritionResist = 0;
  let popCapBonus = 0;

  for (const e of epochs) {
    if (e.bonuses.attackMul) attackMul = e.bonuses.attackMul;
    if (e.bonuses.gatherMul) gatherMul = e.bonuses.gatherMul;
    if (e.bonuses.researchSpeedMul) researchSpeedMul = e.bonuses.researchSpeedMul;
    if (e.bonuses.territoryRadius) territoryRadius = e.bonuses.territoryRadius;
    if (e.bonuses.attritionResist) attritionResist = e.bonuses.attritionResist;
    if (e.bonuses.popCapBonus) popCapBonus = e.bonuses.popCapBonus;
  }

  return { attackMul, gatherMul, researchSpeedMul, territoryRadius, attritionResist, popCapBonus };
}
