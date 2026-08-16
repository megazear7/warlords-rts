import { Simulation } from '../core/Simulation';

/**
 * Minimap canvas — shows explored cells + currently visible units/buildings/resources.
 * Click to pan camera. Filters by isExplored / isVisibleToPlayer.
 */
export class Minimap {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private sim: Simulation;
  private size = 160;
  private worldSize = 120;

  constructor(container: HTMLElement, sim: Simulation) {
    this.sim = sim;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.size;
    this.canvas.height = this.size;
    this.canvas.style.cssText =
      'position:absolute;bottom:12px;right:12px;border:2px solid #444;background:#111;cursor:pointer;z-index:40;';
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    this.canvas.addEventListener('click', this.onClick);
  }

  dispose() {
    this.canvas.removeEventListener('click', this.onClick);
    this.canvas.remove();
  }

  private onClick = (e: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const x = (mx / this.size - 0.5) * this.worldSize;
    const z = (my / this.size - 0.5) * this.worldSize;
    // Camera pan is handled by Game/Renderer via event or direct; for now toast
    (window as any).__warlordsMinimapClick?.({ x, z });
  };

  update() {
    const ctx = this.ctx;
    const s = this.size;
    const w = this.worldSize;
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, s, s);

    // Explored cells (coarse)
    const cell = 8;
    const explored = (this.sim as any).exploredCells as Set<string> | undefined;
    if (explored) {
      ctx.fillStyle = '#1a1a2e';
      for (const key of explored) {
        const [cx, cz] = key.split(',').map(Number);
        const px = ((cx * cell + cell / 2) / w + 0.5) * s;
        const py = ((cz * cell + cell / 2) / w + 0.5) * s;
        ctx.fillRect(px - 1, py - 1, 3, 3);
      }
    }

    const isVisible = (x: number, z: number) =>
      typeof (this.sim as any).isVisibleToPlayer === 'function'
        ? (this.sim as any).isVisibleToPlayer(x, z)
        : true;
    const isExplored = (x: number, z: number) =>
      typeof (this.sim as any).isExplored === 'function'
        ? (this.sim as any).isExplored(x, z)
        : true;

    // Resources
    for (const n of this.sim.getAllResourceNodes?.() ?? []) {
      if (!isExplored(n.position.x, n.position.z)) continue;
      ctx.fillStyle = n.type === 'food' ? '#4a4' : n.type === 'timber' ? '#864' : '#888';
      const px = (n.position.x / w + 0.5) * s;
      const py = (n.position.z / w + 0.5) * s;
      ctx.fillRect(px - 1, py - 1, 2, 2);
    }

    // Buildings
    for (const b of this.sim.getAllBuildings?.() ?? []) {
      if (!isExplored(b.position.x, b.position.z) && b.nation !== this.sim.playerNation) continue;
      if (b.nation !== this.sim.playerNation && !isVisible(b.position.x, b.position.z)) continue;
      ctx.fillStyle = b.nation === this.sim.playerNation ? '#4af' : '#f44';
      const px = (b.position.x / w + 0.5) * s;
      const py = (b.position.z / w + 0.5) * s;
      ctx.fillRect(px - 2, py - 2, 4, 4);
    }

    // Units
    for (const u of this.sim.getAllUnits?.() ?? []) {
      if (u.hp <= 0) continue;
      if (u.nation !== this.sim.playerNation && !isVisible(u.position.x, u.position.z)) continue;
      ctx.fillStyle = u.nation === this.sim.playerNation ? '#8cf' : '#f88';
      const px = (u.position.x / w + 0.5) * s;
      const py = (u.position.z / w + 0.5) * s;
      ctx.beginPath();
      ctx.arc(px, py, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
