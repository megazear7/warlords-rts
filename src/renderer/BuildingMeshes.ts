import * as THREE from 'three';
import { Building } from '../core/Simulation';
import { NATIONS, NationId } from '../data/nations';
import { drapeOnTerrain, sampleTerrainHeightRange } from './Terrain';

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

      const pad = this.buildingFootprint(b.type);
      const { min, max } = sampleTerrainHeightRange(b.position.x, b.position.z, pad.hx, pad.hz);
      mesh.position.set(b.position.x, max, b.position.z);

      const foundation = mesh.userData.foundation as THREE.Mesh | undefined;
      if (foundation) {
        const span = Math.max(0.22, max - min + 0.16);
        foundation.scale.y = span;
        foundation.position.y = -span / 2;
      }

      const ring = mesh.userData.selectionRing as THREE.Group | undefined;
      if (ring) {
        ring.visible = selectedBuildingId === b.id;
        if (ring.visible) {
          for (const child of ring.children) {
            if (child instanceof THREE.Mesh) {
              drapeOnTerrain(child.geometry, b.position.x, b.position.z, max, 0.08);
            }
          }
        }
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

  private buildingFootprint(type: string): { hx: number; hz: number } {
    switch (type) {
      case 'city_center':
        return { hx: 3.1, hz: 3.1 };
      case 'farm':
      case 'barracks':
        return { hx: 2.6, hz: 2.6 };
      case 'library':
      case 'market':
        return { hx: 2.4, hz: 2.4 };
      case 'tower':
        return { hx: 2.1, hz: 2.1 };
      case 'wall':
        return { hx: 2.85, hz: 0.8 };
      default:
        return { hx: 1.6, hz: 1.6 };
    }
  }

  private selectionRadius(type: string): { inner: number; outer: number } {
    switch (type) {
      case 'city_center':
        return { inner: 5.1, outer: 5.85 };
      case 'farm':
      case 'barracks':
        return { inner: 3.7, outer: 4.3 };
      case 'library':
      case 'market':
        return { inner: 3.4, outer: 4.0 };
      case 'tower':
        return { inner: 2.4, outer: 3.0 };
      case 'wall':
        return { inner: 3.3, outer: 3.9 };
      default:
        return { inner: 2.4, outer: 3.0 };
    }
  }

  private createSelectionCircle(type: string): THREE.Group {
    const { inner, outer } = this.selectionRadius(type);
    const g = new THREE.Group();
    const mat = {
      color: 0x44ff88,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    } as const;

    const fillGeo = new THREE.CircleGeometry(outer, 48);
    fillGeo.rotateX(-Math.PI / 2);
    const ringGeo = new THREE.RingGeometry(inner, outer, 48);
    ringGeo.rotateX(-Math.PI / 2);
    const fill = new THREE.Mesh(
      fillGeo,
      new THREE.MeshBasicMaterial({ ...mat, opacity: 0.2 })
    );
    const outline = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({ ...mat, opacity: 0.95 })
    );
    g.add(fill);
    g.add(outline);
    g.visible = false;
    return g;
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

      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(3.4, 1.8, 4),
        new THREE.MeshStandardMaterial({ color: 0x6b3a2a, roughness: 0.9 })
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
        new THREE.MeshStandardMaterial({ color: nationColor, side: THREE.DoubleSide })
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
      const banner = new THREE.Mesh(
        new THREE.PlaneGeometry(1.2, 1.6),
        new THREE.MeshStandardMaterial({ color: nationColor, side: THREE.DoubleSide })
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
    } else if (b.type === 'tower') {
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(1.6, 2.0, 2.2, 8),
        new THREE.MeshStandardMaterial({ color: 0x6a6a6a, roughness: 0.85 })
      );
      base.position.y = 1.1;
      base.castShadow = true;
      group.add(base);
      const top = new THREE.Mesh(
        new THREE.CylinderGeometry(1.9, 1.6, 1.4, 8),
        new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.8 })
      );
      top.position.y = 2.9;
      top.castShadow = true;
      group.add(top);
      const battlement = new THREE.Mesh(
        new THREE.BoxGeometry(3.2, 0.5, 3.2),
        new THREE.MeshStandardMaterial({ color: 0x4a4a4a })
      );
      battlement.position.y = 3.8;
      group.add(battlement);
      const flag = new THREE.Mesh(
        new THREE.PlaneGeometry(0.8, 0.5),
        new THREE.MeshStandardMaterial({ color: nationColor, side: THREE.DoubleSide })
      );
      flag.position.set(0.6, 4.5, 0);
      group.add(flag);
    } else if (b.type === 'market') {
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(4.5, 1.8, 4.5),
        new THREE.MeshStandardMaterial({ color: 0xa08050, roughness: 0.85 })
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
      // Defensive wall segment
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
      // Crenellations
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

    const pad = this.buildingFootprint(b.type);
    const foundation = new THREE.Mesh(
      new THREE.BoxGeometry(pad.hx * 2, 1, pad.hz * 2),
      new THREE.MeshStandardMaterial({ color: 0x5a4a38, roughness: 1 })
    );
    foundation.position.y = -0.12;
    foundation.receiveShadow = true;
    group.add(foundation);

    const ring = this.createSelectionCircle(b.type);
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
    group.userData.foundation = foundation;
    return group;
  }
}
