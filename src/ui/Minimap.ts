import { Simulation } from '../core/Simulation';
import { NATIONS, NationId } from '../data/nations';

const SIZE = 160;
const FRAME = Math.ceil(SIZE * Math.SQRT2);

export class Minimap {
  private root: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private visible = false;
  private lastTheta = Math.PI / 4;
  private lastWorld = 360;
  private onJump: ((x: number, z: number) => void) | null = null;

  constructor() {
    this.root = document.createElement('div');
    this.root.id = 'minimap';
    this.root.style.cssText = `
      position: absolute; right: 12px; bottom: 12px;
      width: ${FRAME}px; height: ${FRAME}px;
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 15;
      pointer-events: none;
    `;

    this.canvas = document.createElement('canvas');
    this.canvas.width = SIZE;
    this.canvas.height = SIZE;
    this.canvas.style.cssText = `
      width: ${SIZE}px; height: ${SIZE}px;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.15);
      background: rgba(0,0,0,0.55);
      transform-origin: center center;
      pointer-events: auto;
      cursor: pointer;
    `;
    this.root.appendChild(this.canvas);
    document.getElementById('app')?.appendChild(this.root);
    this.ctx = this.canvas.getContext('2d')!;

    const jump = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const world = this.clientToWorld(e.clientX, e.clientY);
      if (world) this.onJump?.(world.x, world.z);
    };
    this.canvas.addEventListener('pointerdown', jump);
  }

  setOnJump(cb: (x: number, z: number) => void) {
    this.onJump = cb;
  }

  private clientToWorld(clientX: number, clientY: number): { x: number; z: number } | null {
    const rootRect = this.root.getBoundingClientRect();
    const cx = rootRect.left + rootRect.width / 2;
    const cy = rootRect.top + rootRect.height / 2;
    const lx = clientX - cx;
    const ly = clientY - cy;
    const theta = this.lastTheta;
    const c = Math.cos(-theta);
    const s = Math.sin(-theta);
    const rx = lx * c - ly * s;
    const ry = lx * s + ly * c;
    const px = rx + SIZE / 2;
    const py = ry + SIZE / 2;
    if (px < 0 || py < 0 || px > SIZE || py > SIZE) return null;
    const half = this.lastWorld / 2;
    const x = (px / SIZE) * this.lastWorld - half;
    const z = (py / SIZE) * this.lastWorld - half;
    return {
      x: Math.max(-half, Math.min(half, x)),
      z: Math.max(-half, Math.min(half, z)),
    };
  }

  setVisible(v: boolean) {
    this.visible = v;
    this.root.style.display = v ? 'flex' : 'none';
  }

  update(
    sim: Simulation,
    cameraTheta = Math.PI / 4,
    cameraTarget?: { x: number; z: number }
  ) {
    if (!this.visible) return;
    this.lastTheta = cameraTheta;
    this.lastWorld = sim.worldSize;
    this.canvas.style.transform = `rotate(${cameraTheta}rad)`;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, SIZE, SIZE);
    const WORLD = sim.worldSize;

    const toXY = (x: number, z: number) => ({
      px: ((x + WORLD / 2) / WORLD) * SIZE,
      py: ((z + WORLD / 2) / WORLD) * SIZE,
    });

    // Ground — unexplored near-black
    ctx.fillStyle = '#0a0c0a';
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Explored cells as muted terrain
    const CELL = 8;
    ctx.fillStyle = '#2a3a28';
    for (const key of sim.exploredCells) {
      const [gsx, gsz] = key.split(',').map(Number);
      const wx = gsx * CELL + CELL / 2;
      const wz = gsz * CELL + CELL / 2;
      const { px, py } = toXY(wx, wz);
      const s = (CELL / WORLD) * SIZE * 1.1;
      ctx.fillRect(px - s / 2, py - s / 2, s, s);
    }

    // Territory soft blobs via cities
    for (const b of sim.getAllBuildings()) {
      if (b.type !== 'city_center') continue;
      const { px, py } = toXY(b.position.x, b.position.z);
      const r =
        ((b.nation === sim.playerNation ? sim.getTerritoryRadius() : 22) / WORLD) * SIZE;
      const nationId = b.nation as NationId;
      const color = NATIONS[nationId]?.color ?? 0x888888;
      const hex = '#' + color.toString(16).padStart(6, '0');
      ctx.beginPath();
      ctx.fillStyle = hex + '44';
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Resources
    for (const n of sim.getAllResourceNodes()) {
      if (n.amount <= 0) continue;
      if (!sim.isExplored(n.position)) continue;
      const { px, py } = toXY(n.position.x, n.position.z);
      ctx.fillStyle =
        n.type === 'food' ? '#88cc44' : n.type === 'timber' ? '#aa7744' : '#aaaaaa';
      ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
    }

    // Buildings (enemy only if in vision)
    for (const b of sim.getAllBuildings()) {
      if (b.nation !== sim.playerNation && !sim.isVisibleToPlayer(b.position)) continue;
      const { px, py } = toXY(b.position.x, b.position.z);
      const nationId = b.nation as NationId;
      const color = NATIONS[nationId]?.color ?? 0x888888;
      ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
      const s = b.type === 'city_center' ? 5 : 3;
      ctx.fillRect(px - s / 2, py - s / 2, s, s);
    }

    // Units
    for (const u of sim.getAllUnits()) {
      if (u.nation !== sim.playerNation && !sim.isVisibleToPlayer(u.position)) continue;
      if (u.hp <= 0) continue;
      const { px, py } = toXY(u.position.x, u.position.z);
      const isPlayer = u.nation === sim.playerNation;
      ctx.fillStyle = isPlayer ? '#44ff88' : '#ff5555';
      if (sim.selected.has(u.id)) ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(px, py, isPlayer ? 2.2 : 2, 0, Math.PI * 2);
      ctx.fill();
    }

    if (cameraTarget) {
      const { px, py } = toXY(cameraTarget.x, cameraTarget.z);
      ctx.strokeStyle = '#f0c040';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(px - 5, py - 5, 10, 10);
    }
  }
}
