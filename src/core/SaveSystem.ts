import { Simulation, Unit, Building, ResourceNode, Resources, ResearchState } from './Simulation';
import { EntityId } from './types';

export const SAVE_VERSION = 1;
export const SAVE_KEY_PREFIX = 'warlords_save_';
export const SAVE_SLOTS = 3;

export interface SaveSnapshot {
  version: number;
  timestamp: number;
  playTime: number;
  slotName: string;
  resources: Resources;
  research: ResearchState;
  popCap: number;
  cityLimit: number;
  time: number;
  units: Unit[];
  buildings: Building[];
  resourceNodes: ResourceNode[];
  selected: EntityId[];
  selectedBuildingId: EntityId | null;
}

export interface SaveSlotMeta {
  slot: number;
  exists: boolean;
  slotName: string;
  timestamp: number;
  playTime: number;
  resources?: { food: number; timber: number };
}

export class SaveSystem {
  static serialize(sim: Simulation, slotName = 'Save'): SaveSnapshot {
    return {
      version: SAVE_VERSION,
      timestamp: Date.now(),
      playTime: sim.time,
      slotName,
      resources: { ...sim.resources },
      research: { ...sim.research },
      popCap: sim.popCap,
      cityLimit: sim.cityLimit,
      time: sim.time,
      units: sim.getAllUnits().map((u) => ({ ...u, position: { ...u.position }, target: u.target ? { ...u.target } : undefined, carrying: u.carrying ? { ...u.carrying } : undefined })),
      buildings: sim.getAllBuildings().map((b) => ({ ...b, position: { ...b.position } })),
      resourceNodes: sim.getAllResourceNodes().map((n) => ({ ...n, position: { ...n.position } })),
      selected: [...sim.selected],
      selectedBuildingId: sim.selectedBuildingId,
    };
  }

  static apply(sim: Simulation, data: SaveSnapshot) {
    if (data.version !== SAVE_VERSION) {
      console.warn('Save version mismatch', data.version);
    }

    sim.units.clear();
    sim.buildings.clear();
    sim.resourceNodes.clear();
    sim.selected.clear();

    sim.resources = { ...data.resources };
    sim.research = { ...data.research };
    sim.popCap = data.popCap;
    sim.cityLimit = data.cityLimit;
    sim.time = data.time;
    sim.selectedBuildingId = data.selectedBuildingId;

    for (const u of data.units) {
      sim.units.set(u.id, {
        ...u,
        position: { ...u.position },
        target: u.target ? { ...u.target } : undefined,
        carrying: u.carrying ? { ...u.carrying } : undefined,
      });
    }
    for (const b of data.buildings) {
      sim.buildings.set(b.id, { ...b, position: { ...b.position } });
    }
    for (const n of data.resourceNodes) {
      sim.resourceNodes.set(n.id, { ...n, position: { ...n.position } });
    }
    for (const id of data.selected) {
      if (sim.units.has(id)) sim.selected.add(id);
    }
  }

  static saveToSlot(sim: Simulation, slot: number, slotName?: string): boolean {
    if (slot < 1 || slot > SAVE_SLOTS) return false;
    try {
      const snap = this.serialize(sim, slotName ?? `Save ${slot}`);
      localStorage.setItem(SAVE_KEY_PREFIX + slot, JSON.stringify(snap));
      return true;
    } catch (e) {
      console.error('Save failed', e);
      return false;
    }
  }

  static loadFromSlot(sim: Simulation, slot: number): boolean {
    if (slot < 1 || slot > SAVE_SLOTS) return false;
    try {
      const raw = localStorage.getItem(SAVE_KEY_PREFIX + slot);
      if (!raw) return false;
      const data = JSON.parse(raw) as SaveSnapshot;
      this.apply(sim, data);
      return true;
    } catch (e) {
      console.error('Load failed', e);
      return false;
    }
  }

  static deleteSlot(slot: number): void {
    localStorage.removeItem(SAVE_KEY_PREFIX + slot);
  }

  static listSlots(): SaveSlotMeta[] {
    const result: SaveSlotMeta[] = [];
    for (let i = 1; i <= SAVE_SLOTS; i++) {
      const raw = localStorage.getItem(SAVE_KEY_PREFIX + i);
      if (!raw) {
        result.push({ slot: i, exists: false, slotName: `Empty Slot ${i}`, timestamp: 0, playTime: 0 });
        continue;
      }
      try {
        const data = JSON.parse(raw) as SaveSnapshot;
        result.push({
          slot: i,
          exists: true,
          slotName: data.slotName || `Save ${i}`,
          timestamp: data.timestamp,
          playTime: data.playTime,
          resources: { food: data.resources.food, timber: data.resources.timber },
        });
      } catch {
        result.push({ slot: i, exists: false, slotName: `Corrupt Slot ${i}`, timestamp: 0, playTime: 0 });
      }
    }
    return result;
  }

  static hasAnySave(): boolean {
    return this.listSlots().some((s) => s.exists);
  }
}
