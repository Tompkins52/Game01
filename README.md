# Chase the Cat

A tilt-to-run racing game for phones. Pick your dog, chase the cat, hug the kids, and chomp the Bad Owners. Up to four players can race together, each on their own phone.

It is a plain web app: HTML, CSS and JavaScript with no build step and no accounts. Everything on screen is drawn in code and every sound is made in code, so there are no image or audio files to manage.

## How to play

- **Run:** tip your phone forward. **Steer:** lean left or right. **Stay:** hold the phone in your normal spot. **Back up:** tip it back.
- No tilt? Drag your thumb anywhere on the screen. On a computer, use the arrow keys and the space bar.
- **Water** slows you down.
- **Kids** give hugs. Get close and your dog trots over by himself. Hugs give Love, which levels your dog up, and a short speed boost after.
- **Bad Owners** guard the obstacles. Run into one to eat him: big points, energy, and a rescued puppy that follows you to the finish.
- **Energy** powers **Zoomies**: faster, splash proof, and immune to everything a Bad Owner can throw at you.
- **Tag the cat** when she stops to taunt you for a bonus.
- First dog to the finish line trees the cat and wins.

A one-page guide is in [docs/how-to-play.md](docs/how-to-play.md).

## Run it on your computer

Any static web server works. From this folder:

```
python3 -m http.server 8123
```

Then open `http://localhost:8123/`. Tilt steering needs a real phone and a secure (https) address, so test tilt on the hosted copy. Thumb and keyboard steering work everywhere.

## What is where

| Path | What it holds |
| --- | --- |
| `index.html`, `css/app.css` | Every screen and its styling |
| `js/app.js` | Screens, saving, and the loop that runs a race |
| `js/sim.js` | The race rules: dogs, water, kids, Bad Owners, the cat, rival dogs, scoring |
| `js/track.js` | Builds each course from its level recipe |
| `js/render.js`, `js/art.js` | Drawing |
| `js/input.js` | Tilt, thumb and keyboard steering |
| `js/audio.js` | Sound effects and music |
| `js/intro.js` | Sven's animated how-to-play |
| `js/net.js` | Friend races |
| `data/*.json` | All game content: dogs, Bad Owners, the 20 levels, scoring rules, Sven's script |
| `docs/` | Requirements, design, task list, how-to and admin notes |
| `tests/` | Automated checks |

To change a dog's stats, a level's layout, a point value or a line of Sven's script, edit the matching file in `data/`. No code changes needed. See [docs/admin-notes.md](docs/admin-notes.md).

## Tests

```
npm install
npm test                 # plays all 20 levels with computer dogs
npm run test:browser     # drives the real game in a phone-sized browser
npm run test:friends     # two browsers race each other (needs a local PeerJS server)
```

The browser tests expect the game served at `http://127.0.0.1:8123/`. Details are in the admin notes.

## Privacy

No accounts, no ads, no trackers. Progress is saved only on the player's own device. In a friend race the phones connect straight to each other and share nothing but dog positions and what got eaten.

## Credits

Friend races use [PeerJS](https://peerjs.com/) (MIT license, copy in `js/vendor/`).

Copyright 2026 Tompkins Software Systems LLC. All rights reserved.
