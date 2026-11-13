# Chase the Cat: design

Written November 13, 2026. This is how the game works and why. The numbers live in `data/` and can be changed there; this page explains them.

## The idea, cleaned up

The brief was a list of things the game must have: pick a dog like a board game token (with a Pit Bull, and Zazu as the strongest), a race to a finish line, water that slows you, steering by tilting the phone with a thumb option, dogs that eat bad dog owners for energy and massive points, Sven narrating an animated intro, kids the dogs wander over to for hugs that level them up, four racers with friends or computer dogs, 20 levels, and the name Chase the Cat.

One story ties it together:

> Pickles the cat swipes the Golden Squeaky and bolts. Four dogs chase her across town. The road is full of Bad Owners, people who are mean to dogs. Dogs eat them, which frees the pups they were keeping. Kids along the way just want to hug a dog. The first dog to the finish trees the cat. And at the very end it turns out Pickles was leading the dogs to the Ringleader's hideout all along, so every caged pup goes free.

That gives each piece a job:

| Piece | What it does in play |
| --- | --- |
| The cat | The reason to race, a moving target ahead of the leader, and a bonus when she taunts |
| Water, hedges, clutter | Slow you or block you. Read the road and steer |
| Kids | A choice: a hug costs a second and pays Love, points and a speed boost |
| Bad Owners | Danger and the biggest reward. Each has one trick and one answer |
| Energy and Zoomies | What eating Bad Owners buys: a burst that ignores everything |
| Love and dog levels | What hugs buy: a dog that slowly gets better the more you play him |

Things added that the brief did not ask for:

- Rescued pups. Every Bad Owner you eat frees a puppy that runs behind you in a line to the finish.
- Tag the cat. She stops to taunt; reach her before she bolts for a bonus. It usually takes Zoomies.
- Wiggle out of nets. Shake the phone or wiggle your thumb to break free sooner.
- Bait and bite. Tipping back to dodge a net and then going in is the reason backing up exists.
- Bark. Starting Zoomies barks, which stuns Bad Owners nearby.
- Bosses with locked gates every fifth level.
- The twist ending.

## Dogs

Eight dogs. Bars are out of 5. Speed is top speed in track units a second (the track is 480 units wide).

| Dog | Speed | Swim | Chomp | Heart | Top speed | Perk |
| --- | --- | --- | --- | --- | --- | --- |
| Zazu | 5 | 4 | 5 | 5 | 360 | Top Dog: starts every race with full Zoomies |
| Pit Bull | 4 | 3 | 5 | 5 | 342 | Big Chomp: bites from farther away, 1.5 times the energy from each Bad Owner |
| Greyhound | 5 | 2 | 2 | 3 | 380 | Rocket: fastest on dry ground |
| Labrador | 3 | 5 | 3 | 4 | 330 | Water Dog: keeps 86 percent of his speed in water |
| German Shepherd | 4 | 3 | 4 | 3 | 346 | On Duty: recovers from yelling and firecrackers twice as fast |
| Corgi | 2 | 2 | 3 | 5 | 315 | Low Rider: smaller target for nets and hoses, quickest hugs |
| Husky | 4 | 4 | 3 | 3 | 346 | Never Tired: Zoomies last 45 percent longer |
| Chihuahua | 3 | 1 | 2 | 4 | 328 | Tiny Terror: smallest target, turns fastest, bark stuns twice as long |

Zazu is the best all-round dog on purpose. The Greyhound is faster in a straight line but weaker everywhere else. Computer racers never pick Zazu, so he is always yours.

How the dogs look (coat, ears, tail, markings) is data too, in the `look` block of each dog. Zazu and Sven were drawn without a photo to go on. Send their real colors and ear shapes and they are a five-minute change.

## Steering

All three ways produce the same thing: a direction and a strength from 0 to 1.

