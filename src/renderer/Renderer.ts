import * as THREE from 'three';
import { Simulation } from '../core/Simulation';
import { createTerrain } from './Terrain';
import { UnitMeshes } from './UnitMeshes';
import { BuildingMeshes } from './BuildingMeshes';

export class Renderer {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;

  private unitMeshes: UnitMeshes;
  private buildingMeshes: BuildingMeshes;
  private terrain: THREE.Mesh;

  // Camera control state (exposed for InputManager)
  cameraTarget = new THREE.Vector3(0, 0, 0);
  cameraDistance = 55;
  cameraTheta = Math.PI / 4; // horizontal angle
  cameraPhi = 0.9; // vertical angle (radians from zenith-ish)

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

    // Lighting
    const ambient = new THREE.AmbientLight(0xb0c4de, 0.55);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xfff4e0, 1.1);
    sun.position.set(40, 60, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 150;
    sun.shadow.camera.left = -60;
    sun.shadow.camera.right = 60;
    sun.shadow.camera.top = 60;
    sun.shadow.camera.bottom = -60;
    this.scene.add(sun);

    // Terrain
    this.terrain = createTerrain(120);
    this.scene.add(this.terrain);

    // Mesh managers
    this.unitMeshes = new UnitMeshes(this.scene);
    this.buildingMeshes = new BuildingMeshes(this.scene);

    // Handle resize
    window.addEventListener('resize', () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });

    this.updateCamera();
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

    // Sync meshes to simulation state
    this.unitMeshes.sync(sim.getAllUnits());
    this.buildingMeshes.sync(sim.getAllBuildings());

    this.renderer.render(this.scene, this.camera);
  }

  get domElement() {
    return this.renderer.domElement;
  }
}
