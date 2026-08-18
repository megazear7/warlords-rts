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
- `roman-heads-up-display.png` → `public/ui/roman-heads-up-display.png` — Rome HUD frame (2172×724, 3:1)
- `persian-heads-up-display.png` → `public/ui/persian-heads-up-display.png` — Persia HUD frame (2172×724, 3:1)
- `generic-heads-up-display.png` → `public/ui/generic-heads-up-display.png` — default HUD frame (2172×724, 3:1)
- `home-screen-background.mp4` / `background.mp4` → `public/video/home-screen-background.mp4` — menu fullscreen background + audio (1280×720)
- `warlords-title.png` → `public/ui/warlords-title.png` — home-screen title (2172×724)
- `The Dawn of Warlords.mp3` → `public/audio/music/dawn-of-warlords.mp3` — menu and in-game music
