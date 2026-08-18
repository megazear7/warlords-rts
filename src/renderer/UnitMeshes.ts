import * as THREE from 'three';
import { Unit } from '../core/Simulation';
import { drapeOnTerrain, getTerrainHeight } from './Terrain';

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

      const groundY = getTerrainHeight(unit.position.x, unit.position.z);
      mesh.position.set(unit.position.x, groundY, unit.position.z);
      // Subtle green pulse when under general aura
      if ((unit as any).inAura) {
        mesh.traverse((c: any) => {
          if (c.isMesh && c.material && c.material.emissive) {
            c.material.emissive.setHex(0x113311);
            c.material.emissiveIntensity = 0.15;
          }
        });
      } else {
        mesh.traverse((c: any) => {
          if (c.isMesh && c.material && c.material.emissive) {
            c.material.emissive.setHex(0x000000);
            c.material.emissiveIntensity = 0;
          }
        });
      }

      const ring = mesh.userData.selectionRing as THREE.Mesh | undefined;
      if (ring) {
        const selected = selectedIds.has(unit.id);
        ring.visible = selected;
        if (selected) {
          const mat = ring.material as THREE.MeshBasicMaterial;
          mat.color.setHex(unit.underAttrition ? 0xffaa33 : 0x44ff88);
          drapeOnTerrain(ring.geometry, unit.position.x, unit.position.z, groundY, 0.12);
        }
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
    } else if (unit.type === 'general') {
      // General: larger body + standard/flag
      const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.38, 0.7, 4, 8),
        new THREE.MeshStandardMaterial({ color: 0x1a1a4a, roughness: 0.55, metalness: 0.2 })
      );
      body.position.y = 0.95;
      body.castShadow = true;
      group.add(body);
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xe8c4a0 })
      );
      head.position.y = 1.7;
      group.add(head);
      // Standard pole
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 2.2, 6),
        new THREE.MeshStandardMaterial({ color: 0x5c4033 })
      );
      pole.position.set(0.45, 1.4, 0);
      group.add(pole);
      const flag = new THREE.Mesh(
        new THREE.PlaneGeometry(0.7, 0.5),
        new THREE.MeshStandardMaterial({ color: 0xc41e3a, side: THREE.DoubleSide })
      );
      flag.position.set(0.75, 2.2, 0);
      group.add(flag);
    } else if (unit.type === 'cataphract' || unit.type === 'chariot') {
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 0.6, 0.8),
        new THREE.MeshStandardMaterial({
          color: unit.type === 'chariot' ? 0xc9a84c : 0x8a7a2a,
          roughness: 0.7,
        })
      );
      body.position.y = 0.9;
      body.castShadow = true;
      group.add(body);
      const rider = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.25, 0.4, 4, 6),
        new THREE.MeshStandardMaterial({ color: unit.nation === 'egypt' ? 0x2e8b57 : 0xc9a227 })
      );
      rider.position.y = 1.5;
      group.add(rider);
    } else {
      let bodyColor = 0xc4a35a;
      let scale = 1;

      switch (unit.type) {
        case 'scout':
          bodyColor = 0x4a7c9b;
          break;
        case 'citizen':
          bodyColor = 0xb08d57;
          break;
        case 'legionary':
          bodyColor = 0x8b1a1a;
          scale = 1.15;
          break;
        case 'praetorian':
          bodyColor = 0x5c0a0a;
          scale = 1.25;
          break;
        case 'immortal':
          bodyColor = 0xc9a227;
          scale = 1.12;
          break;
        case 'spearman':
          bodyColor = 0x2e8b57;
          scale = 1.1;
          break;
        case 'swordsman':
        case 'fanatic':
          bodyColor = 0x3d6b2a;
          scale = unit.type === 'fanatic' ? 1.05 : 1.1;
          break;
        case 'enemy_warrior':
          bodyColor = 0x3d6b2a;
          scale = 1.1;
          break;
        default:
          if (unit.nation === 'persia') bodyColor = 0xc9a227;
          if (unit.nation === 'egypt') bodyColor = 0x2e8b57;
          if (unit.nation === 'gaul') bodyColor = 0x3d6b2a;
          if (unit.nation === 'rome') bodyColor = 0xb22222;
      }

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

      if (unit.type === 'legionary' || unit.type === 'praetorian') {
        const shield = new THREE.Mesh(
          new THREE.BoxGeometry(0.15, 0.9, 0.6),
          new THREE.MeshStandardMaterial({ color: 0xc4a035, metalness: 0.3, roughness: 0.5 })
        );
        shield.position.set(-0.5, 0.9, 0);
        group.add(shield);
      }
      if (unit.type === 'spearman') {
        const spear = new THREE.Mesh(
          new THREE.CylinderGeometry(0.04, 0.04, 2.2, 6),
          new THREE.MeshStandardMaterial({ color: 0xaaaaaa })
        );
        spear.position.set(0.45, 1.2, 0);
        spear.rotation.z = 0.3;
        group.add(spear);
      }
    }

    const ringGeo = new THREE.RingGeometry(0.55, 0.75, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ring = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({
        color: 0x44ff88,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      })
    );
    ring.visible = false;
    ring.renderOrder = 6;
    group.add(ring);

    const hpBar = new THREE.Mesh(
      new THREE.PlaneGeometry(1.0, 0.1),
      new THREE.MeshBasicMaterial({ color: 0x44ff66, depthWrite: false })
    );
    hpBar.position.y =
      unit.type === 'supply_wagon' || unit.type === 'cataphract' || unit.type === 'chariot'
        ? 1.6
        : 2.1;
    group.add(hpBar);

    group.userData.unitId = unit.id;
    group.userData.selectionRing = ring;
    group.userData.hpBar = hpBar;
    return group;
  }
}
