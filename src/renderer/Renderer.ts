import * as THREE from 'three';
import { Simulation } from '../core/Simulation';
import { createTerrain } from './Terrain';
import { UnitMeshes } from './UnitMeshes';
import { BuildingMeshes } from './BuildingMeshes';
import { ResourceMeshes } from './ResourceMeshes';
import { TerritoryMeshes } from './TerritoryMeshes';

export class Renderer {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;

  private unitMeshes: UnitMeshes;
  private buildingMeshes: BuildingMeshes;
  private resourceMeshes: ResourceMeshes;
  private territoryMeshes: TerritoryMeshes;

  cameraTarget = new THREE.Vector3(0, 0, 0);
  cameraDistance = 55;
  cameraTheta = Math.PI / 4;
  cameraPhi = 0.9;

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87a0b8);
    this.scene.fog = new THREE.Fog(0x87a0b8, 80, 220);

    this.camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.5,
      500
    );

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    const ambient = new THREE.AmbientLight(0xb0c4de, 0.55);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xfff4e0, 1.1);
    sun.position.set(40, 60, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 200;
    sun.shadow.camera.left = -80;
    sun.shadow.camera.right = 80;
    sun.shadow.camera.top = 80;
    sun.shadow.camera.bottom = -80;
    this.scene.add(sun);

    createTerrain(this.scene);

    this.unitMeshes = new UnitMeshes(this.scene);
    this.buildingMeshes = new BuildingMeshes(this.scene);
    this.resourceMeshes = new ResourceMeshes(this.scene);
    this.territoryMeshes = new TerritoryMeshes(this.scene);

    window.addEventListener('resize', () => this.onResize(container));
  }

  private onResize(container: HTMLElement) {
    const w = container.clientWidth;
    const h = container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  updateCamera() {
    const x = this.cameraTarget.x + this.cameraDistance * Math.sin(this.cameraPhi) * Math.cos(this.cameraTheta);
    const y = this.cameraTarget.y + this.cameraDistance * Math.cos(this.cameraPhi);
    const z = this.cameraTarget.z + this.cameraDistance * Math.sin(this.cameraPhi) * Math.sin(this.cameraTheta);
    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.cameraTarget);
  }

  render(sim: Simulation, _alpha: number) {
    this.updateCamera();

    this.territoryMeshes.sync(sim);
    // Fog of war: hide enemy units outside current player vision
    const visibleUnits = sim.getAllUnits().filter(
      (u) => u.nation === sim.playerNation || sim.isVisibleToPlayer(u.position)
    );
    this.unitMeshes.sync(visibleUnits, sim.selected);
    this.buildingMeshes.sync(sim.getAllBuildings(), sim.selectedBuildingId);
    this.resourceMeshes.sync(sim.getAllResourceNodes());

    this.renderer.render(this.scene, this.camera);
  }

  get domElement() {
    return this.renderer.domElement;
  }
}
