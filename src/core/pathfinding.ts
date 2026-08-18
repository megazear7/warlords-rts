/**
 * pathfinding.ts — Uniform-grid A* for Warlords RTS.
 *
 * Cell size: CELL (3 world units).  Map extents come from the chosen world size.
 * Blocked cells are set from building footprints.  A* is capped at
 * MAX_NODES explored nodes to avoid frame stalls with large open maps.
 *
 * Usage:
 *   const grid = new NavGrid();
 *   grid.markBuilding(building);          // call whenever a building is added
 *   grid.clearBuilding(building);         // call when a building is destroyed
 *   const waypoints = grid.findPath(from, to);
 *   // waypoints is [] on failure → caller falls back to straight-line.
 */

import type { Vec3 } from './math';
import type { Building } from './simTypes';

export const CELL = 3;              // world units per grid cell
export const DEFAULT_MAP_HALF = 180; // small map (360 wide)

// Building-type footprint radii (half-side of axis-aligned square blocker)
const BUILDING_RADIUS: Record<string, number> = {
  city_center: 4.5,
  barracks:    3.5,
  library:     3.0,
  tower:       2.5,
  market:      3.0,
  wall:        1.5,
  farm:        3.0,
};
const DEFAULT_RADIUS = 3.0;

// ---------- helpers ----------------------------------------------------------



// ---------- NavGrid ----------------------------------------------------------

export class NavGrid {
  readonly mapHalf: number;
  readonly gridN: number;
  private readonly maxNodes: number;
  /** Number of times each cell is blocked (supports overlapping buildings) */
  private blocked: Uint8Array;

  constructor(worldSize = DEFAULT_MAP_HALF * 2) {
    this.mapHalf = worldSize / 2;
    this.gridN = Math.ceil(worldSize / CELL);
    this.maxNodes = Math.min(12000, Math.max(2000, this.gridN * 18));
    this.blocked = new Uint8Array(this.gridN * this.gridN);
  }

  private worldToCell(w: number): number {
    return Math.floor((w + this.mapHalf) / CELL);
  }

  private cellToWorld(c: number): number {
    return c * CELL - this.mapHalf + CELL * 0.5;
  }

  private clampCell(c: number): number {
    return Math.max(0, Math.min(this.gridN - 1, c));
  }

  private i(cx: number, cz: number): number {
    return cz * this.gridN + cx;
  }

  /** Mark cells covered by a building as blocked. */
  markBuilding(b: Building) {
    this._adjustBuilding(b, +1);
  }

  /** Remove a building's blocking contribution. */
  clearBuilding(b: Building) {
    this._adjustBuilding(b, -1);
  }

