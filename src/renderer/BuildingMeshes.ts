import * as THREE from 'three';
import { Building } from '../core/Simulation';
import { NATIONS, NationId } from '../data/nations';

export class BuildingMeshes {
  private group = new THREE.Group();
  private meshes = new Map<string, THREE.Object3D>();

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
  }

  sync(buildings: Building[], selectedBuildingId: string | null) {
    const seen = new Set<string>();

    for (const b of buildings) {
      seen.add(b.id);
      let mesh = this.meshes.get(b.id);

      if (!mesh) {
        mesh = this.createPlaceholder(b);
        this.meshes.set(b.id, mesh);
        this.group.add(mesh);
      } else if (mesh.userData.nation !== b.nation) {
        this.group.remove(mesh);
        mesh = this.createPlaceholder(b);
        this.meshes.set(b.id, mesh);
        this.group.add(mesh);
      }

      mesh.position.set(b.position.x, b.position.y, b.position.z);

      const ring = mesh.userData.selectionRing as THREE.Mesh | undefined;
      if (ring) {
        const mat = ring.material as THREE.MeshBasicMaterial;
        mat.opacity = selectedBuildingId === b.id ? 0.7 : 0;
      }

      const hpBar = mesh.userData.hpBar as THREE.Mesh | undefined;
      if (hpBar) {
        const ratio = Math.max(0, b.hp / b.maxHp);
        hpBar.scale.x = ratio;
        const mat = hpBar.material as THREE.MeshBasicMaterial;
        mat.color.setHex(ratio > 0.5 ? 0x44ff66 : ratio > 0.25 ? 0xffaa22 : 0xff3333);
        hpBar.visible = ratio < 0.99 || selectedBuildingId === b.id;
      }
    }

    for (const [id, mesh] of this.meshes) {
      if (!seen.has(id)) {
        this.group.remove(mesh);
        this.meshes.delete(id);
      }
    }
  }

  private createPlaceholder(b: Building): THREE.Object3D {
    const group = new THREE.Group();
    group.userData.nation = b.nation;
    const nationId = b.nation as NationId;
    const nationColor = NATIONS[nationId]?.color ?? 0x888888;

    if (b.type === 'city_center') {
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(6, 3.5, 6),
        new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.85 })
      );
      base.position.y = 1.75;
      base.castShadow = true;
      base.receiveShadow = true;
      group.add(base);

      const top = new THREE.Mesh(
        new THREE.BoxGeometry(4.2, 2.2, 4.2),
        new THREE.MeshStandardMaterial({ color: 0x9c8466, roughness: 0.8 })
      );
      top.position.y = 4.6;
      top.castShadow = true;
      group.add(top);

      const banner = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 4, 0.3),
        new THREE.MeshStandardMaterial({ color: nationColor })
      );
      banner.position.set(0, 6.5, 0);
      group.add(banner);
    } else if (b.type === 'barracks') {
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(5, 2.8, 5),
        new THREE.MeshStandardMaterial({ color: 0x6b5a45, roughness: 0.85 })
      );
      base.position.y = 1.4;
      base.castShadow = true;
      group.add(base);
    } else if (b.type === 'farm') {
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(4, 1.2, 4),
        new THREE.MeshStandardMaterial({ color: 0x7a9a4a, roughness: 0.9 })
      );
      base.position.y = 0.6;
      group.add(base);
    } else if (b.type === 'library') {
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(4.5, 3, 4.5),
        new THREE.MeshStandardMaterial({ color: 0x5a6a8a, roughness: 0.7 })
      );
      base.position.y = 1.5;
      base.castShadow = true;
      group.add(base);
    } else if (b.type === 'tower') {
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(1.2, 1.6, 5, 8),
        new THREE.MeshStandardMaterial({ color: 0x6a6a6a, roughness: 0.9 })
      );
      shaft.position.y = 2.5;
      shaft.castShadow = true;
      group.add(shaft);
      const top = new THREE.Mesh(
        new THREE.CylinderGeometry(1.8, 1.8, 0.8, 8),
        new THREE.MeshStandardMaterial({ color: 0x4a4a4a })
      );
      top.position.y = 5.2;
      group.add(top);
    } else if (b.type === 'market') {
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(4.5, 1.8, 4.5),
        new THREE.MeshStandardMaterial({ color: 0x8a7040, roughness: 0.8 })
      );
      base.position.y = 0.9;
      base.castShadow = true;
      group.add(base);
      const awning = new THREE.Mesh(
        new THREE.BoxGeometry(5, 0.15, 5),
        new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.7 })
      );
      awning.position.y = 2.0;
      group.add(awning);
      const post1 = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, 2, 6),
        new THREE.MeshStandardMaterial({ color: 0x5a4030 })
      );
      post1.position.set(-2, 1, -2);
      group.add(post1);
      const post2 = post1.clone();
      post2.position.set(2, 1, 2);
      group.add(post2);
    } else if (b.type === 'wall') {
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(5.5, 3.2, 1.4),
        new THREE.MeshStandardMaterial({ color: 0x6a6a6a, roughness: 0.9, metalness: 0.05 })
      );
      wall.position.y = 1.6;
      wall.castShadow = true;
      wall.receiveShadow = true;
      group.add(wall);
      const crest = new THREE.Mesh(
        new THREE.BoxGeometry(5.7, 0.55, 1.6),
        new THREE.MeshStandardMaterial({ color: 0x4a4a4a })
      );
      crest.position.y = 3.4;
      group.add(crest);
      for (const x of [-2.0, -0.7, 0.7, 2.0]) {
        const merlon = new THREE.Mesh(
          new THREE.BoxGeometry(0.7, 0.7, 1.5),
          new THREE.MeshStandardMaterial({ color: 0x555555 })
        );
        merlon.position.set(x, 3.9, 0);
        group.add(merlon);
      }
    } else {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(3, 2.5, 3),
        new THREE.MeshStandardMaterial({ color: 0x7a6a55 })
      );
      mesh.position.y = 1.25;
      mesh.castShadow = true;
      group.add(mesh);
    }

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(3.2, 3.6, 32),
      new THREE.MeshBasicMaterial({
        color: 0x44aaff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.1;
    group.add(ring);

    const hpBar = new THREE.Mesh(
      new THREE.PlaneGeometry(3.5, 0.18),
      new THREE.MeshBasicMaterial({ color: 0x44ff66, depthWrite: false })
    );
    hpBar.position.y = b.type === 'city_center' ? 8.5 : 4.2;
    hpBar.visible = false;
    group.add(hpBar);

    group.userData.buildingId = b.id;
    group.userData.selectionRing = ring;
    group.userData.hpBar = hpBar;
    return group;
  }
}
