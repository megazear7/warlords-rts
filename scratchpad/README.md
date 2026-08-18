# Scratchpad

Drop zone for incoming art and reference files. This folder is **not** the game asset pipeline.

## How to use it

1. Put new images, audio, or other source files here.
2. Leave this `README.md` in place.
3. Everything else in this directory is gitignored and will not be committed.

## Agent instructions

When files appear here, **move them into the real project locations as needed** — do not leave working copies in `scratchpad/` once they have a home.

Typical destinations:

| Kind | Destination |
|------|-------------|
| Unit / building / faction portraits | `public/portraits/` |
| Other UI images | `public/ui/` |
| World or 3D textures | `public/textures/` |
| Sound effects / music | `public/audio/` |

Name files clearly when you move them (`rome-legionary.png`, not `img2.png`). Update the code that references them in the same change.

## Current placeholders

These were dropped here and moved into the game:

- `roman-placeholder.png` → `public/portraits/roman-placeholder.png` — Rome units and buildings
- `general-placeholder.png` → `public/portraits/general-placeholder.png` — non-Roman factions
- `building-button-placeholder.png` → `public/ui/building-button-placeholder.png` — HUD command buttons
