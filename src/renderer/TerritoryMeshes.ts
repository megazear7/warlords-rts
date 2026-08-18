import * as THREE from 'three';
import { Simulation, Building } from '../core/Simulation';
import { NATIONS, NationId } from '../data/nations';
import { drapeOnTerrain } from './Terrain';

/**
 * Draws translucent territory rings around city centers.
 */
export class TerritoryMeshes {
  private group = new THREE.Group();
  private rings = new Map<string, THREE.Mesh>();

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
  }

  sync(sim: Simulation) {
    const cities = sim.getAllBuildings().filter((b) => b.type === 'city_center');
    const seen = new Set<string>();

    for (const city of cities) {
      seen.add(city.id);
      let mesh = this.rings.get(city.id);
      const radius =
        city.nation === sim.playerNation ? sim.getTerritoryRadius() : 22;

      if (!mesh) {
        mesh = this.createRing(city, radius);
        this.rings.set(city.id, mesh);
        this.group.add(mesh);
      } else {
        // Resize if needed
        const geo = mesh.geometry as THREE.RingGeometry;
        const params = (geo as any).parameters;
        if (!params || Math.abs(params.outerRadius - radius) > 0.5) {
          mesh.geometry.dispose();
          const geo = new THREE.RingGeometry(radius - 0.6, radius, 64);
          geo.rotateX(-Math.PI / 2);
          mesh.geometry = geo;
        }
      }

      mesh.position.set(city.position.x, 0, city.position.z);
      drapeOnTerrain(mesh.geometry, city.position.x, city.position.z, 0, 0.08);

      const mat = mesh.material as THREE.MeshBasicMaterial;
      const nationId = city.nation as NationId;
      const color = NATIONS[nationId]?.color ?? 0x888888;
      mat.color.setHex(color);
      mat.opacity = city.nation === sim.playerNation ? 0.22 : 0.16;
    }

    for (const [id, mesh] of this.rings) {
      if (!seen.has(id)) {
        this.group.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
        this.rings.delete(id);
      }
    }
  }

  private createRing(city: Building, radius: number): THREE.Mesh {
    const geo = new THREE.RingGeometry(radius - 0.6, radius, 64);
    geo.rotateX(-Math.PI / 2);
    const nationId = city.nation as NationId;
    const color = NATIONS[nationId]?.color ?? 0x888888;
    const mat = new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    return new THREE.Mesh(geo, mat);
  }
}
