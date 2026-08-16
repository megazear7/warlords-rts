import * as THREE from 'three';
import { ResourceNode } from '../core/Simulation';

/**
 * Visual representation of resource nodes (food bushes, trees, mines).
 */
export class ResourceMeshes {
  private group = new THREE.Group();
  private meshes = new Map<string, THREE.Object3D>();

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
  }

  sync(nodes: ResourceNode[]) {
    const seen = new Set<string>();

    for (const node of nodes) {
      if (node.amount <= 0) continue; // depleted → hide
      seen.add(node.id);

      let mesh = this.meshes.get(node.id);
      if (!mesh) {
        mesh = this.createPlaceholder(node);
        this.meshes.set(node.id, mesh);
        this.group.add(mesh);
      }

      mesh.position.set(node.position.x, 0, node.position.z);

      // Scale down slightly as it depletes
      const ratio = node.amount / node.maxAmount;
      const s = 0.6 + ratio * 0.4;
      mesh.scale.setScalar(s);
    }

    for (const [id, mesh] of this.meshes) {
      if (!seen.has(id)) {
        this.group.remove(mesh);
        this.meshes.delete(id);
      }
    }
  }

  private createPlaceholder(node: ResourceNode): THREE.Object3D {
    const group = new THREE.Group();

    if (node.type === 'food') {
      // Bush / berry cluster
      const geo = new THREE.SphereGeometry(1.1, 8, 6);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x3d8b37,
        roughness: 0.9,
      });
      const bush = new THREE.Mesh(geo, mat);
      bush.position.y = 1.0;
      bush.castShadow = true;
      group.add(bush);

      // Small berries
      for (let i = 0; i < 4; i++) {
        const berry = new THREE.Mesh(
          new THREE.SphereGeometry(0.18, 6, 4),
          new THREE.MeshStandardMaterial({ color: 0xc41e3a })
        );
        const a = (i / 4) * Math.PI * 2;
        berry.position.set(Math.cos(a) * 0.7, 1.2, Math.sin(a) * 0.7);
        group.add(berry);
      }
    } else if (node.type === 'timber') {
      // Tree trunk + foliage
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.35, 2.2, 6),
        new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.95 })
      );
      trunk.position.y = 1.1;
      trunk.castShadow = true;
      group.add(trunk);

      const foliage = new THREE.Mesh(
        new THREE.ConeGeometry(1.6, 3.2, 7),
        new THREE.MeshStandardMaterial({ color: 0x2d5a27, roughness: 0.85 })
      );
      foliage.position.y = 3.4;
      foliage.castShadow = true;
      group.add(foliage);
    } else {
      // Metal – rocky outcrop
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(1.3, 0),
        new THREE.MeshStandardMaterial({
          color: 0x6a6e72,
          roughness: 0.7,
          metalness: 0.35,
        })
      );
      rock.position.y = 0.9;
      rock.castShadow = true;
      group.add(rock);
    }

    group.userData.resourceNodeId = node.id;
    return group;
  }
}
