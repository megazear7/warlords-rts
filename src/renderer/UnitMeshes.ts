import * as THREE from 'three';
import { Unit } from '../core/Simulation';

/**
 * Manages visual representation of units.
 * Currently uses simple geometric placeholders.
 * Selection rings are shown for selected units.
 */
export class UnitMeshes {
  private group = new THREE.Group();
  private meshes = new Map<string, THREE.Object3D>();

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
  }

  sync(units: Unit[], selectedIds: Set<string>) {
    const seen = new Set<string>();

    for (const unit of units) {
      seen.add(unit.id);
      let mesh = this.meshes.get(unit.id);

      if (!mesh) {
        mesh = this.createPlaceholder(unit);
        this.meshes.set(unit.id, mesh);
        this.group.add(mesh);
      }

      mesh.position.set(unit.position.x, unit.position.y, unit.position.z);

      // Update selection ring visibility
      const ring = mesh.userData.selectionRing as THREE.Mesh | undefined;
      if (ring) {
        const mat = ring.material as THREE.MeshBasicMaterial;
        mat.opacity = selectedIds.has(unit.id) ? 0.85 : 0;
      }
    }

    // Remove meshes for units that no longer exist
    for (const [id, mesh] of this.meshes) {
      if (!seen.has(id)) {
        this.group.remove(mesh);
        this.meshes.delete(id);
      }
    }
  }

  private createPlaceholder(unit: Unit): THREE.Object3D {
    const group = new THREE.Group();

    // Body
    const bodyGeo = new THREE.CapsuleGeometry(0.35, 0.7, 4, 8);
    let color = 0xc4a35a; // default citizen tan

    if (unit.type === 'scout') color = 0x4a7c9b;
    if (unit.nation === 'rome' && unit.type === 'citizen') color = 0xb08d57;

    const bodyMat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.7,
      metalness: 0.1,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    body.position.y = 0.7;
    group.add(body);

    // Simple head
    const headGeo = new THREE.SphereGeometry(0.28, 8, 8);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xe0c8a0 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.55;
    head.castShadow = true;
    group.add(head);

    // Selection ring
    const ringGeo = new THREE.RingGeometry(0.55, 0.75, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x44ff88,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.08;
    group.add(ring);

    group.userData.unitId = unit.id;
    group.userData.selectionRing = ring;
    return group;
  }
}
