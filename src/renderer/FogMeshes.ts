import * as THREE from 'three';
import { Simulation } from '../core/Simulation';
import { getTerrainHeight, terrainSegmentCount } from './Terrain';

/**
 * Ground-hugging fog-of-war:
 * - Unexplored: dark
 * - Explored (not in vision): light haze
 * - Current vision: fully transparent
 */
const CELL = 8;
const FOG_LIFT = 0.12;

function envelopeHeight(x: number, z: number, step: number): number {
  const h = step * 0.5;
  let max = getTerrainHeight(x, z);
  max = Math.max(max, getTerrainHeight(x - h, z - h));
  max = Math.max(max, getTerrainHeight(x + h, z - h));
  max = Math.max(max, getTerrainHeight(x - h, z + h));
  max = Math.max(max, getTerrainHeight(x + h, z + h));
  return max;
}

function texSizeForWorld(world: number): number {
  const pow2 = 2 ** Math.ceil(Math.log2(Math.max(256, world)));
  return Math.min(1024, pow2);
}

export class FogMeshes {
  private mesh: THREE.Mesh;
  private data = new Uint8Array(4);
  private texture: THREE.DataTexture;
  private dirty = true;
  private lastUpdate = 0;
  private world = 360;
  private texSize = 512;

  constructor(scene: THREE.Scene, worldSize = 360) {
    this.texture = new THREE.DataTexture(this.data as unknown as BufferSource, 1, 1);
    this.mesh = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({
        transparent: true,
        depthWrite: false,
        depthTest: true,
        side: THREE.DoubleSide,
        opacity: 1,
      })
    );
    this.mesh.renderOrder = 2;
    this.mesh.name = 'fogOfWar';
    scene.add(this.mesh);
    this.setWorldSize(worldSize);
  }

  setWorldSize(worldSize: number) {
    this.world = worldSize;
    this.texSize = texSizeForWorld(worldSize);
    this.data = new Uint8Array(this.texSize * this.texSize * 4);

    this.texture.dispose();
    this.texture = new THREE.DataTexture(this.data as unknown as BufferSource, this.texSize, this.texSize);
    this.texture.flipY = false;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.needsUpdate = true;

    this.mesh.geometry.dispose();
    const segs = terrainSegmentCount(worldSize);
    const geo = new THREE.PlaneGeometry(worldSize, worldSize, segs, segs);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    const step = worldSize / segs;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, envelopeHeight(x, z, step) + FOG_LIFT);
      uv.setXY(i, (x + worldSize / 2) / worldSize, (z + worldSize / 2) / worldSize);
    }
    pos.needsUpdate = true;
    uv.needsUpdate = true;
    geo.computeVertexNormals();
    this.mesh.geometry = geo;

    const mat = this.mesh.material as THREE.MeshBasicMaterial;
    mat.map = this.texture;
    mat.transparent = true;
    mat.depthWrite = false;
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = -2;
    mat.polygonOffsetUnits = -2;
    mat.needsUpdate = true;

    this.dirty = true;
  }

  private worldToTex(x: number, z: number): { px: number; py: number } {
    const u = (x + this.world / 2) / this.world;
    const v = (z + this.world / 2) / this.world;
    return {
      px: Math.max(0, Math.min(this.texSize - 1, Math.floor(u * this.texSize))),
      py: Math.max(0, Math.min(this.texSize - 1, Math.floor(v * this.texSize))),
    };
  }

  sync(sim: Simulation) {
    const now = performance.now();
    if (now - this.lastUpdate < 200 && !this.dirty) return;
    this.lastUpdate = now;
    this.dirty = false;

    const TEX = this.texSize;
    const WORLD = this.world;
    const data = this.data;

    for (let i = 0; i < data.length; i += 4) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 210;
    }

    for (const key of sim.exploredCells) {
      const [gsx, gsz] = key.split(',').map(Number);
      const wx = gsx * CELL + CELL / 2;
      const wz = gsz * CELL + CELL / 2;
      const { px, py } = this.worldToTex(wx, wz);
      const cellPx = Math.ceil((CELL / WORLD) * TEX) + 1;
      for (let dy = -cellPx; dy <= cellPx; dy++) {
        for (let dx = -cellPx; dx <= cellPx; dx++) {
          const x = px + dx;
          const y = py + dy;
          if (x < 0 || y < 0 || x >= TEX || y >= TEX) continue;
          const idx = (y * TEX + x) * 4;
          data[idx] = 6;
          data[idx + 1] = 8;
          data[idx + 2] = 12;
          data[idx + 3] = 70;
        }
      }
    }

    const punch = (pos: { x: number; z: number }, radius: number) => {
      const { px, py } = this.worldToTex(pos.x, pos.z);
      const rPx = Math.max(8, Math.ceil((radius / WORLD) * TEX));
      const r2 = rPx * rPx;
      for (let dy = -rPx; dy <= rPx; dy++) {
        for (let dx = -rPx; dx <= rPx; dx++) {
          if (dx * dx + dy * dy > r2) continue;
          const x = px + dx;
          const y = py + dy;
          if (x < 0 || y < 0 || x >= TEX || y >= TEX) continue;
          const idx = (y * TEX + x) * 4;
          const dist = Math.sqrt(dx * dx + dy * dy) / rPx;
          const alpha = dist > 0.72 ? Math.floor(80 * (dist - 0.72) / 0.28) : 0;
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

    this.texture.needsUpdate = true;
  }

  markDirty() {
    this.dirty = true;
  }
}
