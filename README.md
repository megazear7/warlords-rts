# Warlords RTS

A modern 3D browser-based real-time strategy game inspired by *Rise of Nations*.

**Nations at launch:** Rome · Persia · Egypt · Gauls  
**Key innovation:** Nation-unique Epochs instead of shared Ages  
**Core systems retained:** Four research tracks (Science / Civic / Military / Commerce), capture-only cities, attrition + Supply Wagons

## Current Status (Phase 0)

- Vite + TypeScript + Three.js scaffold
- Pure simulation core (no rendering knowledge)
- Fixed-timestep game loop
- Procedural terrain
- Placeholder City Center + units
- RTS-style camera (left-drag pan, right-drag orbit, wheel zoom)

## Design Documentation

All research, design decisions, systems, and roadmaps live in the project Notion workspace:

→ [Warlords Notion Hub](https://app.notion.com/p/Warlords-3be290435c2f809e8fefee45284db1fa)

## Getting Started

```bash
npm install
npm run dev
```

Then open the URL shown in the terminal (usually http://localhost:5173).

## Project Structure

```
src/
  core/           # Pure simulation (deterministic, no Three.js)
  renderer/       # Three.js view + input
  data/           # Game data (units, techs, nations) – coming soon
  main.ts         # Entry point
  Game.ts         # Orchestrator
```

## Roadmap Summary

- **Phase 0** (current): Project setup + empty scene + camera + placeholders
- **Phase 1**: Vertical slice – movement, basic economy, one research track, city founding/capture
- **Phase 2**: Full research tracks, attrition/supply, borders, population
- **Phase 3**: All four nations + unique Epochs
- **Phase 4**: Content, polish, AI improvements
- **Phase 5**: Multiplayer

See the Notion roadmap page for full details.

## License

Private / all rights reserved for now.