  private _adjustBuilding(b: Building, delta: 1 | -1) {
    const r = BUILDING_RADIUS[b.type] ?? DEFAULT_RADIUS;
    const minCx = this.clampCell(this.worldToCell(b.position.x - r));
    const maxCx = this.clampCell(this.worldToCell(b.position.x + r));
    const minCz = this.clampCell(this.worldToCell(b.position.z - r));
    const maxCz = this.clampCell(this.worldToCell(b.position.z + r));
    for (let cz = minCz; cz <= maxCz; cz++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const i = this.i(cx, cz);
        const v = this.blocked[i] + delta;
        this.blocked[i] = Math.max(0, Math.min(255, v)) as number;
      }
    }
  }

  isBlocked(cx: number, cz: number): boolean {
    if (cx < 0 || cz < 0 || cx >= this.gridN || cz >= this.gridN) return true;
    return this.blocked[this.i(cx, cz)] > 0;
  }

  /** True when a building footprint can be placed on open cells within map bounds. */
  canPlaceBuilding(type: string, position: Vec3): boolean {
    const r = BUILDING_RADIUS[type] ?? DEFAULT_RADIUS;
    const minCx = this.worldToCell(position.x - r);
    const maxCx = this.worldToCell(position.x + r);
    const minCz = this.worldToCell(position.z - r);
    const maxCz = this.worldToCell(position.z + r);
    if (minCx < 0 || minCz < 0 || maxCx >= this.gridN || maxCz >= this.gridN) return false;
    for (let cz = minCz; cz <= maxCz; cz++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        if (this.isBlocked(cx, cz)) return false;
      }
    }
    return true;
  }

  /**
   * Compute a path from `from` to `to` using A*.
   * Returns an array of world-space Vec3 waypoints (not including `from`),
   * or [] if no path found (caller should fall back to straight-line).
   * The path is smoothed by skipping collinear waypoints.
   * Waypoints are stored in reverse order (last waypoint first) so the caller
   * can use Array.pop() for O(1) advancement.
   */
  findPath(from: Vec3, to: Vec3): Vec3[] {
    const sx = this.clampCell(this.worldToCell(from.x));
    const sz = this.clampCell(this.worldToCell(from.z));
    const gx = this.clampCell(this.worldToCell(to.x));
    const gz = this.clampCell(this.worldToCell(to.z));

    // Same cell — no path needed
    if (sx === gx && sz === gz) return [];

    // If target cell is blocked, try to find the nearest unblocked cell
    let tx = gx, tz = gz;
    if (this.isBlocked(tx, tz)) {
      const found = this._nearestUnblocked(gx, gz, 4);
      if (!found) return [];
      [tx, tz] = found;
    }

    // A* with binary min-heap open set
    const gScore = new Float32Array(this.gridN * this.gridN).fill(Infinity);
    const fScore = new Float32Array(this.gridN * this.gridN).fill(Infinity);
    const cameFrom = new Int32Array(this.gridN * this.gridN).fill(-1);

    const startIdx = this.i(sx, sz);
    gScore[startIdx] = 0;
    fScore[startIdx] = this._h(sx, sz, tx, tz);

    // Binary min-heap: each element is [f, flatIndex]
    const heap: [number, number][] = [[fScore[startIdx], startIdx]];
    const inOpen = new Uint8Array(this.gridN * this.gridN);
    inOpen[startIdx] = 1;

    let nodesVisited = 0;

    while (heap.length > 0 && nodesVisited < this.maxNodes) {
      const [, curIdx] = this._heapPop(heap);
      nodesVisited++;

      const cx = curIdx % this.gridN;
      const cz = Math.floor(curIdx / this.gridN);
      inOpen[curIdx] = 0;

      if (cx === tx && cz === tz) {
        return this._reconstructPath(cameFrom, tx, tz, to);
      }

      // 8-directional neighbors
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dz === 0) continue;
          const nx = cx + dx;
          const nz = cz + dz;
          if (nx < 0 || nz < 0 || nx >= this.gridN || nz >= this.gridN) continue;
          if (this.isBlocked(nx, nz)) continue;
          // Diagonal: check both orthogonal neighbors to avoid cutting corners
          if (dx !== 0 && dz !== 0) {
            if (this.isBlocked(cx + dx, cz) || this.isBlocked(cx, cz + dz)) continue;
          }
          const moveCost = dx !== 0 && dz !== 0 ? 1.414 : 1.0;
          const nIdx = this.i(nx, nz);
          const tentativeG = gScore[curIdx] + moveCost;
          if (tentativeG < gScore[nIdx]) {
            cameFrom[nIdx] = curIdx;
            gScore[nIdx] = tentativeG;
            fScore[nIdx] = tentativeG + this._h(nx, nz, tx, tz);
            if (!inOpen[nIdx]) {
              this._heapPush(heap, [fScore[nIdx], nIdx]);
              inOpen[nIdx] = 1;
            }
          }
        }
      }
    }

    // No path found
    return [];
  }

  // ---- Binary min-heap helpers (keyed on element[0]) ----------------------

  private _heapPush(heap: [number, number][], item: [number, number]) {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (heap[parent][0] <= heap[i][0]) break;
      [heap[parent], heap[i]] = [heap[i], heap[parent]];
      i = parent;
    }
  }

  private _heapPop(heap: [number, number][]): [number, number] {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      let i = 0;
      const n = heap.length;
      for (;;) {
        let smallest = i;
        const l = 2 * i + 1, r = 2 * i + 2;
        if (l < n && heap[l][0] < heap[smallest][0]) smallest = l;
        if (r < n && heap[r][0] < heap[smallest][0]) smallest = r;
        if (smallest === i) break;
        [heap[i], heap[smallest]] = [heap[smallest], heap[i]];
        i = smallest;
      }
    }
    return top;
  }

  // --------------------------------------------------------------------------

  private _h(ax: number, az: number, bx: number, bz: number): number {
    // Octile heuristic
    const dx = Math.abs(ax - bx);
    const dz = Math.abs(az - bz);
    return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
  }

  private _reconstructPath(
    cameFrom: Int32Array,
    tx: number,
    tz: number,
    exactTarget: Vec3
  ): Vec3[] {
    const cells: [number, number][] = [];
    let cur = this.i(tx, tz);
    while (cur !== -1) {
      const cx = cur % this.gridN;
      const cz = Math.floor(cur / this.gridN);
      cells.push([cx, cz]);
      cur = cameFrom[cur];
    }
    cells.reverse();
    // Skip first cell (start position)
    const waypoints: Vec3[] = cells.slice(1).map(([cx, cz]) => ({
      x: this.cellToWorld(cx),
      y: 0,
      z: this.cellToWorld(cz),
    }));
    // Replace last waypoint with the exact target position
    if (waypoints.length > 0) {
      waypoints[waypoints.length - 1] = { ...exactTarget, y: 0 };
    }
    // Smooth then reverse so callers can use pop() for O(1) advancement
    const smoothed = this._smoothPath(waypoints);
    smoothed.reverse();
    return smoothed;
  }

  /** Remove redundant intermediate waypoints (straight-line segments). */
  private _smoothPath(wps: Vec3[]): Vec3[] {
    if (wps.length <= 2) return wps;
    const out: Vec3[] = [wps[0]];
    for (let i = 1; i < wps.length - 1; i++) {
      const prev = out[out.length - 1];
      const curr = wps[i];
      const next = wps[i + 1];
      // Keep only if direction changes
      const d1x = curr.x - prev.x, d1z = curr.z - prev.z;
      const d2x = next.x - curr.x, d2z = next.z - curr.z;
      // Cross-product magnitude
      const cross = Math.abs(d1x * d2z - d1z * d2x);
      if (cross > 0.01) out.push(curr);
    }
    out.push(wps[wps.length - 1]);
    return out;
  }

  /** BFS to find nearest unblocked cell within `maxDist` cells. */
  private _nearestUnblocked(
    cx: number,
    cz: number,
    maxDist: number
  ): [number, number] | null {
    for (let r = 1; r <= maxDist; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
          const nx = cx + dx, nz = cz + dz;
          if (nx < 0 || nz < 0 || nx >= this.gridN || nz >= this.gridN) continue;
          if (!this.isBlocked(nx, nz)) return [nx, nz];
        }
      }
    }
    return null;
  }
}
