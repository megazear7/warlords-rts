import type { Simulation } from './Simulation';
import type { Unit } from './simTypes';
import { distanceXZ } from './math';

/**
 * AI opponent logic — extracted so Simulation.ts stays smaller / pushable.
 */
export class SimulationAI {
  constructor(private sim: Simulation) {}

  run(): void {
    const s = this.sim;
    const nation = s.enemyNation();
    const city = s.getEnemyCity();
    if (!city) return;

    // Attempt epoch advance when affordable
    s.tryAIAdvanceEpoch();

    // 1) Farms
    if (s.countBuildingsOf('farm', nation) < 2 && s.aiTimber >= 60) {
      s.aiTimber -= 60;
      const ang = Math.random() * Math.PI * 2;
      s.addBuilding(
        'farm',
        nation,
        {
          x: city.position.x + Math.cos(ang) * 10,
          y: 0,
          z: city.position.z + Math.sin(ang) * 10,
        },
        400
      );
      return;
    }

    // 2) Barracks
    if (s.countBuildingsOf('barracks', nation) < 1 && s.aiTimber >= 100) {
      s.aiTimber -= 100;
      s.addBuilding(
        'barracks',
        nation,
        {
          x: city.position.x - 8,
          y: 0,
          z: city.position.z + 6,
        },
        800
      );
      return;
    }

    // 3) Gather per-nation unit info in one pass
    let generalCount = 0;
    let aiGeneral: Unit | null = null;
    let fighterSumX = 0;
    let fighterSumZ = 0;
    let fighterCount = 0;
    for (const u of s.units.values()) {
      if (u.nation !== nation || u.hp <= 0) continue;
      if (u.type === 'general') {
        generalCount++;
        aiGeneral = u;
      } else if (u.type !== 'supply_wagon') {
        fighterSumX += u.position.x;
        fighterSumZ += u.position.z;
        fighterCount++;
      }
    }

    // Train from barracks
    const barracks = [...s.buildings.values()].find(
      (b) => b.type === 'barracks' && b.nation === nation
    );
    if (barracks && (barracks.productionTimer == null || barracks.productionTimer <= 0)) {
      const army = s.countUnitsOf(nation);
      // Train a general first when army is large enough (max 1 for AI)
      if (generalCount < 1 && army >= 6 && s.aiFood >= 120 && s.aiMetal >= 80) {
        s.aiFood -= 120;
        s.aiMetal -= 80;
        barracks.productionType = 'general';
        barracks.productionTimer = 20;
      } else if (army < 18 && s.aiFood >= 55) {
        s.aiFood -= 55;
        barracks.productionType = 'enemy_warrior';
        barracks.productionTimer = 11;
        const pc = s.getPlayerCity();
        if (pc) {
          barracks.rallyPoint = {
            x: pc.position.x + (Math.random() - 0.5) * 12,
            y: 0,
            z: pc.position.z + (Math.random() - 0.5) * 12,
          };
        }
      }
    }

    // Keep general near army center
    if (aiGeneral && fighterCount > 0) {
      const cx = fighterSumX / fighterCount;
      const cz = fighterSumZ / fighterCount;
      const dx = cx - aiGeneral.position.x;
      const dz = cz - aiGeneral.position.z;
      if (dx * dx + dz * dz > 64) {
        aiGeneral.target = { x: cx, y: 0, z: cz };
      }
    }

    // 4) Supply wagon
    if (
      s.countUnitsOf(nation, 'supply_wagon') < 1 &&
      s.countUnitsOf(nation) >= 6 &&
      s.aiTimber >= 40 &&
      s.aiFood >= 30
    ) {
      s.aiTimber -= 40;
      s.aiFood -= 30;
      s.spawnUnit('supply_wagon', nation, {
        x: city.position.x + 4,
        y: 0,
        z: city.position.z - 4,
      });
    }

    this.assignCombat(nation);

    if (s.aiWaveTimer <= 0) {
      s.aiWaveTimer = 35 + Math.random() * 20;
      this.launchWave(nation);
    }
  }

  private assignCombat(nation: string) {
    const s = this.sim;
    const enemies = [...s.units.values()].filter(
      (u) => u.nation === nation && u.hp > 0 && u.type !== 'supply_wagon'
    );
    const players = [...s.units.values()].filter(
      (u) => u.nation === s.playerNation && u.hp > 0
    );
    const playerCities = [...s.buildings.values()].filter(
      (b) => b.nation === s.playerNation && b.type === 'city_center'
    );

    for (const a of enemies) {
      if (a.attackTargetId || a.attackBuildingId) {
        const t = a.attackTargetId ? s.units.get(a.attackTargetId) : null;
        if (t && t.hp > 0) continue;
        const b = a.attackBuildingId ? s.buildings.get(a.attackBuildingId) : null;
        if (b && b.hp > 0) continue;
        a.attackTargetId = undefined;
        a.attackBuildingId = undefined;
      }
      let best: Unit | null = null;
      let bestD = 22;
      for (const p of players) {
        const d = distanceXZ(a.position, p.position);
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }
      if (best) {
        a.attackTargetId = best.id;
      } else if (playerCities.length) {
        a.attackBuildingId = playerCities[0].id;
      } else {
        const city = s.getEnemyCity();
        if (city) a.target = { x: city.position.x + 5, y: 0, z: city.position.z };
      }
    }
  }

  private launchWave(nation: string) {
    const pc = this.sim.getPlayerCity();
    if (!pc) return;
    const fighters = [...this.sim.units.values()].filter(
      (u) =>
        u.nation === nation &&
        u.hp > 0 &&
        u.type !== 'supply_wagon' &&
        !u.attackTargetId &&
        !u.attackBuildingId
    );
    for (const u of fighters) {
      u.attackBuildingId = pc.id;
    }
  }
}
