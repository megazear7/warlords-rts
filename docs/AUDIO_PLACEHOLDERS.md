# Audio placeholders — replacement guide

All sounds currently use **Web Audio synthesized placeholders** so the game is fully playable without binary assets.

## How to replace a sound with a real file

1. Add an OGG (preferred) or MP3 under `public/audio/...` matching the path in `src/audio/SoundCatalog.ts`.
2. In `SoundCatalog.ts`, set that entry’s `mode` from `'placeholder'` to `'file'`.
3. Reload — `AudioManager.preloadFiles()` will decode it on startup.

No call-site changes are needed; keep the same `SoundId`.

## Catalog

| SoundId | Bus | Intended file | Status |
|---------|-----|---------------|--------|
| ui_click | sfx | audio/sfx/ui_click.ogg | placeholder |
| ui_confirm | sfx | audio/sfx/ui_confirm.ogg | placeholder |
| ui_error | sfx | audio/sfx/ui_error.ogg | placeholder |
| ui_toast | sfx | audio/sfx/ui_toast.ogg | placeholder |
| order_move | sfx | audio/sfx/order_move.ogg | placeholder |
| order_attack | sfx | audio/sfx/order_attack.ogg | placeholder |
| order_gather | sfx | audio/sfx/order_gather.ogg | placeholder |
| combat_hit | sfx | audio/sfx/combat_hit.ogg | placeholder |
| combat_death | sfx | audio/sfx/combat_death.ogg | placeholder |
| siege_hit | sfx | audio/sfx/siege_hit.ogg | placeholder |
| build_place | sfx | audio/sfx/build_place.ogg | placeholder |
| train_complete | sfx | audio/sfx/train_complete.ogg | placeholder |
| research_complete | sfx | audio/sfx/research_complete.ogg | placeholder |
| epoch_advance | sfx | audio/sfx/epoch_advance.ogg | placeholder |
| city_capture | sfx | audio/sfx/city_capture.ogg | placeholder |
| alert_attrition | sfx | audio/sfx/alert_attrition.ogg | placeholder |
| victory | sfx | audio/sfx/victory.ogg | placeholder |
| defeat | sfx | audio/sfx/defeat.ogg | placeholder |
| music_menu | music | audio/music/dawn-of-warlords.mp3 | file |
| music_gameplay | music | audio/music/dawn-of-warlords.mp3 | file |
| music_victory | music | audio/music/victory.ogg | placeholder |
| music_defeat | music | audio/music/defeat.ogg | placeholder |

## Runtime check

In the browser console:

```js
warlords.audio.placeholderStatus()
```

## Suggested free sources

- Kenney UI / interface packs (CC0)
- OpenGameArt combat / RTS packs (check license)
- Freesound.org (filter CC0)

## Folder layout when adding assets

```
public/
  audio/
    sfx/
      ui_click.ogg
      ...
    music/
      menu.ogg
      gameplay.ogg
      ...
```
