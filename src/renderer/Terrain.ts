import * as THREE from 'three';

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

  // Very lightweight value noise approximation
  function noise(x: number, z: number): number {
    const n1 = Math.sin(x * 0.07) * Math.cos(z * 0.09) * 2.2;
    const n2 = Math.sin(x * 0.19 + 1.7) * Math.cos(z * 0.15) * 0.9;
    const n3 = Math.sin(x * 0.41) * Math.sin(z * 0.37) * 0.35;
    return n1 + n2 + n3;
  }

  for (let i = 0; i < positions.count; i++) {
    vertex.fromBufferAttribute(positions, i);
    const h = noise(vertex.x, vertex.z);
    // Flatten the center area so the capital sits on relatively flat ground
    const dist = Math.sqrt(vertex.x * vertex.x + vertex.z * vertex.z);
    const flatten = Math.max(0, 1 - dist / 28);
    positions.setY(i, h * (1 - flatten * 0.85));
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
