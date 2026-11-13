# Chase the Cat: tasks

Build order for version 1, each with its done-when check. All done November 13, 2026 unless marked.

| # | Task | Done when | Status |
| --- | --- | --- | --- |
| 1 | Write the design as data: dogs, Bad Owners, rules, 20 level recipes, Sven's script | The five files in `data/` load and every level builds | Done |
| 2 | Course builder (`js/track.js`) | The same level and seed always give the same course | Done |
| 3 | Race rules (`js/sim.js`): movement, water, walls, kids, Bad Owners, bosses, the cat, energy, scoring | Four computer dogs finish every level in `npm test` | Done |
| 4 | Rival dogs | No dog gets stuck on any level; they hug, eat and use Zoomies | Done |
| 5 | Drawing (`js/art.js`, `js/render.js`) | Dogs, cat, kids, Bad Owners and all four neighborhoods read clearly at 360 pixels wide | Done |
| 6 | Steering (`js/input.js`): tilt with a stay position, thumb, keys | Browser test passes the tilt, thumb and key checks | Done, tilt on simulated sensors only |
| 7 | Screens (`index.html`, `css/app.css`, `js/app.js`): title, dog pick, levels, briefing, race display, pause, results, settings | First-run flow works end to end with no sideways scroll | Done |
| 8 | Saving | Dog, stars, best scores, Love and settings survive a reload | Done |
| 9 | Sound (`js/audio.js`) | Effects and music play after the first tap and each has a switch | Done |
| 10 | Sven's intro (`js/intro.js`) | Twelve lines, each with its own animated scene; Skip and replay work | Done |
| 11 | Friend races (`js/net.js`) | Two browsers race, see the same world and get the same standings | Done on a local link |
| 12 | Offline start (`sw.js`) and home screen install (`manifest.webmanifest`) | After one online visit the game opens with no signal | Written, not yet checked on a phone |
| 13 | Par times | Set from the computer-dog runs and loosened for the first ten levels | Done |
| 14 | Docs | Requirements, design, tasks, how-to and admin notes are in `docs/` | Done |

## Next, in order

1. **Put it on a web address and play it on real phones.** Tilt needs https and a real sensor. Expect to tune the tilt feel, the dead zone and how hard the first levels are.
2. **Zazu's and Sven's real looks.** Change their `look` blocks to match photos.
3. **Sven's voice.** Record his twelve lines and play each with its scene. The captions stay.
4. **A real icon and logo** from the prompt in the admin notes.
5. **A relay server for friend races** if the free matchmaking service or phone networks get in the way.
6. **Name check.** Search the app stores and trademark records for Chase the Cat before it goes anywhere public beyond a test address.
7. **Android app** once the web version is accepted.

## Ideas parked for later

- Unlockable collars, bandanas and capes as dogs level up.
- Street crossings with pound vans to dodge.
- A daily level with a shared best time.
- More dogs. Each is one block of data.
- A two-player mode on one tablet, one thumb stick each.
- Rescued pups you can name and keep.
