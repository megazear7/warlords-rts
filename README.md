# Warlords RTS

A modern 3D browser-based real-time strategy game inspired by *Rise of Nations*.

**Nations at launch:** Rome · Persia · Egypt · Gauls  
**Key innovation:** Nation-unique Epochs instead of shared Ages

## Current Status — Early Phase 1

Playable right now:

- Procedural terrain + placeholder City Center
- Citizens + Scout
- **Unit selection** (click + box select)
- **Move orders**
- **Resource nodes** (food bushes, trees, metal rocks)
- **Gathering** (right-click a resource with citizens selected)
- **Build Farm** (press **F** with citizens selected, costs 60 timber)
- Resource + selection HUD
- RTS camera

## Design Documentation

→ [Warlords Notion Hub](https://app.notion.com/p/Warlords-3be290435c2f809e8fefee45284db1fa)

## Getting Started

```bash
git clone https://github.com/megazear7/warlords-rts.git
cd warlords-rts
npm install
npm run dev
```

### Controls

| Input | Action |
|-------|--------|
| Left-click unit | Select |
| Left-drag | Box select |
| Shift + left-drag | Pan camera |
| Right-click ground | Move selected units |
| Right-click resource | Order citizens to gather |
| Right-drag | Orbit camera |
| Mouse wheel | Zoom |
| **F** | Build Farm (citizens selected + 60 timber) |

## Project Structure

```
src/
  core/           # Pure simulation
  renderer/       # Three.js view + input + meshes
  ui/             # HUD
  main.ts
  Game.ts
```

## Roadmap

- **Phase 0** ✅ Setup + scene + camera
- **Phase 1** (in progress) Selection, movement, gathering, buildings
- **Phase 2** Research tracks, attrition/supply, borders
- **Phase 3** Four nations + Epochs
- **Phase 4** Polish + AI
- **Phase 5** Multiplayer
