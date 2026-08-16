# Warlords RTS

Modern browser-based 3D RTS inspired by Rise of Nations.

**Nations:** Rome · Persia · Egypt · Gauls  
**Design pillars:** Nation-unique epochs (no shared Ages) · four permanent research tracks (Science / Civic / Military / Commerce) · capture-only cities · attrition + supply wagons · fog of war · generals with auras

## Quick start

```bash
git clone https://github.com/megazear7/warlords-rts
cd warlords-rts
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173). The `predev` hook restores `Simulation.ts` automatically if needed.

## Controls (highlights)

| Key | Action |
|-----|--------|
| **A** | Attack-move (then right-click destination) |
| **H** | Build wall (requires Military 2) |
| **Y** | Build watchtower (Military 1) |
| **M** | Build market (Commerce 1) |
| **C** | Found city mode (requires Civic + selected citizen, then right-click ground) |
| **G** | Train General |
| **V** | Train citizen |
| **U** / **I** | Market: sell food / buy metal |
| **F1–F4** | Research Science / Civic / Military / Commerce |
| **E** | Advance nation epoch |
| **Ctrl+0-9** | Control groups |
| Box select · edge-scroll · rally points · minimap click | |

## Current feature set (clean main)

- Fixed-timestep Simulation (20 Hz) + Three.js Renderer
- Procedural terrain, placeholder unit/building meshes, fog-of-war plane
- Cities (capture only), farms, towers, markets, walls
- Four research tracks with gates (tower / market / wall)
- Nation epochs + bonuses
- Attrition outside friendly territory unless supply linked
- Generals + aura radius
- AI opponent (economy → train → wave attacks)
- Attack-move, unit separation, control groups
- Save / load / main menu / settings / profile
- Placeholder Web Audio (synth + SoundCatalog ready for OGG)

## City founding rules

- You start with 1 city and cities are always **captured, never destroyed**.
- To found a city, select at least one citizen, press **C**, then right-click valid open ground.
- Founding cost: **120 timber + 50 wealth**.
- Civic gate formula: city `N` requires Civic `N-1` (2nd city needs Civic 1, 3rd needs Civic 2, etc.), with a hard cap of 5 owned cities.
- Minimum distance between any two city centers: **25** world units.

## Architecture notes

- `src/core/Simulation.ts` – authoritative game state & logic (~42 KB)
- Restore fallback: `scripts/restore-simulation.cjs` + `.gz.b64.part*` files
- Design & research live in Notion: [Warlords Hub](https://app.notion.com/p/Warlords-3be290435c2f809e8fefee45284db1fa)

Repo: https://github.com/megazear7/warlords-rts
