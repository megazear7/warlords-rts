import * as THREE from 'three';
import { Unit } from '../core/Simulation';

export class UnitMeshes {
  private group = new THREE.Group();
  private meshes = new Map<string, THREE.Object3D>();

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
  }

  sync(units: Unit[], selectedIds: Set<string>) {
    const seen = new Set<string>();

    for (const unit of units) {
      if (unit.hp <= 0) continue;
      seen.add(unit.id);

      let mesh = this.meshes.get(unit.id);
      if (!mesh) {
        mesh = this.createPlaceholder(unit);
        this.meshes.set(unit.id, mesh);
        this.group.add(mesh);
      }

      mesh.position.set(unit.position.x, unit.position.y, unit.position.z);

      const ring = mesh.userData.selectionRing as THREE.Mesh | undefined;
      if (ring) {
        const mat = ring.material as THREE.MeshBasicMaterial;
        mat.opacity = selectedIds.has(unit.id) ? 0.85 : 0;
        // Attrition = orange ring tint
        if (unit.underAttrition && selectedIds.has(unit.id)) mat.color.setHex(0xffaa33);
        else if (selectedIds.has(unit.id)) mat.color.setHex(unit.nation === 'rome' || !unit.nation.includes('gaul') ? 0x44ff88 : 0xff4444);
      }

      const hpBar = mesh.userData.hpBar as THREE.Mesh | undefined;
      if (hpBar) {
        const ratio = Math.max(0, unit.hp / unit.maxHp);
        hpBar.scale.x = ratio;
        const mat = hpBar.material as THREE.MeshBasicMaterial;
        mat.color.setHex(ratio > 0.5 ? 0x44ff66 : ratio > 0.25 ? 0xffaa22 : 0xff3333);
      }
    }

    for (const [id, mesh] of this.meshes) {
      if (!seen.has(id)) {
        this.group.remove(mesh);
        this.meshes.delete(id);
      }
    }
  }

  private createPlaceholder(unit: Unit): THREE.Object3D {
    const group = new THREE.Group();

    if (unit.type === 'supply_wagon') {
      const cart = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 0.7, 1.0),
        new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.9 })
      );
      cart.position.y = 0.55;
      cart.castShadow = true;
      group.add(cart);

      for (const x of [-0.55, 0.55]) {
        const wheel = new THREE.Mesh(
          new THREE.CylinderGeometry(0.35, 0.35, 0.15, 10),
          new THREE.MeshStandardMaterial({ color: 0x333333 })
        );
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(x, 0.35, 0.55);
        group.add(wheel);
        const wheel2 = wheel.clone();
        wheel2.position.z = -0.55;
        group.add(wheel2);
      }
    } else {
      let bodyColor = 0xc4a35a;
      let scale = 1;

      if (unit.type === 'scout') bodyColor = 0x4a7c9b;
      if (unit.type === 'citizen') bodyColor = 0xb08d57;
      if (unit.type === 'legionary') {
        bodyColor = 0x8b1a1a;
        scale = 1.15;
      }
      if (unit.type === 'enemy_warrior' || unit.nation === 'gaul') {
        bodyColor = 0x3d6b2a;
        scale = 1.1;
      }
      if (unit.nation === 'persia') bodyColor = 0xc9a227;
      if (unit.nation === 'egypt') bodyColor = 0x2e8b57;

      const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.35 * scale, 0.7 * scale, 4, 8),
        new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.7, metalness: 0.1 })
      );
      body.castShadow = true;
      body.position.y = 0.7 * scale;
      group.add(body);

      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.28 * scale, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xe0c8a0 })
      );
      head.position.y = 1.55 * scale;
      head.castShadow = true;
      group.add(head);

      if (unit.type === 'legionary') {
        const shield = new THREE.Mesh(
          new THREE.BoxGeometry(0.15, 0.9, 0.6),
          new THREE.MeshStandardMaterial({ color: 0xc4a035, metalness: 0.3, roughness: 0.5 })
        );
        shield.position.set(-0.5, 0.9, 0);
        group.add(shield);
      }
    }

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.75, 24),
      new THREE.MeshBasicMaterial({
        color: 0x44ff88,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.08;
    group.add(ring);

    const hpBar = new THREE.Mesh(
      new THREE.PlaneGeometry(1.0, 0.1),
      new THREE.MeshBasicMaterial({ color: 0x44ff66, depthWrite: false })
    );
    hpBar.position.y = unit.type === 'supply_wagon' ? 1.4 : 2.1;
    group.add(hpBar);

    group.userData.unitId = unit.id;
    group.userData.selectionRing = ring;
    group.userData.hpBar = hpBar;
    return group;
  }
}
