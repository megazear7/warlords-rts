# Warlords RTS

Modern browser-based 3D RTS inspired by Rise of Nations.  
**Nations:** Rome · Persia · Egypt · Gauls  
**Key design:** Nation-unique epochs (no shared Ages) · four research tracks · capture-only cities · attrition + supply · fog of war

## Quick start

```bash
git clone https://github.com/megazear7/warlords-rts
cd warlords-rts
npm install
npm run dev
```

> **Note (2026-08-16):** Full `Simulation.ts` (~42 KB, includes formation offsets) is maintained in the project artifacts.  
> If restore reports an incomplete payload, copy the authoritative file into `src/core/Simulation.ts`.  
> **InputManager**, Renderer, Hud, BuildingMeshes, FogMeshes are fully on main.

## Controls (highlights)

| Key | Action |
|-----|--------|
| **A** | Attack-move (then right-click) |
| **H** | Wall (requires Military 2) |
| **Y** | Watchtower (Military 1) |
| **M** | Market (Commerce 1) |
| **G** | Train General |
| **V** | Train citizen |
| **U** / **I** | Market sell food / buy metal |
| **F1–F4** | Research tracks |
| **E** | Advance epoch |
| **Ctrl+0-9** | Control groups |
| Box select · edge-scroll · rally points | |

## Architecture

- Fixed-timestep Simulation (20 Hz) separated from Three.js Renderer
- Science / Civic / Military / Commerce research
- Attrition outside territory unless supply wagons connect to a city
- Generals with auras · fog of war (explored + current vision)

## Design docs

→ [Warlords Notion Hub](https://app.notion.com/p/Warlords-3be290435c2f809e8fefee45284db1fa)

Repo: https://github.com/megazear7/warlords-rts
