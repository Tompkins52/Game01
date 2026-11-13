# Chase the Cat: admin notes

For whoever maintains the game. Written November 13, 2026.

## Changing the game without touching code

Everything players see as content is in `data/`. After a change, run `npm test` to make sure every level can still be finished.

| To change | Edit |
| --- | --- |
| A dog's speed, perk numbers, name, tagline or looks | `data/dogs.json` |
| Add a dog | Copy a dog block in `data/dogs.json`, give it a new `id`. Set `"npc": false` to keep computer racers from using it |
| How a Bad Owner or boss behaves | `data/villains.json`. A pair like `[2.9, 1.9]` means level 1 value, level 20 value |
| A level's layout | The `tokens` string for that level in `data/levels.json`. The legend at the top of the file says what each letter is. `X` (boss arena) must be last and needs a `boss` name |
| A level's exact positions | Change its `seed` |
| Par time for three stars | `par` on the level |
| Points, Love, energy, Zoomies, hug reach, the cat | `data/rules.json` |
| Sven's lines | `data/story.json`. Each line names the scene it plays; the scenes are drawn in `js/intro.js` |
| Colors and scenery of a neighborhood | The `theme` block in `data/levels.json` |

To re-set par times after tuning, run `node tests/sim.test.mjs --par`. It prints a suggested par for each level: the fastest finish by a strong pack of computer dogs (no Zazu) plus 6 percent. The first ten levels were then loosened by 10 and 5 percent.

## Handy addresses for testing

Add these to the game's address:

| Add | What it does |
| --- | --- |
| `?level=7` | Starts level 7 right away |
| `?level=7&bot` | Same, with the computer running your dog |
| `&dog=corgi` | Uses that dog |
| `&control=pad` or `&control=tilt` | Picks the steering |
| `?all` | Opens every level |
| `?pack=ABCD` | Opens Race Friends with that code filled in (this is what Share invite sends) |
| `?peer=host:port` | Uses your own matchmaking server for friend races |

## Tests

```
npm install
npm test
python3 -m http.server 8123 &
npm run test:browser
```

For the friend race test, also run a local PeerJS server:

```
npx peerjs --port 9000 --path /
npm run test:friends
```

If Chrome is not found, set `CHROME_PATH` to its location. The browser test takes a screenshot of each main screen when given a folder: `node tests/browser.test.mjs http://127.0.0.1:8123/ shots`.

## Hosting

The game is static files. It needs an https address for tilt steering, friend races and offline start.

- **For testing and free play:** GitHub Pages from this repo (Settings, Pages, deploy from the `main` branch, root folder). The address is then `https://tompkins52.github.io/game01/`.
- **If it ever charges money or is licensed:** move it to Cloudflare Pages first. GitHub's terms do not allow GitHub Pages for commercial sites.

For the best feel on a phone, open the address and choose Add to Home Screen. That hides the browser bars and, on Android, keeps the screen from rotating when you lean hard.

## Friend races and the matchmaking service

Friend races use the free public PeerJS service to introduce phones to each other. It costs nothing and holds no game data, but it has no uptime promise, and some mobile networks will not allow direct phone-to-phone links.

If either becomes a problem, run our own:

1. A PeerJS server (the `peer` package) on any small host, behind https. Point the game at it by setting the server in `js/net.js` (`peerOptions`) or with `?peer=`.
2. A TURN relay for phones that cannot link directly. This is the part that costs money, roughly a few dollars a month at hobby scale. Quote it before turning it on.

Pack ids on the public service start with `chase-the-cat-v1-`. If the message format in `js/net.js` ever changes in a way old copies cannot read, bump that prefix so old and new copies cannot land in the same pack.

## The icon

The icon in `icons/` is a plain paw print placeholder. For the real one, a prompt in the house style:

> Design an app icon for "Chase the Cat," a cartoon racing game where dogs chase a cat through a neighborhood. Symbol: a happy cartoon dog's head seen from the front, tongue out, mid-run, with a small orange and white cat's tail flicking out of frame at the top corner. Flat vector style with thick dark outlines, like a sticker. Colors: sunny yellow (#FFD23F), deep purple (#1B1433), warm red (#E5383B), cream (#FFF8E7). No gradients, no text, no shadows. Make it a full square with no rounded corners, since the phone rounds them, and keep the symbol inside the center two thirds. It must read clearly at 48 pixels. Give me 4 different concepts at 1024 by 1024.

Save the chosen art as `icons/icon.svg` and 180, 192 and 512 pixel PNGs with the same names as now.

## Sound

Every effect and the music loop are built from tones and noise in `js/audio.js`. There are no audio files. On an iPhone, sound follows the ring switch: if the phone is on silent the game is silent.

## What this build cost

| Item | Used | Cost |
| --- | --- | --- |
| ElevenLabs | Not used | $0 |
| Canva, Framer, Zapier, Suno, Metricool | Not used | $0 |
| Art and sound | Drawn and synthesized in code | $0 |
| PeerJS library | Open source, MIT | $0 |
| PeerJS public matchmaking | Free service | $0 |
| Hosting | GitHub Pages, free | $0 |
| **Total** | | **$0** |

Quoted but not bought: Sven's voice. His twelve lines are 882 characters, about 880 ElevenLabs credits for one take, which is about 16 cents on the Creator plan. The free alternative is the phone's built-in reading voice, which sounds robotic and differs on every phone. Picking or designing a voice is free until it speaks.

## Assumptions made in this build

- The message that described the game was treated as the brief. No intake form was filled in. Nothing in the game has any link to anyone's employer.
- The game belongs to TSS and carries a TSS copyright line.
- Zazu is drawn as a blue-gray bully-type dog with a white blaze and a red cape. Sven is drawn as a big black, white and tan dog with a red scarf. Both are guesses.
- The cat is named Pickles and is orange and white.
- "Eat" is shown as a cartoon gulp and a puff of stars.
- The dog-fighting villain in the brief became a made-up final boss, the Ringleader. No real person is in the game.
- Zazu is playable from the start. Computer racers cannot pick him.
- Every dog levels up separately.
- Finishing in the top three opens the next level.
- Friend races use the host's open levels and have no names or chat.
