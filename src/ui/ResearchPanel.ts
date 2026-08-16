import { Simulation } from '../core/Simulation';

type ResearchTrack = 'science' | 'civic' | 'military' | 'commerce';

const TRACK_META: Record<ResearchTrack, { label: string; icon: string; effect: string }> = {
  science: {
    label: 'Science',
    icon: '🔬',
    effect: 'Reduces research time by 8% per level',
  },
  civic: {
    label: 'Civic',
    icon: '🏛️',
    effect: 'Unlocks additional city slots (+1 city per level); boosts farm output (+0.35/level)',
  },
  military: {
    label: 'Military',
    icon: '⚔️',
    effect: 'Unlocks towers (Lv1), walls (Lv2), generals (Lv1); +10 pop cap per level',
  },
  commerce: {
    label: 'Commerce',
    icon: '💹',
    effect: 'Unlocks market (Lv1); improves trade exchange rates',
  },
};

const TRACKS: ResearchTrack[] = ['science', 'civic', 'military', 'commerce'];

/**
 * A snapshot of the research state used to detect when a re-render is needed,
 * so we avoid rebuilding the entire DOM subtree every animation frame.
 */
interface RenderSnapshot {
  science: number;
  civic: number;
  military: number;
  commerce: number;
  current: string | undefined;
  progressPct: number;
  hasLibrary: boolean;
  knowledge: number;
  wealth: number;
}

function snapshotFrom(sim: Simulation): RenderSnapshot {
  const rs = sim.research;
  const hasLibrary = sim.getAllBuildings().some(
    (b) => b.type === 'library' && b.nation === sim.playerNation
  );
  return {
    science: rs.science,
    civic: rs.civic,
    military: rs.military,
    commerce: rs.commerce,
    current: rs.current,
    progressPct: Math.floor(rs.progress * 100),
    hasLibrary,
    knowledge: Math.floor(sim.resources.knowledge),
    wealth: Math.floor(sim.resources.wealth),
  };
}

function snapshotsEqual(a: RenderSnapshot, b: RenderSnapshot): boolean {
  return (
    a.science === b.science &&
    a.civic === b.civic &&
    a.military === b.military &&
    a.commerce === b.commerce &&
    a.current === b.current &&
    a.progressPct === b.progressPct &&
    a.hasLibrary === b.hasLibrary &&
    a.knowledge === b.knowledge &&
    a.wealth === b.wealth
  );
}

export class ResearchPanel {
  private root: HTMLElement;
  private visible = false;
  private onResearch?: (track: ResearchTrack) => void;
  private lastSnapshot: RenderSnapshot | null = null;

  constructor() {
    this.root = document.createElement('div');
    this.root.id = 'research-panel';
    this.root.style.display = 'none';
    document.getElementById('app')?.appendChild(this.root);
  }

  setOnResearch(cb: (track: ResearchTrack) => void) {
    this.onResearch = cb;
  }

  isVisible() {
    return this.visible;
  }

  toggle() {
    this.visible ? this.hide() : this.show();
  }

  show() {
    this.visible = true;
    this.root.style.display = 'block';
  }

  hide() {
    this.visible = false;
    this.root.style.display = 'none';
    this.lastSnapshot = null;
  }

  update(sim: Simulation) {
    if (!this.visible) return;

    const snapshot = snapshotFrom(sim);
    if (this.lastSnapshot && snapshotsEqual(this.lastSnapshot, snapshot)) return;
    this.lastSnapshot = snapshot;

    this.render(sim, snapshot);
  }

  private render(sim: Simulation, snapshot: RenderSnapshot) {
    const rs = sim.research;
    const inProgress = rs.current;

    const rows = TRACKS.map((track) => {
      const meta = TRACK_META[track];
      const level = rs[track];
      const cost = sim.getResearchCost(level);
      const reason = sim.canTryResearch(track);
      const canResearch = reason === null;
      const isActive = inProgress === track;
      const isMaxed = level >= 5;

      let btnLabel = 'Research';
      if (isMaxed) btnLabel = 'Maxed';
      else if (isActive) btnLabel = `${snapshot.progressPct}%…`;

      const costStr = isMaxed ? '—' : `📚 ${cost.knowledge}  💰 ${cost.wealth}`;
      const disabledAttr = (canResearch && !isActive && !isMaxed) ? '' : 'disabled';
      const rowClass = isActive ? ' research-row--active' : isMaxed ? ' research-row--maxed' : '';
      const reasonHtml = (!canResearch && !isMaxed) ? `<span class="research-reason">${escapeHtml(reason!)}</span>` : '';

      return `
        <div class="research-row${rowClass}" data-track="${track}">
          <div class="research-row-main">
            <span class="research-icon">${meta.icon}</span>
            <div class="research-info">
              <div class="research-name">${meta.label} <span class="research-level">Lv ${level}/5</span></div>
              <div class="research-effect">${meta.effect}</div>
              <div class="research-cost">${costStr}${reasonHtml}</div>
            </div>
            <button class="research-btn" data-action="research-${track}" ${disabledAttr}>${btnLabel}</button>
          </div>
        </div>`;
    }).join('');

    this.root.innerHTML = `
      <div class="research-panel-inner">
        <div class="research-panel-header">
          <span>📖 Research</span>
          <button class="research-close" data-action="close" aria-label="Close">✕</button>
        </div>
        <div class="research-tracks">${rows}</div>
        <div class="research-panel-footer">Tab · toggle panel · F1–F4 quick-research</div>
      </div>
    `;

    this.root.querySelectorAll('[data-action]').forEach((el) => {
      el.addEventListener('click', () => {
        const action = (el as HTMLElement).dataset.action!;
        if (action === 'close') {
          this.hide();
        } else if (action.startsWith('research-')) {
          const track = action.slice('research-'.length) as ResearchTrack;
          this.onResearch?.(track);
        }
      });
    });
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