- **Tilt.** The phone's position when the countdown hits 3 is the stay position. Tipping 22 degrees forward of that is full speed (30 on Gentle, 15 on Twitchy). There is a small dead zone so a steady hand means a still dog. Leaning works the same way side to side. Tipping back backs up at half speed. A small dot on the screen shows the tilt the game is reading.
- **Thumb.** Touch anywhere and drag. The stick appears under the thumb. A separate ZOOM button sits bottom right for the other thumb.
- **Keys.** Arrow keys or W A S D, space bar for Zoomies, Escape or P to pause.

In tilt mode a tap anywhere on the screen fires Zoomies, so the game can be played without looking for a button.

## Race rules

- Four dogs start side by side. The cat sits ahead, then runs on "CHASE!".
- A dog speeds up and turns at a rate set by its `accel`. Sideways speed is 90 percent of forward speed.
- Water multiplies speed by the dog's swim number (0.33 for the Chihuahua up to 0.86 for the Labrador). Bridges are dry.
- Hedges, walls, crates, chains and the boss gate are solid. Dogs slide along them. Cans, cones, balls and barrels get knocked over and cost a little speed.
- Dogs bump each other gently. No dog can block the road.
- When the first dog finishes, the rest have 20 seconds. After that they are placed by distance.

## Kids

A kid stands with arms out and a heart overhead. If a dog comes within 105 units and has not been hugged by that kid yet, the dog walks over by itself and is hugged for 1.15 seconds (shorter for dogs with a big Heart). Then:

