import { getUnitDef } from './units';

const ROME_PORTRAIT = '/portraits/roman-placeholder.png';
const GENERIC_PORTRAIT = '/portraits/general-placeholder.png';

const BUILDING_NAMES: Record<string, string> = {
  city_center: 'City Center',
  farm: 'Farm',
  barracks: 'Barracks',
  library: 'Library',
  tower: 'Watchtower',
  market: 'Market',
  wall: 'Wall',
};

const UNIT_NAMES: Record<string, string> = {
  citizen: 'Citizen',
  supply_wagon: 'Supply Wagon',
  enemy_warrior: 'Warrior',
};

export function portraitForNation(nation: string): string {
  return nation === 'rome' ? ROME_PORTRAIT : GENERIC_PORTRAIT;
}

export function buildingDisplayName(type: string): string {
  return BUILDING_NAMES[type] ?? type.replace(/_/g, ' ');
}

export function unitDisplayName(type: string): string {
  return getUnitDef(type)?.name ?? UNIT_NAMES[type] ?? type.replace(/_/g, ' ');
}
