import type { Simulation } from './Simulation';
import type { Unit } from './simTypes';
import { distanceXZ } from './math';
import { executeTrade } from '../data/market';

/**
 * AI opponent logic — extracted so Simulation.ts stays smaller / pushable.
 *
 * Decision priorities (highest → lowest):
 *  1. Respect gameOver (early exit).
 *  2. Epoch advance + market trading.
 *  3. Economy: farm ×2, library, barracks.
 *  4. Research: military → civic → commerce → science when library exists.
 *  5. Expansion / defense: market (commerce ≥ 1), tower (military ≥ 1).
 *  6. Train units (general first when army large, then warriors — only if not broke).
 *  7. Supply wagon for the army.
 *  8. Assign combat targets.
 *  9. Threshold-based wave launch: attack only when ≥ ATTACK_THRESHOLD fighters ready.
 */

/** Minimum fighters required before launching an offensive wave */
const ATTACK_THRESHOLD = 8;
/** Knowledge cost per AI research level */
const AI_RESEARCH_COST = 40;
/** Fixed priority order for AI research tracks */
const RESEARCH_PRIORITY = ['military', 'civic', 'commerce', 'science'] as const;

export class SimulationAI {
  constructor(private sim: Simulation) {}

  run(): void {
    const s = this.sim;

    // Requirement 6: issue no new strategic orders when game is over
    if (s.gameOver) return;

    const nation = s.enemyNation();
    const city = s.getEnemyCity();
    if (!city) return;

    // Attempt epoch advance when affordable
    s.tryAIAdvanceEpoch();

    // AI market trading: fix critical resource shortages via market
    this.runMarketTrades(nation);

    // ── Economy Phase ──────────────────────────────────────────────────────

    // 1) Farms (up to 2): primary food source
    if (s.countBuildingsOf('farm', nation) < 2 && s.aiTimber >= 60) {
      s.aiTimber -= 60;
      // Use tick counter for deterministic placement offset (8 slots × 45°)
      const slot = Math.floor(s.time / 2) % 8;
      const ang = slot * (Math.PI / 4);
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

    // 2) Library: enables research; build before barracks so AI researches early
    if (s.countBuildingsOf('library', nation) < 1 && s.aiTimber >= 80 && s.aiWealth >= 40) {
      s.aiTimber -= 80;
      s.aiWealth -= 40;
      s.addBuilding(
        'library',
        nation,
        {
          x: city.position.x + 10,
          y: 0,
          z: city.position.z + 4,
        },
        600
      );
      return;
    }

    // 3) Barracks: military production
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

    // ── Research Phase ─────────────────────────────────────────────────────
    this.runResearch(nation);

    // ── Expansion / Defense ────────────────────────────────────────────────

    // Market (requires commerce research ≥ 1): improves trade rates
    if (
      s.countBuildingsOf('market', nation) < 1 &&
      s.aiResearch.commerce >= 1 &&
      s.aiTimber >= 70 &&
      s.aiWealth >= 25
    ) {
      s.aiTimber -= 70;
      s.aiWealth -= 25;
      s.addBuilding(
        'market',
        nation,
        {
          x: city.position.x + 12,
          y: 0,
          z: city.position.z - 4,
        },
        500
      );
      return;
    }

    // Watchtower (requires military research ≥ 1): defensive coverage
    if (
      s.countBuildingsOf('tower', nation) < 1 &&
      s.aiResearch.military >= 1 &&
      s.aiTimber >= 80 &&
      s.aiWealth >= 30
    ) {
      s.aiTimber -= 80;
      s.aiWealth -= 30;
      s.addBuilding(
        'tower',
        nation,
        {
          x: city.position.x + 6,
          y: 0,
          z: city.position.z - 8,
        },
        700
      );
      return;
    }

    // ── Unit census ────────────────────────────────────────────────────────
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

    // ── Train from barracks ────────────────────────────────────────────────
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
      } else if (army < 18 && s.aiFood >= 55 && s.aiMetal >= 10) {
        // Guard: only train if not critically broke on metal
        s.aiFood -= 55;
        s.aiMetal -= 10;
        barracks.productionType = 'enemy_warrior';
        barracks.productionTimer = 11;
        const pc = s.getPlayerCity();
        if (pc) {
          // Deterministic rally jitter: independent x/z offsets via different tick buckets
          const jitterX = ((Math.floor(s.time) % 6) - 2.5) * 2;
          const jitterZ = ((Math.floor(s.time + 3) % 6) - 2.5) * 2;
          barracks.rallyPoint = {
            x: pc.position.x + jitterX,
            y: 0,
            z: pc.position.z + jitterZ,
          };
        }
      }
    }

