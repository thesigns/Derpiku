# Derpiku

A derpy pocket pet that hears haiku from spirits orbiting the Earth. Pet it, take a walk, pet it again — and it tells you a haiku from the spirit floating above you.

Play: https://thesigns.github.io/Derpiku/

## How it works

- **Pet Derpiku.** Rub it with your finger: *“Walk 500 m away and pet me — I'll tell you a haiku!”* (250 m, 500 m or 1 km in a straight line — your choice). Every pet after that tells you how much is left. Once you are far enough, Derpiku tells you a haiku and the counter resets. Tap it and it just says *“Pet me!”*.
- **Spirits.** Twenty-six animal spirits, one for every letter A–Z, circle the Earth on fixed, deterministic orbits. Everyone sees the same spirits at the same time. The spirit closest above you floats over Derpiku — that's whose haiku you'll hear.
- **Haiku.** 416 of them, by spirit and season (hemisphere-aware). Haiku are never saved; copy one if you want to keep it.
- **Radar.** A minimal map without streets: where the walk started, the circle you need to reach, where you are and which way you're facing.
- **Orbits.** A globe with every orbit, the spirit above you right now, the next one, and when each spirit will be above you.
- **No pressure, no tracking.** Derpiku never gets sad or hungry. Your route is never saved, the walk's starting point is deleted after the haiku, and nothing leaves your device. There is no server.

## Project layout

The game is a dependency-free PWA (plain JavaScript, no build step, works offline) served straight from the repository root.

- `index.html`, `manifest.webmanifest`, `sw.js`, `icons/`
- `src/orbits.js` — orbit model, spirit selection and “above you” forecasts
- `src/spirits.js` — the 26-spirit constellation (single source of orbit parameters)
- `src/creature.js` — Derpiku itself (WebGL metaballs / SDF), `src/spirit-art.js` + `src/spirit-view.js` — the spirits, `src/radar.js` — the radar, `src/globe.js` — the orbit screen
- `src/walk.js` — walk rules, `src/texts.js` — haiku and joke selection
- `src/data/haiku.json`
- `tools/orbit-sim/` — orbit simulator used to tune the constellation (uses `src/orbits.js` and `src/spirits.js`)
- `tools/spirit-gallery.html` — all 26 spirits at a glance
- `docs/` — game design document (Polish)

## Running locally

```sh
python tools/serve.py
```

Open http://localhost:8765. The script serves the repository root with browser caching disabled (plain `python -m http.server` also works, but it can drop connections when many modules load at once and lets the browser cache stale files). Geolocation needs a secure context: `localhost` is fine, on a phone the game has to be served over HTTPS.

### Developer mode

On localhost only, *Settings* has a **Developer mode** section (loaded on demand from `src/dev.js`, never on the live site) for testing everything without leaving the house:

- simulated GPS with city presets (both hemispheres, tropics, the Arctic) and adjustable accuracy,
- a floating dev bar on the game screens: walk 100 m with the arrows, jump just past the target circle, auto-walk at 5 km/h ×1/×10/×60, +10 min, toggle a fuzzy GPS signal,
- clock skips up to +30 days (spirits move, seasons change, walks expire),
- reset the walk segment, preview any haiku, replay onboarding, reset everything,
- a live readout: position, walk distance and speed check, the spirit above you and how long it stays.

The service worker is disabled on localhost so you always get fresh files; add `?sw` to the URL to test offline mode.

The orbit simulator opens directly from disk: `tools/orbit-sim/index.html`.

## Deployment

GitHub Pages: **Settings → Pages → Source: Deploy from a branch**, branch `main`, folder `/ (root)`. Every push to `main` updates the site. `.nojekyll` makes Pages serve the files as they are.

The service worker serves files from its cache, so **bump `VERSION` in `sw.js` whenever game files change** — otherwise installed copies keep the old version. The new version usually shows up on the second launch. (`src/dev.js` is not precached on purpose — it only runs on localhost.)

## License

[MIT](LICENSE) © Jakub W. Adamczyk
