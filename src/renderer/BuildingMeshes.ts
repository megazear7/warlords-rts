import * as THREE from 'three';
import { Building } from '../core/Simulation';
import { NATIONS, NationId } from '../data/nations';

export class BuildingMeshes {
  private group = new THREE.Group();
  private meshes = new Map<string, THREE.Object3D>();

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
  }

  sync(buildings: Building[], selectedId?: string | null) {
    const seen = new Set<string>();
    for (const b of buildings) {
      if (b.hp <= 0 && b.type !== 'city_center') continue;
      seen.add(b.id);
      let mesh = this.meshes.get(b.id);
      if (!mesh) {
        mesh = this.createBuilding(b);
        this.meshes.set(b.id, mesh);
        this.group.add(mesh);
      }
      mesh.position.set(b.position.x, b.position.y, b.position.z);
      const ring = mesh.userData.selectionRing as THREE.Mesh | undefined;
      if (ring) ring.visible = selectedId === b.id;

      // HP bar
      const hpBar = mesh.userData.hpBar as THREE.Mesh | undefined;
      if (hpBar) {
        const ratio = Math.max(0, b.hp / b.maxHp);
        hpBar.scale.x = ratio;
        hpBar.visible = ratio < 0.99;
        (hpBar.material as THREE.MeshBasicMaterial).color.setHex(
          ratio > 0.5 ? 0x44ff66 : ratio > 0.25 ? 0xffcc00 : 0xff3333
        );
      }
    }
    for (const [id, mesh] of this.meshes) {
      if (!seen.has(id)) {
        this.group.remove(mesh);
        this.meshes.delete(id);
      }
    }
  }

  private createBuilding(b: Building): THREE.Object3D {
    const group = new THREE.Group();
    const nationId = b.nation as NationId;
    const color = NATIONS[nationId]?.color ?? 0x888888;

    if (b.type === 'city_center') {
      // Base podium
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(3.2, 3.6, 1.2, 8),
        new THREE.MeshStandardMaterial({ color: 0x666655, roughness: 0.8 })
      );
      base.position.y = 0.6;
      base.castShadow = true;
      base.receiveShadow = true;
      group.add(base);

      // Main structure
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(4.5, 4.5, 4.5),
        new THREE.MeshStandardMaterial({ color, roughness: 0.7 })
      );
      body.position.y = 3.3;
      body.castShadow = true;
      group.add(body);

      // Roof / flag pole
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(3.2, 2.2, 4),
        new THREE.MeshStandardMaterial({ color: 0x444433, roughness: 0.6 })
      );
      roof.position.y = 6.6;
      roof.castShadow = true;
      group.add(roof);

      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 3.5, 6),
        new THREE.MeshStandardMaterial({ color: 0x222211 })
      );
      pole.position.y = 8.5;
      group.add(pole);

      const flag = new THREE.Mesh(
        new THREE.PlaneGeometry(1.4, 0.9),
        new THREE.MeshStandardMaterial({
          color,
          side: THREE.DoubleSide,
          roughness: 0.5,
        })
      );
      flag.position.set(0.7, 9.5, 0);
      group.add(flag);
    } else if (b.type === 'farm') {
      const plot = new THREE.Mesh(
        new THREE.BoxGeometry(5, 0.15, 5),
        new THREE.MeshStandardMaterial({ color: 0x5a7a3a, roughness: 0.9 })
      );
      plot.position.y = 0.08;
      plot.receiveShadow = true;
      group.add(plot);

      for (let i = 0; i < 9; i++) {
        const crop = new THREE.Mesh(
          new THREE.BoxGeometry(0.4, 0.9 + Math.random() * 0.4, 0.4),
          new THREE.MeshStandardMaterial({ color: 0x88aa44 })
        );
        crop.position.set(
          ((i % 3) - 1) * 1.4,
          0.5,
          (Math.floor(i / 3) - 1) * 1.4
        );
        group.add(crop);
      }

      const shed = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 1.6, 1.4),
        new THREE.MeshStandardMaterial({ color: 0x8b6914 })
      );
      shed.position.set(1.8, 0.8, -1.6);
      shed.castShadow = true;
      group.add(shed);
    } else if (b.type === 'barracks') {
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(5, 1.2, 4),
        new THREE.MeshStandardMaterial({ color: 0x555544, roughness: 0.8 })
      );
      base.position.y = 0.6;
      base.castShadow = true;
      group.add(base);

      const body = new THREE.Mesh(
        new THREE.BoxGeometry(4.2, 3.2, 3.4),
        new THREE.MeshStandardMaterial({ color, roughness: 0.7 })
      );
      body.position.y = 2.8;
      body.castShadow = true;
      group.add(body);

      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(4.6, 0.4, 3.8),
        new THREE.MeshStandardMaterial({ color: 0x333322 })
      );
      roof.position.y = 4.6;
      group.add(roof);
    } else if (b.type === 'library') {
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(2.8, 3.0, 0.8, 8),
        new THREE.MeshStandardMaterial({ color: 0x666655 })
      );
      base.position.y = 0.4;
      group.add(base);

      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(2.4, 2.6, 4.5, 8),
        new THREE.MeshStandardMaterial({ color: 0xddccaa, roughness: 0.6 })
      );
      body.position.y = 3.0;
      body.castShadow = true;
      group.add(body);

      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(2.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0xccaa66 })
      );
      dome.position.y = 5.3;
      group.add(dome);
    } else if (b.type === 'tower') {
      // Watchtower
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(1.4, 1.8, 1.0, 6),
        new THREE.MeshStandardMaterial({ color: 0x555544 })
      );
      base.position.y = 0.5;
      base.castShadow = true;
      group.add(base);

      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(1.0, 1.2, 5.5, 6),
        new THREE.MeshStandardMaterial({ color, roughness: 0.75 })
      );
      shaft.position.y = 3.8;
      shaft.castShadow = true;
      group.add(shaft);

      const top = new THREE.Mesh(
        new THREE.BoxGeometry(2.8, 1.4, 2.8),
        new THREE.MeshStandardMaterial({ color: 0x444433 })
      );
      top.position.y = 7.0;
      top.castShadow = true;
      group.add(top);

      // Battlements
      for (let i = 0; i < 4; i++) {
        const merlon = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 0.7, 0.5),
          new THREE.MeshStandardMaterial({ color: 0x333322 })
        );
        const a = (i / 4) * Math.PI * 2;
        merlon.position.set(Math.cos(a) * 1.2, 7.9, Math.sin(a) * 1.2);
        group.add(merlon);
      }
    } else if (b.type === 'market') {
      // Market stall / trading post
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(4.5, 0.4, 3.5),
        new THREE.MeshStandardMaterial({ color: 0x8b6914 })
      );
      base.position.y = 0.2;
      base.receiveShadow = true;
      group.add(base);

      const posts = [
        [-1.8, -1.3],
        [1.8, -1.3],
        [-1.8, 1.3],
        [1.8, 1.3],
      ];
      for (const [x, z] of posts) {
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.12, 0.12, 2.8, 6),
          new THREE.MeshStandardMaterial({ color: 0x5a3a1a })
        );
        post.position.set(x, 1.5, z);
        group.add(post);
      }

      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(5.0, 0.25, 4.0),
        new THREE.MeshStandardMaterial({ color: 0xaa6633, roughness: 0.7 })
      );
      roof.position.y = 3.0;
      roof.castShadow = true;
      group.add(roof);

      // Awning stripe
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(4.8, 0.08, 0.6),
        new THREE.MeshStandardMaterial({ color })
      );
      stripe.position.set(0, 2.9, 1.6);
      group.add(stripe);
    } else if (b.type === 'wall') {
      // Defensive wall segment
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(5.5, 3.2, 1.2),
        new THREE.MeshStandardMaterial({ color: 0x6a6a5a, roughness: 0.85 })
      );
      wall.position.y = 1.6;
      wall.castShadow = true;
      wall.receiveShadow = true;
      group.add(wall);

      // Top crenellations
      for (let i = -2; i <= 2; i++) {
        const c = new THREE.Mesh(
          new THREE.BoxGeometry(0.7, 0.8, 1.4),
          new THREE.MeshStandardMaterial({ color: 0x555544 })
        );
        c.position.set(i * 1.1, 3.6, 0);
        group.add(c);
      }
    } else {
      // Generic fallback
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(3, 2.5, 3),
        new THREE.MeshStandardMaterial({ color })
      );
      body.position.y = 1.25;
      body.castShadow = true;
      group.add(body);
    }

    // Selection ring
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(3.5, 3.9, 32),
      new THREE.MeshBasicMaterial({
        color: 0x4488ff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.12;
    ring.visible = false;
    group.add(ring);

    // HP bar
    const hpBar = new THREE.Mesh(
      new THREE.PlaneGeometry(3.5, 0.25),
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
