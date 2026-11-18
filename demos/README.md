# Demo recordings

The GIFs in `assets/demos/` are recorded by the scripts here. None of this is deployed (see `.vercelignore`).

- **Fred** is native-only (an on-device LLM), so `fred/fred.html` rebuilds its screens in HTML from the app's source: sizes, colours and strings come from `fred/apps/mobile`, and replies are laid out by the app's own `reply-format.ts` (types stripped into `reply-format.js`). The answers are Fred's logged output. The screen is an iPhone 18 Pro (402 × 874 pt), checked against simulator screenshots.
- **Side Quests** is recorded from the real web app: a local server (`npm run server` in the side-quests repo, which has dev tools on) with four headless browsers as players.
- **4eyez** has no UI, so it gets one diagram (`tools/diagram.py`), drawn from the repo's schema and routes and inlined in `index.html`.

## Re-record

```sh
cd demos/tools && npm install
# Fred
python3 -m http.server 8799 --bind 127.0.0.1 --directory ../fred &
mkdir -p out ex
node fredrec.mjs starter model night        # → out/fred-*.gif
# Side Quests (with its server running on :8787)
node sqrec.mjs                               # → out/sq-*.gif
```

Then copy `out/*.gif` to `assets/demos/` and make the reduced-motion posters (the last frame of each):

```sh
FF=$(node -e "process.stdout.write(require('ffmpeg-static'))")
for g in out/*.gif; do n=$(basename $g .gif); $FF -sseof -0.3 -i $g -frames:v 1 -q:v 4 ../../assets/demos/$n.jpg; done
```

Recording uses headless Chrome's screencast (`rig.mjs`) and encodes with ffmpeg at 15 fps, 360 px wide.