    // ── Keep general near army center ──────────────────────────────────────
    if (aiGeneral && fighterCount > 0) {
      const cx = fighterSumX / fighterCount;
      const cz = fighterSumZ / fighterCount;
      const dx = cx - aiGeneral.position.x;
      const dz = cz - aiGeneral.position.z;
      if (dx * dx + dz * dz > 64) {
        aiGeneral.target = { x: cx, y: 0, z: cz };
      }
    }

    // ── Supply wagon ───────────────────────────────────────────────────────
    // Maintain 1 supply wagon with the army to prevent attrition losses
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

    // ── Threshold-based wave launch ────────────────────────────────────────
    // Only send an attack when enough fighters are massed; otherwise wait.
    if (s.aiWaveTimer <= 0) {
      if (fighterCount >= ATTACK_THRESHOLD) {
        // Sufficient force: launch the wave and reset with a fixed cooldown
        s.aiWaveTimer = 35;
        this.launchWave(nation);
      } else {
        // Not enough troops yet; check again soon
        s.aiWaveTimer = 10;
      }
    }
  }

  /**
   * Spend accumulated AI knowledge on research tracks in priority order.
   * Requires a library to be present (mirrors player restriction).
   */
  private runResearch(nation: string): void {
    const s = this.sim;
    if (s.aiKnowledge < AI_RESEARCH_COST) return;
    if (s.countBuildingsOf('library', nation) < 1) return;

    for (const track of RESEARCH_PRIORITY) {
      if (s.aiResearch[track] < 5 && s.aiKnowledge >= AI_RESEARCH_COST) {
        s.aiKnowledge -= AI_RESEARCH_COST;
        s.aiResearch[track] += 1;
        return; // one upgrade per AI tick
      }
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

  /**
   * Launch a coordinated wave: send all idle fighters at the player city.
   * Also move the supply wagon and general toward the assault to reduce attrition.
   */
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

    // Move supply wagon toward the front so it can cover attrition
    const wagon = [...this.sim.units.values()].find(
      (u) => u.nation === nation && u.hp > 0 && u.type === 'supply_wagon'
    );
    if (wagon) {
      // Stage the wagon 8 units behind the target city
      wagon.target = {
        x: pc.position.x + 8,
        y: 0,
        z: pc.position.z + 8,
      };
    }
  }

  /**
   * Basic AI market trading: if AI owns a market and is critically low on one
   * resource while holding surplus in another, perform an exchange.
   */
  private runMarketTrades(nation: string): void {
    const s = this.sim;
    const hasMarket = [...s.buildings.values()].some(
      (b) => b.type === 'market' && b.nation === nation
    );
    if (!hasMarket) return;

    // Proxy AI resources as a TradeResources object (mutates AI resource fields)
    const aiRes = {
      get food() { return s.aiFood; },
      set food(v: number) { s.aiFood = v; },
      get timber() { return s.aiTimber; },
      set timber(v: number) { s.aiTimber = v; },
      get metal() { return s.aiMetal; },
      set metal(v: number) { s.aiMetal = v; },
      get wealth() { return s.aiWealth; },
      set wealth(v: number) { s.aiWealth = v; },
    };

    // Sell surplus food if very wealthy in food
    if (s.aiFood > 300 && s.aiWealth < 150) {
      executeTrade(aiRes, 'food', 'wealth', 100, s.aiResearch.commerce, true);
      return;
    }
    // Sell surplus timber if very wealthy in timber
    if (s.aiTimber > 300 && s.aiWealth < 150) {
      executeTrade(aiRes, 'timber', 'wealth', 100, s.aiResearch.commerce, true);
      return;
    }
    // Buy food if critically low
    if (s.aiFood < 60 && s.aiWealth > 80) {
      executeTrade(aiRes, 'wealth', 'food', 50, s.aiResearch.commerce, true);
      return;
    }
    // Buy metal if critically low
    if (s.aiMetal < 30 && s.aiWealth > 60) {
      executeTrade(aiRes, 'wealth', 'metal', 20, s.aiResearch.commerce, true);
    }
  }
}
