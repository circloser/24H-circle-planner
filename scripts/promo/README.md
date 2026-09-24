# scripts/promo — marketing asset generator

Play Store screenshots, feature graphic, tablet shots, Instagram feed/story images and short
screen recordings for every tab (timetable, calendar, life, relation, place), in Korean and
English, captured from the real built app filled with fictional sample data.

```
npm run build                      # or point PROMO_DIST at any built dist/
node scripts/promo/build.mjs       # everything → ~/Desktop/24houring_playstore/promo-2026-09
node scripts/promo/build.mjs --phase=shots,compose --lang=en --only=life
```

| File | Role |
|---|---|
| `build.mjs` | Entry point; phases `shots` · `tablet` · `compose` · `video`, then writes the output README |
| `data.mjs` | Sample person (localStorage seeds per language) + the quiet-first-run keys |
| `copy.mjs` | Headline / subhead per capture and language |
| `lib.mjs` | Static server over dist, offline browser context (all `/api` mocked, outside requests refused, OSM tiles replaced by a locally drawn stand-in), pinned clock, touch cursor |
| `compose.mjs` | HTML templates → composites (phone frame, feed, story, overview, feature graphic, tablet) |
| `video.mjs` | DevTools-screencast recordings → webm + framed H.264 mp4 + ~30 s reel |
| `readme.mjs` | Lists every output file with size/spec/use |
| `promo.mjs` | Older one-off: circle schedules via `/s` + GIF |

Env: `PROMO_DIST`, `PROMO_OUT`, `FFMPEG` (needs libx264 for mp4; the Playwright copy is VP8-only,
the imageio-ffmpeg binary is auto-detected), `PROMO_REAL_TILES=1` (use real OpenStreetMap tiles
for the pin map — the only request that would leave the machine), `PROMO_KEEP_FRAMES=1`.
