# Chase the Cat: requirements

Written November 13, 2026 from the original brief. Each story lists acceptance criteria in EARS form (When, While, If, Where) and how it was checked. "Sim" means `tests/sim.test.mjs`, "Browser" means `tests/browser.test.mjs`, "Friends" means `tests/friends.test.mjs`, "Seen" means checked by eye in screenshots at 360 by 740 pixels.

## Who it is for

Anyone with a phone who likes dogs. It should be playable by a child and still fun for an adult. Play sessions are short: one race is 20 to 60 seconds.

## Stories and acceptance criteria

### 1. Pick a dog

As a player, I pick my dog the way I would pick a token in a board game, so the race feels like mine.

- The game shall offer at least eight dogs, including a Pit Bull and Zazu. (Browser)
- Zazu shall have the best overall stats of any dog. (Data: `data/dogs.json`)
- When a dog is selected, the game shall show its name, four stat bars, its perk and its level. (Browser, Seen)
- When the player confirms a dog, the game shall remember it on that device. (Browser)

### 2. Learn the game from Sven

As a new player, I watch Sven explain the rules with animation, so I know what to do before the first race.

- When Play is tapped for the first time, the game shall show Sven's intro before anything else. (Browser)
- The intro shall cover, each with its own animated scene: the story, tilt forward, lean to steer, stay, back up, thumb steering, water, kids, Bad Owners, Zoomies and how to win. (Browser, Seen)
- While the intro plays, the game shall offer Skip and Next, both reachable by keyboard. (Browser)
- The game shall let the player watch the intro again from the title screen and from Settings. (Seen)

### 3. Steer by tilting the phone

As a player, I move my dog by how I hold my phone.

- When the phone is tipped forward from the stay position, the dog shall run forward. (Browser, simulated sensor)
- When the phone is tipped forward and leaned to a side, the dog shall run forward and to that side. (Browser)
- While the phone is held in the stay position, the dog shall stand still. (Browser)
- When the phone is tipped back, the dog shall back up, slower than it runs. (Browser)
- When the countdown starts, the game shall take the phone's current position as the stay position, and the pause menu shall let the player reset it. (Browser, Seen)
- If the phone asks for permission to use motion sensors, the game shall ask from the Start tap, and if permission is refused or no sensor answers, the game shall switch to thumb steering and say so. (Code review; needs a real iPhone to confirm)
- While a race runs, the game shall ask the phone to keep its screen awake. (Code review)

### 4. Steer without tilting

As a player who does not want motion controls, I can use my thumb.

- Where thumb steering is chosen, when the player drags on the screen, the dog shall move in the direction of the drag, faster the farther the drag. (Browser)
- When the finger lifts, the dog shall stop. (Browser)
- Where a keyboard is present, the arrow keys or W A S D shall steer, the space bar shall fire Zoomies and Escape shall pause. (Browser)
- The player shall be able to switch between tilt and thumb before a race, in the pause menu and in Settings. (Browser)

### 5. Race to the finish

As a player, I race three other dogs to the finish line.

- Each race shall have four dogs: the player and three others. (Sim)
- When a dog crosses the finish line, the game shall record its place and time. (Sim)
- When the first dog finishes, the game shall give the rest 20 seconds, then place them by how far they got. (Sim)
- Every level shall be finishable by the computer dogs alone, with no dog stuck. (Sim: all 20 levels, 4 packs each)

### 6. Water slows you down

- While a dog is in water and not on a bridge, the game shall reduce its speed by that dog's swim rating. (Sim, Seen)
- While a dog has Zoomies, water shall not slow it. (Sim)

### 7. Kids hug the dogs

As a player, kids along the road hug my dog, which levels him up.

- When a dog comes within reach of a kid who has not hugged it yet, the dog shall walk to the kid by itself and be hugged for about a second. (Sim, Seen)
- When a hug ends, the game shall award points and Love and give the dog a short speed boost. (Sim)
- While a dog is being hugged, nothing shall hurt it. (Sim)
- No game event shall ever harm a kid. (Design: kids have no health and nothing targets them)
- While a dog has Zoomies, it shall run past kids without stopping. (Sim)

### 8. Eat the Bad Owners

As a player, each obstacle has a Bad Owner I can eat for massive points.

- When a dog touches a Bad Owner, the dog shall eat him: he is removed for every racer, and the dog gets points, energy and a rescued pup. (Sim, Seen)
- A Bad Owner shall be worth at least five times a hug. (Data: 2,500 against 300)
- Each kind of Bad Owner shall have one clear danger and one clear way to beat it, shown before it happens. (Seen)
- When a Bad Owner's attack lands on a dog, the game shall slow, stun or hold the dog for no more than about 1.5 seconds. (Data)
- No real person shall appear in the game. All Bad Owners are made up. (Design)

### 9. Energy and Zoomies

- When a dog eats a Bad Owner, the game shall add energy. (Sim)
- When the player fires Zoomies with at least one full pip, the game shall spend one pip and make the dog faster and immune to hazards for a short time. (Browser, Sim)

### 10. The cat

- The cat shall always run ahead of the leading dog and reach the finish first. (Sim)
- When the cat stops to taunt and a dog touches her before she bolts, the game shall award a tag bonus. (Sim)

### 11. Points, stars and levels

- The game shall show a score breakdown after every race. (Browser, Seen)
- The game shall award one star for a top three finish, two for a win and three for a win under par time. (Sim, Browser)
- When a level is finished with at least one star, the game shall open the next level. (Browser)
- The game shall have 20 levels that get harder, with a boss on levels 5, 10, 15 and 20. (Data, Sim)
- The game shall save stars, best scores and each dog's Love on the device. (Browser)

### 12. Race friends

As a player, I race up to three friends, each on their own phone.

- When a player starts a pack, the game shall show a four-letter code and a way to share it. (Friends, Seen)
- When another player enters the code, the game shall add them to the pack and show every member on every phone. (Friends)
- When the host starts the race, every phone shall start the same level with the same course. (Friends)
- While racing, each phone shall show the other dogs moving close to where they really are. (Friends: on a direct local link, within about 60 track units at full speed, which is under a fifth of a second)
- When a dog eats a Bad Owner or picks up a bone, it shall disappear on every phone. (Friends)
- The game shall fill empty spots with computer dogs. (Friends)
- When everyone has finished or time is up, every phone shall show the same finishing order. (Friends)
- If a phone drops out mid-race, the others shall keep racing. (Friends)
- The game shall not offer free-text names or chat. (Design)

### 13. Works on a phone, and for everyone

- The game shall fit a 360 pixel wide phone with no sideways scrolling. (Browser, Seen)
- On a wide screen the game shall sit in a centered phone-shaped column. (Browser)
- Every menu shall be usable with a keyboard alone, with a visible focus ring. (Browser)
- Every button shall have a text label or an accessible name. (Code review)
- Where the device asks for reduced motion, the game shall not shake the screen. (Code review)
- The game shall load with no console errors. (Browser)
- The game shall collect no personal data and load nothing from other sites during single-player play. (Code review)

## Out of scope for this version

- App store builds. The web app comes first.
- Accounts, leaderboards, purchases.
- A screen reader cannot play the race itself, only the menus. See the design notes.
