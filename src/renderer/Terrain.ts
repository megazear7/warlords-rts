import * as THREE from 'three';

/** Matches the procedural terrain mesh. Simulation stays on XZ; visuals sample this. */
export function getTerrainHeight(x: number, z: number): number {
  const n1 = Math.sin(x * 0.07) * Math.cos(z * 0.09) * 2.2;
  const n2 = Math.sin(x * 0.19 + 1.7) * Math.cos(z * 0.15) * 0.9;
  const n3 = Math.sin(x * 0.41) * Math.sin(z * 0.37) * 0.35;
  const h = n1 + n2 + n3;
  const dist = Math.hypot(x, z);
  const flatten = Math.max(0, 1 - dist / 28);
  return h * (1 - flatten * 0.85);
}

export function sampleTerrainHeightRange(
  x: number,
  z: number,
  hx: number,
  hz: number,
  steps = 6
): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i <= steps; i++) {
    for (let j = 0; j <= steps; j++) {
      const px = x + (i / steps - 0.5) * 2 * hx;
      const pz = z + (j / steps - 0.5) * 2 * hz;
      const h = getTerrainHeight(px, pz);
      if (h < min) min = h;
      if (h > max) max = h;
    }
  }
  return { min, max };
}

/** Displace an XZ-plane geometry so it follows terrain relative to a parent origin. */
export function drapeOnTerrain(
  geometry: THREE.BufferGeometry,
  originX: number,
  originZ: number,
  originY: number,
  lift = 0.08
): void {
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const worldX = originX + pos.getX(i);
    const worldZ = originZ + pos.getZ(i);
    pos.setY(i, getTerrainHeight(worldX, worldZ) - originY + lift);
  }
  pos.needsUpdate = true;
}

/**
 * Simple procedural terrain using layered noise.
 * Good enough for Phase 0; will be replaced by a more sophisticated
 * chunked / biome system later.
 */
export function createTerrain(size = 120): THREE.Mesh {
  const segments = 96;
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);

  const positions = geometry.attributes.position;
  const vertex = new THREE.Vector3();

  for (let i = 0; i < positions.count; i++) {
    vertex.fromBufferAttribute(positions, i);
    positions.setY(i, getTerrainHeight(vertex.x, vertex.z));
  }

  geometry.computeVertexNormals();

  // Simple vertex colors based on height
  const colors = new Float32Array(positions.count * 3);
  const color = new THREE.Color();

  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i);
    if (y < -0.6) {
      color.setHex(0x4a7c59); // lower / greener
    } else if (y < 0.8) {
      color.setHex(0x6b8f5e); // mid grass
    } else {
      color.setHex(0x8a9a6e); // higher / drier
    }
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.05,
    flatShading: false,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';

  return mesh;
}