- 300 points and 40 Love (times the dog's Heart multiplier, 1.0 to 1.6)
- a quarter pip of energy
- Happy Tail: 18 percent faster for 3.5 seconds

While hugging, a dog cannot be hurt. A dog with Zoomies runs straight past. Kids are never in danger from anything in the game.

## Bad Owners

Each one sits at an obstacle, has one attack that is always shown before it lands, and can be eaten by running into his body. Being hit breaks your combo and your clean run. After any hit a dog cannot be hit again for about a second.

| Bad Owner | First seen | Attack | Effect | Answer |
| --- | --- | --- | --- | --- |
| The Hoser | Level 1 | A water jet that sweeps back and forth from the edge of the road | Soaked: 45 percent slower for 0.9 seconds and pushed along the jet | Run up his edge of the road while the jet points away |
| The Snatcher | Level 4 | Walks side to side. Swings a net at any dog within 250 units in front of him, after a short wind-up with a red circle | Netted: held for 1.5 seconds, less if you wiggle | Stop or back up when the circle shows, then go in while he untangles. Or come from the side |
| The Chainer | Level 6 | A chain across half to two thirds of the road, with a pup chained at the far end | Solid barrier | Use the gap, or eat him and the chain drops for everyone |
| The Yeller | Level 8 | A ring of noise that spreads out every 2 to 3 seconds. His megaphone turns red first | Cower: 65 percent slower for 1.1 seconds | Go in right after a ring passes |
| The Boomer | Level 11 | Throws a firecracker where you are about to be. A red circle shows where | Knocked back and stunned for 0.6 seconds | Leave the circle. Then go get him |

Attacks get faster and reach farther as levels climb. Each number in `data/villains.json` that is written as a pair, like `[2.9, 1.9]`, is the value on level 1 and on level 20.

Every Bad Owner keeps a pup in a cage beside him. When he is eaten the cage opens and the pup joins the dog that ate him.

### Bosses

Levels 5, 10, 15 and 20 end in an arena with a locked gate in front of the finish line. The boss must be bitten three times (five for the last). After each bite he jumps to a new spot, flashes for 1.6 seconds while he cannot be bitten, and gets faster. Any dog can bite him; the gate opens for everyone. Computer dogs take turns going in so the player gets a fair share.

| Level | Boss | What he does |
| --- | --- | --- |
| 5 | Drench Dan | Two hose jets spin around him like a sprinkler. Slip between them |
| 10 | Captain Snatch | Chases dogs and swings a giant net in any direction |
| 15 | Boom-Boom Bruno | Firecrackers three at a time |
| 20 | The Ringleader | Yells, throws firecrackers and swings a net |

## The cat

Pickles keeps about 600 units ahead of the leading dog, weaving. Once or twice a level she stops and taunts. When a dog gets within 260 units she takes half a second to react, then bolts. A dog that touches her first gets 750 points, 20 Love and a full pip. At normal speed most dogs just miss; Zoomies or a Happy Tail gets there. On boss levels she waits on top of the gate. At the finish she is up the tree.

## Energy and Zoomies

Three pips. Most dogs start with one; Zazu starts with three.

| Gain | Pips |
| --- | --- |
| Eat a Bad Owner or bite a boss | 1 |
| Tag the cat | 1 |
| Hug | 1/4 |
| Bone | 1/8 |

One pip buys Zoomies for 2.2 seconds: 60 percent faster, not slowed by water, immune to every attack, and too fast to stop for hugs. The bark that starts it stuns Bad Owners within 280 units for 1.2 seconds.

## Scoring

See `data/rules.json`. The table is in `docs/how-to-play.md`. Two multipliers apply to everything: plus 5 percent per level number (level 20 pays 1.95 times) and plus 2 percent per dog level above 1.

Stars: one for a top three finish, two for a win, three for a win under par. Par for each level is set from the fastest computer-dog run (see admin notes) and is meant to need good Zoomies use.

## Love and dog levels

Love per race: hugs (40 each, times Heart), Bad Owners (10), boss bites (25), cat tags (20) and finishing place (60, 40, 25, 10).

To go from level n to n+1 takes 100 + 60 x (n - 1) Love, so level 2 needs 100, level 3 another 160, and level 20 needs 12,160 in all. That is roughly 50 races for one dog. Each level adds half a percent of top speed and 2 percent to scores. Ranks: Pup, Good Dog (3), Very Good Dog (5), Best Friend (8), Neighborhood Hero (11), Top Dog (14), Legend (17), Goodest Dog Ever (20).

Each dog keeps its own level, so playing a new dog starts a new friendship.

## Rival dogs

Computer dogs look a few dog-lengths ahead, score nine lanes across the road (water, walls, each Bad Owner's danger zone, bones, kids, other dogs) and steer for the best one. Their skill runs from 0.4 on level 1 to 0.95 on level 20. Low skill means slower reactions, more random lane choices and a lower top speed (86 percent at level 1, 97 percent at level 20). A light rubber band (plus 7, minus 5 percent) keeps the pack near the player. They hug kids, eat Bad Owners, use Zoomies and can get stuck in nets like anyone else. If one makes no progress for a second it backs up and tries another lane.

## The 20 levels

A level is a recipe: a string of letters in `data/levels.json`, each letter one stretch of road. The legend is at the top of that file. Positions inside a stretch come from the level's seed, so a level is the same every time and the same on every phone.

| # | Level | Where | Length | Par | Bad Owners | Kids | New |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | The Squeaky Heist | Maple Street | 7k | 21s | 1 Hoser | 3 | The Hoser |
| 2 | Sprinkler Season | Maple Street | 7.9k | 22s | 2 Hoser | 4 |  |
| 3 | Hedge Hoppers | Maple Street | 8.7k | 26s | 2 Hoser | 3 |  |
| 4 | Net Gains | Maple Street | 8.8k | 26s | 2 Snatcher, 1 Hoser | 4 | The Snatcher |
| 5 | Drench Dan's Driveway | Maple Street | 10.1k | 35s | 2 Hoser, 1 Snatcher, boss Drench Dan | 3 | Boss fight |
| 6 | Off the Chain | Barkside Park | 8.8k | 26s | 2 Chainer, 1 Snatcher | 4 | The Chainer |
| 7 | Duck Pond Dash | Barkside Park | 10k | 27s | 1 Hoser, 2 Chainer, 1 Snatcher | 2 |  |
| 8 | Inside Voices | Barkside Park | 9.9k | 28s | 2 Yeller, 1 Chainer, 1 Snatcher | 3 | The Yeller |
| 9 | A Bridge Too Fur | Barkside Park | 10.9k | 29s | 1 Chainer, 2 Yeller, 1 Snatcher, 1 Hoser | 4 |  |
| 10 | Captain Snatch | Barkside Park | 11.8k | 40s | 2 Snatcher, 2 Chainer, 1 Yeller, boss Captain Snatch | 3 | Boss fight |
| 11 | Bang Average | Downtown | 9.7k | 31s | 2 Boomer, 1 Snatcher, 1 Yeller | 2 | The Boomer |
| 12 | Alley Oops | Downtown | 10.4k | 29s | 1 Snatcher, 2 Boomer, 1 Chainer, 1 Yeller | 3 |  |
| 13 | Rush Hour | Downtown | 11.6k | 34s | 3 Boomer, 2 Snatcher, 1 Yeller, 1 Chainer | 2 |  |
| 14 | Midnight Zoomies | Downtown | 12.5k | 36s | 3 Boomer, 2 Yeller, 2 Snatcher, 1 Chainer | 3 |  |
| 15 | Boom-Boom Bruno | Downtown | 13.3k | 46s | 3 Boomer, 2 Snatcher, 1 Yeller, 1 Chainer, boss Boom-Boom Bruno | 2 | Boss fight |
| 16 | Salty Paws | The Docks | 11.8k | 31s | 1 Hoser, 1 Boomer, 1 Chainer, 1 Snatcher, 1 Yeller | 4 |  |
| 17 | Crate Escape | The Docks | 13.3k | 36s | 2 Boomer, 2 Snatcher, 1 Yeller, 1 Chainer, 1 Hoser | 3 |  |
| 18 | Low Tide, High Stakes | The Docks | 13.7k | 37s | 2 Snatcher, 2 Boomer, 2 Chainer, 1 Yeller, 1 Hoser | 2 |  |
| 19 | The Last Fence | The Docks | 15.1k | 40s | 3 Boomer, 2 Yeller, 2 Snatcher, 1 Chainer, 1 Hoser | 2 |  |
| 20 | The Ringleader | The Docks | 16.9k | 62s | 3 Boomer, 2 Snatcher, 2 Yeller, 2 Chainer, 1 Hoser, boss The Ringleader | 4 | Boss fight |

Difficulty climbs four ways at once: longer courses, more Bad Owners with faster attacks, narrower gaps and fewer bridges, and sharper rivals. Each neighborhood adds its own flavor: Maple Street has puddles and hedges, Barkside Park has ponds and streams, Downtown has clutter, walls and dusk, The Docks have wide channels, crates and night.

## Screens and their states

| Screen | What is on it | Empty, loading and error states |
| --- | --- | --- |
| Title | Animated chase, Play, Race Friends, How to Play, Settings | If the game files fail to load, the footer says so and asks for a reload |
| Sven's intro | Twelve lines, each with an animated scene, Skip and Next | Plays on first Play; replay from the title or Settings |
| Pick your dog | Eight dogs, stat bars, perk, level and Love bar | A new dog shows Level 1 Pup |
| Levels | Four neighborhoods, five levels each, stars, locks | Only level 1 open at first; the next open level is ringed |
| Briefing | Level name, story line, the new Bad Owner or boss with his tip, star goals, tilt or thumb | If tilt is refused or missing, a message says thumb steering is on |
| Race | The track, place, progress bar with all four dogs and the cat, score, time, energy, ZOOM, pause, tilt dot | "Hurry" countdown after the first finisher; "No tilt signal" if the sensor goes quiet; "Turn your phone upright" in landscape |
| Paused | Keep running, reset stay position, tilt or thumb, start over, quit | In a friend race this is only a menu; the race goes on |
| Results | Place, stars, score lines, total, time against par, Love bar, level-up note, pack standings in friend races, the ending after level 20 | "The cat got away!" when you did not finish |
| Race Friends | Start a pack or join by code; then the lobby with the code, four spots, level picker, Start | Clear messages for a wrong code, a full pack, a race in progress and a lost connection |
| Settings | Steering, tilt feel, sound, music, vibration, replay intro, erase progress (two taps) | |

## Data

Content files, all in `data/`:

- `dogs.json`: the eight dogs, their numbers and looks, and the four player colors.
- `villains.json`: the five Bad Owners and four bosses.
- `levels.json`: four neighborhoods (names, story lines, colors, scenery) and twenty level recipes with seeds and par times, plus the rival skill range.
- `rules.json`: every point value, the Love curve, energy, movement and cat numbers.
- `story.json`: Sven's look, his twelve lines with the scene each one plays, the ending and tips.

Saved on the device under the key `chase-the-cat.save.v1`:

```
{ dog, dogs: { <id>: { love } }, levels: { <n>: { stars, best } }, seenIntro, attempts,
  settings: { control, sens, sfx, music, buzz } }
```

Nothing else is stored anywhere.

## Friend races

The phones connect directly to each other with WebRTC through the PeerJS library. A public PeerJS matchmaking service introduces them using the pack code; after that the game data goes phone to phone.

- The phone that starts the pack is the host. Up to three more join. The host's phone runs the computer dogs.
- Every phone builds the same course from the level's seed and runs its own dog. About 15 times a second it sends that dog's position; the host passes everyone's positions on.
- What a dog eats, hugs, tags or picks up is sent as an event, and every phone removes it. If two dogs grab the same thing in the same instant, both get credit.
- Each phone times its own dog. The host ranks finishers by time, then the rest by distance, works out every score with the same rules, and sends the standings to everyone.
- If a phone goes quiet for six seconds mid-race it is dropped and its dog fades out. If the host leaves, the pack ends.
- There are no names and no chat. Players are "You" and "Player 2".

Limits to know about: the public matchmaking service is free and has no uptime promise, and a few phone networks block direct links between phones. When that happens the join fails with a plain message. A small relay server of our own would fix both; see the admin notes.

## Accessibility

- Menus are real buttons and headings, work with a keyboard, and show a focus ring. Choices are radio groups and switches with their state exposed.
- Body text on the dark screens is cream on deep purple (contrast about 15 to 1); the yellow buttons use near-black text (about 11 to 1).
- Nothing in the menus depends on color alone. On the track each dog has a colored ring and the player's ring is thicker and labeled "YOU" at the start.
- Every danger is shown by shape and motion as well as color: a circle on the ground, a sweeping jet, a spreading ring.
- Screen shake is off when the device asks for reduced motion. Vibration, sound and music each have a switch.
- Three ways to steer, so the game does not require tilting, two hands or fine motion.
- Known gap: the race itself cannot be played with a screen reader.

## Content notes

- Cartoon action only. Bad Owners are gulped and vanish in a puff of stars. Nothing is shown being done to a dog.
- All characters are made up. No real person is named or drawn.
- Kids only hug and wave.
- No ads, purchases, accounts, links out or data collection, which keeps the game clear of the rules for apps aimed at children. If it goes to an app store, the listing should say it has cartoon violence.

## Test plan

| Check | How |
| --- | --- |
| Every level can be finished, no dog stuck, bosses beatable | `npm test` plays all 20 levels with four packs of computer dogs |
| Steering by tilt, thumb and keys; Zoomies; pause; results; saving; first-run flow; no console errors; 360 pixel phone and desktop | `npm run test:browser` |
| Friend race start to finish on two browsers, same world and standings on both, rematch, a player dropping out | `npm run test:friends` |
| Looks right | Screenshots from the browser test, read by eye |
| Real phones | Not done yet. Tilt was checked with simulated sensor events only. First thing to do once the game is on a web address |
