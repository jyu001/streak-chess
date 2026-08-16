# Streak Chess

A standalone, local-first puzzle-streak page inspired by Lichess, with configurable starting difficulty.

## Play

Double-click `index.html` and it will open directly in your browser. No local server, installation, build step, or internet connection is required. It opens immediately on a random, locally unsolved 1500–1599 Mate puzzle. Expand **Filters** to search any 100-point rating band through 3000+. All 269,584 extracted Mate puzzles rated 1500 or higher are available to the published app, and only the selected band is loaded into memory.

Every completed puzzle is recorded immediately in persistent browser storage as Passed or Failed. History retains the puzzle ID, rating, category, rating band, duration, full FEN and move sequence, and attempted/expected move on a failure for later educational review. History links restart the saved puzzle in playing mode inside this app, even after the page has been closed. A failed replay keeps the solution hidden and offers Replay Puzzle; solving it unlocks move navigation.

The left/right move-review buttons remain visible but disabled for unsolved and failed puzzles. Passing reveals the correct line and unlocks move navigation. **Next Puzzle** remains disabled until a successful solution and is the only action that advances to another random puzzle. A passed History entry is already considered solved, so its navigation and Next Puzzle controls are immediately available; a failed History entry keeps both locked.

History can be opened during an active winning streak without resetting it. The app pauses the live puzzle and exact move position, runs the History replay as a sandbox, and provides **Back to Streak**. Results from that sandbox are recorded in History but do not increase or end the active streak.

The turn indicator, solution move arrows, move chips, and puzzle action buttons
sit directly below the board so they remain reachable without scrolling on a
phone.

Alternatively, drag `index.html` onto a browser window or bookmark the opened `file:///.../index.html` page.

## Refresh the puzzle library

The checked-out project already contains the downloaded source database, filtered CSV, and generated browser buckets locally under `data/`. To refresh from a newer Lichess database, install the Python `zstandard` package and run:

```bash
python3 scripts/extract_mate_puzzles.py \
  data/source/lichess_db_puzzle.csv.zst \
  data/filtered/lichess_mate_1400_plus.csv

python3 scripts/build_browser_puzzle_buckets.py \
  data/filtered/lichess_mate_1400_plus.csv \
  data/browser
```

The application reads `data/browser/manifest.js` and dynamically loads the selected rating bucket. Large generated datasets are excluded by `data/.gitignore` but remain available locally.

Puzzle history and settings are stored in browser localStorage. They remain private to the current browser and do not synchronize between devices. See `FUTURE_NOTES.md` for the storage schema, architecture, limitations, and suggested next work.

## GitHub Pages

The repository is a static GitHub Pages site. Publish from the root of the
default branch. `.nojekyll` prevents Jekyll processing, while `.gitignore`
keeps the source database, intermediate CSV, 1400 bucket, development scripts,
and internal notes out of the public repository.

The Staunty artwork is licensed for noncommercial use. See
`THIRD_PARTY_LICENSES.md` for data and artwork attribution.

Puzzle data is provided by the Lichess Open Puzzle Database under CC0. The bundled Staunty SVG pieces are by sadsnake1 and licensed under CC BY-NC-SA 4.0.
