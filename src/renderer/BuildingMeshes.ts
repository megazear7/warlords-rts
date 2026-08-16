import * as THREE from 'three';
import { Building } from '../core/Simulation';

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
      }

      mesh.position.set(b.position.x, b.position.y, b.position.z);

      const ring = mesh.userData.selectionRing as THREE.Mesh | undefined;
      if (ring) {
        const mat = ring.material as THREE.MeshBasicMaterial;
        mat.opacity = selectedBuildingId === b.id ? 0.7 : 0;
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
    const isEnemy = b.nation !== 'rome';

    if (b.type === 'city_center') {
      const baseColor = isEnemy ? 0x5a6b45 : 0x8b7355;
      const topColor = isEnemy ? 0x6a7b55 : 0x9c8466;
      const roofColor = isEnemy ? 0x3d5a2a : 0x6b3a2a;
      const flagColor = isEnemy ? 0x2d8b2d : 0xb22222;

      const base = new THREE.Mesh(
        new THREE.BoxGeometry(6, 3.5, 6),
        new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.85 })
      );
      base.position.y = 1.75;
      base.castShadow = true;
      base.receiveShadow = true;
      group.add(base);

      const top = new THREE.Mesh(
        new THREE.BoxGeometry(4.2, 2.2, 4.2),
        new THREE.MeshStandardMaterial({ color: topColor, roughness: 0.8 })
      );
      top.position.y = 4.6;
      top.castShadow = true;
      group.add(top);

      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(3.4, 1.8, 4),
        new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.9 })
      );
      roof.position.y = 6.6;
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      group.add(roof);

      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 3.5, 6),
        new THREE.MeshStandardMaterial({ color: 0x444444 })
      );
      pole.position.set(1.8, 8.2, 1.8);
      group.add(pole);

      const flag = new THREE.Mesh(
        new THREE.PlaneGeometry(1.4, 0.9),
        new THREE.MeshStandardMaterial({ color: flagColor, side: THREE.DoubleSide })
      );
      flag.position.set(2.5, 9.0, 1.8);
      group.add(flag);
    } else if (b.type === 'farm') {
      const plot = new THREE.Mesh(
        new THREE.BoxGeometry(5, 0.15, 5),
        new THREE.MeshStandardMaterial({ color: 0x6b8f3a, roughness: 0.95 })
      );
      plot.position.y = 0.08;
      plot.receiveShadow = true;
      group.add(plot);

      for (let i = -1; i <= 1; i++) {
        const row = new THREE.Mesh(
          new THREE.BoxGeometry(4, 0.35, 0.6),
          new THREE.MeshStandardMaterial({ color: 0x4a7c2a })
        );
        row.position.set(0, 0.3, i * 1.3);
        group.add(row);
      }

      const shed = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 1.6, 1.6),
        new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.9 })
      );
      shed.position.set(2.2, 0.8, 2.0);
      shed.castShadow = true;
      group.add(shed);
    } else if (b.type === 'barracks') {
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(5, 2.8, 5),
        new THREE.MeshStandardMaterial({ color: 0x6b5a4a, roughness: 0.85 })
      );
      base.position.y = 1.4;
      base.castShadow = true;
      base.receiveShadow = true;
      group.add(base);

      for (const [x, z] of [
        [-2, -2],
        [2, -2],
        [-2, 2],
        [2, 2],
      ] as [number, number][]) {
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.12, 0.12, 2.2, 6),
          new THREE.MeshStandardMaterial({ color: 0x4a3a2a })
        );
        post.position.set(x, 1.1, z);
        group.add(post);
      }

      const banner = new THREE.Mesh(
        new THREE.PlaneGeometry(1.2, 1.6),
        new THREE.MeshStandardMaterial({ color: 0x8b0000, side: THREE.DoubleSide })
      );
      banner.position.set(0, 3.5, -2.6);
      group.add(banner);
    } else if (b.type === 'library') {
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(4.5, 2.5, 4.5),
        new THREE.MeshStandardMaterial({ color: 0x7a8a9a, roughness: 0.7 })
      );
      base.position.y = 1.25;
      base.castShadow = true;
      group.add(base);

      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(2.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0xc9a84c, roughness: 0.5, metalness: 0.2 })
      );
      dome.position.y = 2.5;
      dome.castShadow = true;
      group.add(dome);

      for (const [x, z] of [
        [-1.8, -1.8],
        [1.8, -1.8],
        [-1.8, 1.8],
        [1.8, 1.8],
      ] as [number, number][]) {
        const col = new THREE.Mesh(
          new THREE.CylinderGeometry(0.2, 0.22, 2.5, 8),
          new THREE.MeshStandardMaterial({ color: 0xd4c4a8 })
        );
        col.position.set(x, 1.25, z);
        group.add(col);
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

    group.userData.buildingId = b.id;
    group.userData.selectionRing = ring;
    return group;
  }
}
