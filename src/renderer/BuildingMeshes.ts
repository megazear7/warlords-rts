import * as THREE from 'three';
import { Building } from '../core/Simulation';

/**
 * Visual representation of buildings.
 */
export class BuildingMeshes {
  private group = new THREE.Group();
  private meshes = new Map<string, THREE.Object3D>();

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
  }

  sync(buildings: Building[]) {
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

    if (b.type === 'city_center') {
      const baseGeo = new THREE.BoxGeometry(6, 3.5, 6);
      const baseMat = new THREE.MeshStandardMaterial({
        color: 0x8b7355,
        roughness: 0.85,
      });
      const base = new THREE.Mesh(baseGeo, baseMat);
      base.position.y = 1.75;
      base.castShadow = true;
      base.receiveShadow = true;
      group.add(base);

      const topGeo = new THREE.BoxGeometry(4.2, 2.2, 4.2);
      const topMat = new THREE.MeshStandardMaterial({
        color: 0x9c8466,
        roughness: 0.8,
      });
      const top = new THREE.Mesh(topGeo, topMat);
      top.position.y = 4.6;
      top.castShadow = true;
      group.add(top);

      const roofGeo = new THREE.ConeGeometry(3.4, 1.8, 4);
      const roofMat = new THREE.MeshStandardMaterial({
        color: 0x6b3a2a,
        roughness: 0.9,
      });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.y = 6.6;
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      group.add(roof);

      const poleGeo = new THREE.CylinderGeometry(0.06, 0.06, 3.5, 6);
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(1.8, 8.2, 1.8);
      group.add(pole);

      const flagGeo = new THREE.PlaneGeometry(1.4, 0.9);
      const flagMat = new THREE.MeshStandardMaterial({
        color: 0xb22222,
        side: THREE.DoubleSide,
      });
      const flag = new THREE.Mesh(flagGeo, flagMat);
      flag.position.set(2.5, 9.0, 1.8);
      group.add(flag);
    } else if (b.type === 'farm') {
      // Simple farm plot + shed
      const plot = new THREE.Mesh(
        new THREE.BoxGeometry(5, 0.15, 5),
        new THREE.MeshStandardMaterial({ color: 0x6b8f3a, roughness: 0.95 })
      );
      plot.position.y = 0.08;
      plot.receiveShadow = true;
      group.add(plot);

      // Crop rows
      for (let i = -1; i <= 1; i++) {
        const row = new THREE.Mesh(
          new THREE.BoxGeometry(4, 0.35, 0.6),
          new THREE.MeshStandardMaterial({ color: 0x4a7c2a })
        );
        row.position.set(0, 0.3, i * 1.3);
        group.add(row);
      }

      // Small shed
      const shed = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 1.6, 1.6),
        new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.9 })
      );
      shed.position.set(2.2, 0.8, 2.0);
      shed.castShadow = true;
      group.add(shed);
    } else {
      const geo = new THREE.BoxGeometry(3, 2.5, 3);
      const mat = new THREE.MeshStandardMaterial({ color: 0x7a6a55 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = 1.25;
      mesh.castShadow = true;
      group.add(mesh);
    }

    group.userData.buildingId = b.id;
    return group;
  }
}
