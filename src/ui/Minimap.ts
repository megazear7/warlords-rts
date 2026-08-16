import { Simulation } from '../core/Simulation';
import { NATIONS, NationId } from '../data/nations';

const SIZE = 160;
const WORLD = 120;

export class Minimap {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private visible = false;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'minimap';
    this.canvas.width = SIZE;
    this.canvas.height = SIZE;
    this.canvas.style.cssText = `
      position: absolute; right: 12px; bottom: 12px;
      width: ${SIZE}px; height: ${SIZE}px;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.15);
      background: rgba(0,0,0,0.55);
      z-index: 15;
      display: none;
      pointer-events: none;
    `;
    document.getElementById('app')?.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
  }

  setVisible(v: boolean) {
    this.visible = v;
    this.canvas.style.display = v ? 'block' : 'none';
  }

  update(sim: Simulation) {
    if (!this.visible) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, SIZE, SIZE);

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
  }
}
