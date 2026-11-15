# Demo video (30 seconds): exact URLs and what to click

Measured on 2026-11-15 in headless Edge with software rendering (SwiftShader), cache disabled, application served from a sub-folder (as GitHub Pages will serve it). On a real GPU the 3D scenes will be at least as fast. **No console error on any of these four URLs.** Open each URL in the browser where the 3D works; reload with Ctrl+Shift+R if you changed anything.

Base address while testing locally: `http://localhost:8000/` (start it with `py -m pipeline.tools.serve`, which sends no-cache headers). Public address once GitHub Pages is on: `https://victoirendala.github.io/Lunar_Holocron/`.

| # | Seconds | Address to paste after the base address | What it shows | Time until ready |
|---|---|---|---|---|
| 1 | 0-8 | `#view=atlas&a=site01-connecting-ridge&t=2027-03-14T06:00Z&thr=strict` | The 3D globe with the 55 sites near the South Pole, the day/night limit, the Sun and Earth sub-points. Slowly drag the globe once. | 2.3 s |
| 2 | 8-18 | `#view=south&a=site01-connecting-ridge&t=2027-03-14T06:00Z&thr=strict` | The South Pole map (real LOLA relief), site footprints as real 16 km squares, sharp relief when zooming with the mouse wheel. | 0.9 s |
| 3 | 18-30 | `#view=site&a=site01-connecting-ridge&t=2027-03-14T06:00Z&thr=strict` | Site01 "Connecting ridge": 3D terrain with its context ring, the 360° panorama with the real horizon and the Sun and Earth discs, the timeline, the verdict (46.5 % Sun, 44.0 % Earth). Then press **Play** (x3600) once and let the time bar move; hover the panorama to read azimuth and horizon. | 0.5 s |
| (optional) | | `#view=link&a=site01-connecting-ridge&t=2027-03-14T06:00Z&thr=strict` | Direct-to-Earth link view: countdown to the next loss, light-time delay, outages, landing-window planner. | 0.7 s |

Notes for the recording
- Every address above sets the view, the site, the instant (2027-03-14 06:00 UTC) and the strict threshold: pasting it is enough, no click is needed to reach the screen.
- The "Real data · 5 m terrain" chip at the top is always visible: it is the honesty chip, leave it in the frame.
- To see the 3D scene alone, press **Scene only** (top right); press **Show panels** to come back.
- If a machine has no WebGL, the application says so with a banner and shows 2D maps instead (this was tested, but it is not what you want to record).
- Gestures that are heavier than the rest on software rendering: dragging the 3D terrain with the exaggeration slider at maximum, and Play at x86,400. Avoid them if the recording stutters.
- Do not claim the illumination percentages are validated: they are geometry-only indicators (see "Sources and method" in the application).

Team: Victoire Ndala Mwenze (team lead) and Lionel Kisimba Kipoka, NASA Space Apps Challenge Lubumbashi 2026, challenge "Lunar Landing Site Navigator". Independent project, not endorsed by NASA.
