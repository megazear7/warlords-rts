import * as THREE from 'three';
import { Simulation } from '../core/Simulation';

/**
 * RTS fog-of-war plane:
 * - Unexplored: near-black opaque
 * - Explored (not in current vision): dark semi-transparent
 * - Current vision: fully transparent
 *
 * Uses a low-res canvas texture updated from Simulation.exploredCells
 * and live vision radii. Cell size matches EXPLORED_CELL (8 world units).
 */
const CELL = 8;
const WORLD = 120; // matches terrain size
const GRID = Math.ceil(WORLD / CELL); // 15
const TEX = 128; // texture resolution

export class FogMeshes {
  private mesh: THREE.Mesh;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private texture: THREE.CanvasTexture;
  private dirty = true;
  private lastUpdate = 0;

  constructor(scene: THREE.Scene) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = TEX;
    this.canvas.height = TEX;
    this.ctx = this.canvas.getContext('2d')!;

    // Start fully black (unexplored)
    this.ctx.fillStyle = 'rgba(0,0,0,1)';
    this.ctx.fillRect(0, 0, TEX, TEX);

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.needsUpdate = true;

    const geo = new THREE.PlaneGeometry(WORLD, WORLD, 1, 1);
    geo.rotateX(-Math.PI / 2);

    const mat = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.y = 0.15; // slightly above terrain
    this.mesh.renderOrder = 10;
    scene.add(this.mesh);
  }

  private worldToTex(x: number, z: number) {
    // World centered at 0, range -60..60
    const px = Math.floor(((x + WORLD / 2) / WORLD) * TEX);
    const py = Math.floor(((z + WORLD / 2) / WORLD) * TEX);
    return { px: Math.max(0, Math.min(TEX - 1, px)), py: Math.max(0, Math.min(TEX - 1, py)) };
  }

  sync(sim: Simulation) {
    // Throttle texture rebuild (~5 Hz)
    const now = performance.now();
    if (now - this.lastUpdate < 200 && !this.dirty) return;
    this.lastUpdate = now;
    this.dirty = false;

    const ctx = this.ctx;
    const img = ctx.createImageData(TEX, TEX);
    const data = img.data;

    // 1) Base: unexplored = opaque black
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 230; // almost opaque
    }

    // 2) Explored cells → dark translucent
    for (const key of sim.exploredCells) {
      const [gsx, gsz] = key.split(',').map(Number);
      const wx = gsx * CELL + CELL / 2;
      const wz = gsz * CELL + CELL / 2;
      const { px, py } = this.worldToTex(wx, wz);
      // Fill a block of pixels for this cell
      const cellPx = Math.ceil((CELL / WORLD) * TEX) + 1;
      for (let dy = -cellPx; dy <= cellPx; dy++) {
        for (let dx = -cellPx; dx <= cellPx; dx++) {
          const x = px + dx;
          const y = py + dy;
          if (x < 0 || y < 0 || x >= TEX || y >= TEX) continue;
          const idx = (y * TEX + x) * 4;
          data[idx] = 8;
          data[idx + 1] = 12;
          data[idx + 2] = 18;
          data[idx + 3] = 140; // explored but not currently seen
        }
      }
    }

    // 3) Current vision → fully transparent circles
    const punch = (pos: { x: number; z: number }, radius: number) => {
      const { px, py } = this.worldToTex(pos.x, pos.z);
      const rPx = Math.ceil((radius / WORLD) * TEX);
      const r2 = rPx * rPx;
      for (let dy = -rPx; dy <= rPx; dy++) {
        for (let dx = -rPx; dx <= rPx; dx++) {
          if (dx * dx + dy * dy > r2) continue;
          const x = px + dx;
          const y = py + dy;
          if (x < 0 || y < 0 || x >= TEX || y >= TEX) continue;
          const idx = (y * TEX + x) * 4;
          // Soft edge
          const dist = Math.sqrt(dx * dx + dy * dy) / rPx;
          const alpha = dist > 0.75 ? Math.floor(100 * (dist - 0.75) / 0.25) : 0;
          data[idx + 3] = Math.min(data[idx + 3], alpha);
        }
      }
    };

    for (const u of sim.getAllUnits()) {
      if (u.nation !== sim.playerNation || u.hp <= 0) continue;
      punch(u.position, sim.getVisionRadius(u));
    }
    for (const b of sim.getAllBuildings()) {
      if (b.nation !== sim.playerNation || b.hp <= 0) continue;
      punch(b.position, sim.getVisionRadius(b));
    }

    ctx.putImageData(img, 0, 0);
    this.texture.needsUpdate = true;
  }

  markDirty() {
    this.dirty = true;
  }
}
