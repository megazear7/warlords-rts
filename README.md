# Warlords RTS

A modern 3D browser-based real-time strategy game inspired by *Rise of Nations*.

**Nations at launch:** Rome · Persia · Egypt · Gauls  
**Key innovation:** Nation-unique Epochs instead of shared Ages  
**Core systems retained:** Four research tracks (Science / Civic / Military / Commerce), capture-only cities, attrition + Supply Wagons

## Current Status

**Phase 0 complete → early Phase 1 underway**

Working right now:
- Vite + TypeScript + Three.js scaffold
- Pure simulation core (no rendering knowledge)
- Fixed-timestep game loop (20 Hz)
- Procedural terrain
- Placeholder City Center + citizens + scout
- **Unit selection** (left-click, Shift+click to add)
- **Move orders** (right-click ground)
- Selection rings on units
- Resource + selection HUD
- RTS camera (pan / orbit / zoom)

## Design Documentation

All research, design decisions, systems, and roadmaps live in the project Notion workspace:

→ [Warlords Notion Hub](https://app.notion.com/p/Warlords-3be290435c2f809e8fefee45284db1fa)

## Getting Started

```bash
git clone https://github.com/megazear7/warlords-rts.git
cd warlords-rts
npm install
npm run dev
```

Open the URL shown in the terminal (usually http://localhost:5173).

### Controls
| Input | Action |
|-------|--------|
| Left-click unit | Select |
| Shift + left-click | Add to selection |
| Left-click empty ground | Clear selection |
| Right-click ground | Move selected units |
| Left-drag | Pan camera |
| Right-drag | Orbit camera |
| Mouse wheel | Zoom |

## Project Structure

```
src/
  core/           # Pure simulation (deterministic, no Three.js)
  renderer/       # Three.js view + input + meshes
  ui/             # HUD and future UI
  data/           # Game data (units, techs, nations) – coming soon
  main.ts
  Game.ts
```

## Roadmap Summary

- **Phase 0** ✅ : Project setup + scene + camera + placeholders
- **Phase 1** (in progress): Selection, movement, basic economy, buildings, research
- **Phase 2**: Full research tracks, attrition/supply, borders, population
- **Phase 3**: All four nations + unique Epochs
- **Phase 4**: Content, polish, AI
- **Phase 5**: Multiplayer

See the Notion roadmap page for full details.

## License

Private / all rights reserved for now.
