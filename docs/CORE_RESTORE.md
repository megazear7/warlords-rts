# Core file restore note

The authoritative full implementations of:

- `src/core/Simulation.ts` (~40 KB — attack-move, towers, market, AI, attrition, siege, epochs, vision, generals/auras, explored fog)
- `src/renderer/InputManager.ts` (~15 KB — all hotkeys including G for General, A for attack-move, etc.)

are maintained in the Grok project artifacts and the local working tree used during iterative development.

GitHub main currently has:
- Full `src/data/units.ts` (including General)
- Full `src/renderer/UnitMeshes.ts` (General mesh + aura tint)
- Full `src/ui/Hud.ts` (market panel + G help + aura status)
- Full `src/ui/Minimap.ts` (explored + vision filters)
- Full `src/renderer/Renderer.ts` (vision filter for enemy units)

If Simulation/InputManager appear as short stubs on main, replace them from the project artifacts copies or re-run the restore step from the development session.
