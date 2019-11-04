# Part 6: Dealing damage and deciding direction

## Making a monster

Right now, our generic entity is little more than a container for positioning things on the stage. How should we expand it to encapsulate combat and movement?

There’s no simple answer to this that will satisfy everyone and work well for every game and some potential options are controversial and problematic (inheritance, ECS). A good structure can emerge quite directly from the design of your game if you pay close attention to defining conceptual boundaries between things.

For instance, are all mobs hostile monsters or will you distinguish between animals, monsters and NPCs? This could affect how you bundle attributes and combat stats.

Do you have a wide range of similar items with varying modifiers (potions, weapons), or do you have special behaviour and properties attached to items (locked doors, gun turret traps)? This could influence whether you put actors and items into separate hierarchies or how you share traits between objects.

Design constraints for the tutorial game:

- No NPCs. Everything that moves is hostile to the player.
- Monsters do not attack each other.
- Some monsters (humanoids) carry equipment and wield weapons.

We’ll avoid the bugbear of inheritance by treating the entity as a generic placeable game object with all its behaviour and stats coming from distinct components that attach to each instance. We’ll cover monsters with the entity here, then eventually expand it to cover items too.

## Defining the combat component

The concept of a component can be slightly different for every codebase and every engine. Here, we will use it to mean a pluggable object that controls the behaviour of an entity in a particular area within the game, whether that be combat mechanics, choosing the next action, or managing inventory. This is a slightly different concept of a component from that of spanning a domain or subsystem within the game engine, such as input, graphics, audio, etc. These components are more like ‘traits’ or ‘facets’ that turn a generic entity into a specific one.

We won’t create any sort of base class or mixin concept. Each component will be standalone and define its own unique interface to address each specific concern within the game.

The first component we’ll introduce is `Fightable`—a trait that defines an entity as being able to engage in combat, holding a basic set of attributes representing hit points and attack and defence values. You could also call it something like `Fighter`, `Combatant` or `CombatStats`, depending on which style of naming you prefer.

- `health` represents the hit point status of the entity. It can’t go over `maxHealth`. If it reaches zero, the entity dies.
- `attack` is added to melee attack rolls to increase the attackers chance of hitting the target.
- `defence` is added to the target’s defensive score to decrease an attack roll’s chance of hitting.
- The base attack roll is 1d100. The base defensive score is 50.

Make a new file at `src/fightable.js` and add the following to set up these basic attributes for managing combat and damage.

```js
class Fightable {
  constructor(health, attack, defence) {
    this.maxHealth = this.health = health;
    this.attack = attack;
    this.defence = defence;
  }
}

export default Fightable;
```

## Making entities that can fight

To attach the `Fightable` component to entities, we’ll inject an instance via the entity constructor. For now, we’ll just add an extra parameter to the constructor, and tidy this up later on once we introduce more components.

```js
class Entity {
  constructor(x, y, name, flags, fightable) {
    // ...

    if (fightable) {
      this.fightable = fightable;
      this.fightable.owner = this;
    }
  }
}
```

We also attach a backreference from the component to the entity that owns it.

## Spawning monsters on the stage

Now we can go ahead and fill in some default attributes for our monsters and player.

Create a new file `src/monsters.js` and add a placeholder function for generating new monsters. This is the bare minimum needed to get this up and running. Later, we’ll expand this to create monsters with a range of different attributes and types of behaviour.

```js
import Entity from "./entity";
import Fightable from "./fightable";

function spawnMonster(x, y) {
  const fightable = new Fightable(20, 0, 0);
  return new Entity(x, y, "monster", {}, fightable);
}

export {
  spawnMonster
}
```

We’ll deal with abstracting the player attributes later. We can get this working now by modifying the player entity creation in place in `index.js`.

```js
// ...
import Fightable from "./fightable";

// ...
const player = new Entity(
  Math.floor(width / 2),
  Math.floor(height / 2),
  "player",
  {},
  new Fightable(30, 10, 10)
);
```

In `stage.js`, modify the entity spawning behaviour to call the `spawnMonster` function, rather than define the monster creation inline.

```js
// ...
import { spawnMonster } from "./monsters";

class Stage {
  // ...

  initializeEntities(player, rooms) {
    // ...

    for (let r=1; r<rooms.length; r++) {
      // ...

      this.addEntity(spawnMonster(spawnAt.x, spawnAt.y));
    }
  }
}
```

## Bump attacks

Monsters now spawn with basic combat-ready attributes but they’re still inert and nothing happens when the player bumps into them. We do have a seam in the existing code that will make it very straightforward to add attacks towards a target entity.

In `entity.js`, add a predicate method `isFightable` and replace the `bump` method with a basic check that delegates to a `meleeAttack` method if an attack is possible.

```js
class Entity {
  // ...

  isFightable() {
    return this.hasOwnProperty("fightable");
  }

  bump(target) {
    if (target.isFightable()) {
      this.fightable.meleeAttack(target.fightable);
    }
  }
}
```

Notice we pass an instance of the component as the target rather than the entity itself.

In `meleeAttack`, we can start to flesh out the basic combat routine we outlined earlier, based on rolling 1d100 against a defensive score of 50.

To handle the random rolls here, we’ll use JavaScript’s built-in `Math.random` function, rather than one of the seedable generators from `rung`.

```js
import Random from "rung/src/random";

const rng = new Random(Math.random);

class Fightable {
  // ...

  meleeAttack(target) {
    const attackRoll = this.attack + rng.integer(1, 100);
    const defensiveScore = target.defence + 50;

    if (attackRoll > defensiveScore) {
      target.dealDamage();
    }
  }
}
```

How should we deal damage? This is something we’ll have to come back to when we add weapons and different types of attacks. In the meantime, we’ll delegate to a `dealDamage` method and subtract health from the target based on the result of a random roll.

```js
class Fightable {
  // ...

  dealDamage() {
    const damage = rng.integer(1, 6);
    this.health -= damage;
    return damage;
  }
}
```

If we return the damage amount from `dealDamage`, we can replace the original console logging with more detailed messages about what just happened.

```js
class Fightable {
  // ...

  meleeAttack(target) {
    // ...

    if (attackRoll > defensiveScore) {
      const damage = target.dealDamage();
      console.log(`${this.owner.name} hit ${target.owner.name} for ${damage} damage`);
    } else {
      console.log(`${this.owner.name} was blocked by ${target.owner.name}`);
    }
  }
}
```

All this really does is make debugging easier. We’ll need to come up with a better solution when we add a message log to the UI.

## Moving of their own volition

So far, the player can attack the monsters but the monsters can’t attack the player. This would be easy enough when the monsters are positioned on a tile adjacent to the player, but if they’re not, they’ll need to move into position first. So we’ll need to give them some way of deciding where to go next.

We’ll represent this decision-making capability with a `Volition` component that represents the monster AI state and delegates to various behaviors that perform actions. If an entity has volition it can take turns and control its own actions based on information it can read from the game.

Create a new file at `src/volition.js` and stub in a `takeTurn` method which writes a log line.

```js
class Volition {
  takeTurn(stage) {
    console.log(`${this.owner.name} ponders the meaning of its existence`);
  }
}

export default Volition;
```

Rather than adding yet another parameter to the entity constructor for this new component, now is a good time to set up a more generic method of attaching the components.

In `entity.js`, replace the ad-hoc references to `fightable` with a `component` object.

```js
class Entity {
  constructor(x, y, name, flags, components) {
    // ...

    for (let attribute of Object.keys(components)) {
      this[attribute] = component;
      this[attribute].owner = this;
    }
  }
}
```

Now we can attach any number of components to the entity without modifying the constructor. The disadvantage here is that we’ve lost a bit of type safety (not that we had much to begin with) but the advantage is that we don’t have to write any extra code to manage new components we introduce.

We’ll need to go through and update each place where the entity is constructed.

First in `monsters.js`.

```js
// ...
import Volition from "./volition";

function spawnMonster(x, y) {
  const components = {
    fightable: new Fightable(20, 0, 0),
    volition: new Volition()
  }
  return new Entity(x, y, "monster", {}, components);
}
```

Then in `index.js` change how the player is constructed to support the `Fightable` component, but don’t inject `Volition` here as its actions need to be controlled via player input.

```js
// ...
import Volition from "./volition";

// ...

const player = new Entity(
  Math.floor(width / 2),
  Math.floor(height / 2),
  "player",
  {},
  {
    fightable: new Fightable(30, 10, 10)
  }
);
```

Now modify the entity so it can act under its own volition.

```js
class Entity {
  // ...

  hasVolition() {
    return this.hasOwnProperty("volition");
  }

  takeTurn(stage) {
    this.volition.takeTurn(stage);
  }
}
```

Finally, change the update loop in `index.js` to check that the entity is able to take a turn, and pass down the `stage` instance when it does. Alternatively, you could bind the stage to the entity when it gets added.

```js
function update() {
  // ...

  if (!playerTurn) {
    for (let entity of stage.entities) {
      if (entity.hasVolition()) {
        entity.takeTurn(stage);
      }
    }
    playerTurn = true;
  }
}
```

## Drunken walking

The first AI behaviour we’ll add is a [drunken walk](https://en.wikipedia.org/wiki/Random_walk) that moves the entity in a random cardinal direction. This is a simple way to test the monster movement. Later on, it could be used to drive wandering or confused states.

The first thing we need is a list of unit vectors for the cardinal directions, so that we know which way to move.

Create a new file `src/directions.js` and add the following.

```js
const Directions {
  CARDINAL: [
    { x: -1, y: 0 },
    { x: 1, y: 0},
    { x: 0, y: -1 },
    { x: 0, y: 1 }
  ];
}

export default Directions;
```

Create a new file `src/behavior.js` and add a `drunkenWalk` function to drive a very simple behavior of moving in a randomly selected cardinal direction if that tile is walkable.

```js
import Directions from "./directions";
import Random from "rung/src/random";

const rng = new Random(Math.random);

function drunkenWalk(entity, stage) {
  for (let i=0; i<4; i++) {
    let direction = Directions.CARDINAL[rng.integer(4)];
    let x = entity.x + direction.x;
    let y = entity.y + direction.y;

    if (stage.canMoveTo(x, y) && stage.isUnoccupied(x, y)) {
      stage.moveEntityTo(entity, x, y);
      break;
    }
  }
}

export {
  drunkenWalk
}
```

Update `volition.js` to use this behavior.

```js
import { drunkenWalk } from "./behavior";

class Volition {
  takeTurn(stage) {
    drunkenWalk(this.owner, stage);
  }
}
```

You should now see the monsters wandering around the map!

## Planning a path

It’s time to add pathfinding behavior to the monsters so they can chase down the shortest path to the player to perform melee attacks.

I could go on and on about A\* search and other graph algorithms—graph computing is a subject I’m fascinated by—but that’s not really the focus of this tutorial. Like the FOV example from Part 4, I’ll present the code to handle pathfinding here as a standalone module, without too much explanation.

Unlike the FOV example, it’s not quite so easy to provide A\* as a reusable function that can be copy-pasted into any JavaScript project, though I’ve done my best to set things up in such a way to support this at the cost of a bit of extra indirection.

One of the key ideas of [A\* and related algorithms](https://www.redblobgames.com/pathfinding/a-star/introduction.html) is the use of a [priority queue](https://en.wikipedia.org/wiki/Priority_queue) to manage the order of connections it explores (a regular breadth-first search uses a standard FIFO queue). Rather than implement this level of plumbing in the tutorial, we’ll grab the [peculiar](https://npmjs.com/package/peculiar) library from NPM to provide this capability.

Run the following command to install it to your project.

```
npm install --save peculiar
```

Now create a new file `src/pathfinder.js` and add the following.

```js
import PriorityQueue from "peculiar/priority-queue";

function tracePath(paths, origin, target) {
  let current = target;
  const path = [];

  while (current !== origin) {
    path.push(current);
    current = paths.get(index(current));
  }

  return path.reverse();
}

function index(point) {
  return `${point.x},${point.y}`;
}

function createPathfinder(
  adjacentNodes,
  costHeuristic,
  traversalCost,
  isTraversable
) {
  return function search(origin, target) {
    const frontier = new PriorityQueue();
    const costs = new Map();
    const visited = new Map();

    frontier.push(origin, 0);
    costs.set(index(origin), 0);
    visited.set(index(origin), null);

    while (!frontier.isEmpty()) {
      let current = frontier.poll();

      if (current.x == target.x && current.y == target.y) break;

      for (let candidate of adjacentNodes(current.x, current.y)) {
        if (!isTraversable(candidate.x, candidate.y)) continue;

        let costSum =
          costs.get(index(current)) + traversalCost(candidate.x, candidate.y);

        if (
          !costs.has(index(candidate)) ||
          costSum < costs.get(index(candidate))
        ) {
          costs.set(index(candidate), costSum);
          visited.set(index(candidate), current);
          frontier.push(candidate, costSum + costHeuristic(target, candidate));
        }
      }
    }

    return tracePath(visited, origin, target);
  };
}

export {
  createPathfinder
}
```

Of course, you could just [import a library](https://www.npmjs.com/search?q=keywords:astar) to handle the entire process of A\* searching if that suits your needs better, but there are some advantages of having the algorithm inline in your project. For one, it makes it easier to adapt the API directly to your project’s style. It should be very straightforward to adapt the code here to flip between Dijkstra’s algorithm and greedy best-first search or collect the set of visited paths in a different way. Having the code inline also facilitates experimenting with performance optimisation if needed.

## Integrating the pathfinding behavior

To use the pathfinder, we need to provide hooks into our map data to define which areas of the map are traversable and what the cost of moving between tiles is.

The specific callback functions defined by the pathfinder are:

- `adjacentNodes`
- `costHeuristic`
- `traversalCost`
- `isTraversable`

This means the pathfinder has no direct dependency on any of the game state or the structure of the `Stage` object. Everything it knows about the map we have to tell it, using these callback functions.

## The adjacency list

The first thing we need to do is implement the `adjacentNodes` accessor to treat map tiles as an [adjacency list](https://en.wikipedia.org/wiki/Adjacency_list). This is the core building block of the pathfinding algorithm and it’s fairly straightforward to implement.

Given an `x` and `y` position on the map, our accessor should return all the valid neighbouring tiles in each cardinal direction. This is also known as a [4-neighbourhood or Von Neumann neighborhood](https://en.wikipedia.org/wiki/Von_Neumann_neighborhood).

In `stage.js`, add this `adjacentPoints` method to build up a list of neighbours, skipping over any points that are out of bounds based on the map dimensions.

```js
// ...
import Directions from "./directions"
// ...

class Stage {
  // ...

  adjacentPoints(x, y) {
    const points = [];
    for (let direction of Directions.CARDINAL) {
      let candidate = {
        x: x + direction.x,
        y: y + direction.y
      };
      if (
        candidate.x >= 0 &&
        candidate.x < this.width &&
        candidate.y >= 0 &&
        candidate.y < this.height
      ) {
        points.push(candidate);
      }
    }
    return points;
  }

  // ...
}

```

## The traversal cost

We’ll treat all floor tiles as having a uniform cost. This can be changed in future if we want to have map tiles that cost more to cross, such as mud puddles, doors, or piles of rubble.

What we’ll also do is make it slightly more costly to move through a position that’s occupied by another entity. This way, monsters can still select a path through another monster if they need to (assuming that the other monster is likely to move out of the way on the next turn), but they’ll tend to prefer paths that go around the occupied tiles.

In `stage.js`, add the following.

```js
class Stage {
  // ...

  movementCost(x, y) {
    return this.isUnoccupied(x, y) ? 1 : 5;
  }

  // ...
}
```

That’s all we need to add to the stage to get pathfinding in place. Everything else, we can handle as part of the behavior itself.

## The cost heuristic

In order to trace the shortest path across the grid between an origin and target, the pathfinder needs to know whether any given point it lands on is closer or further away to the target.

The standard cost heuristic for A\* is a calculation of straight line distance. There are various different ways of calculating this on a grid. We’ll use [Manhattan distance](https://en.wikipedia.org/wiki/Taxicab_geometry), with a [slight tweak to scale the cost upwards](http://theory.stanford.edu/~amitp/GameProgramming/Heuristics.html#breaking-ties).

In `behavior.js`, create a new function `meleeCharge` and add the cost heuristic function here, along with the other callback functions delegating to methods on the `Stage`.

```js
// ...

function meleeCharge(entity, target, stage) {
  const adjacentNodes = (x, y) => stage.adjacentPoints(x, y);
  const costHeuristic = (from, to) => (
    Math.abs(from.x - to.x) + Math.abs(from.y - to.y) * 1.01
  );
  const traversalCost = (x, y) => stage.movementCost(x, y);
  const isTraversable = (x, y) => stage.canMoveTo(x, y);

  // Chase the player here
}

export {
  drunkenWalk,
  meleeCharge
}
```

## Chasing the player

Roguelikes use lots of interesting and creative ways of alerting hostile monsters to the presence of the player. We won’t do anything of the sort here. Instead, we’ll lean on the player’s field of view, changing the state of monsters who are within range of the player. A crude hack perhaps, but it’s enough to get everything working end to end.

In `behavior.js`, implement the pathfinding and chasing using the available methods on the `Stage`. If there is an unobstructed path to the target, then move one tile in that direction. If the target is directly adjacent, then bump it.

```js
function meleeCharge(entity, target, stage) {
  // ...

  const search = createPathfinder(
    adjacentNodes,
    costHeuristic,
    traversalCost,
    isTraversable
  );

  const path = search(
    { x: entity.x, y: entity.y },
    { x: target.x, y: target.y }
  );

  const next = path[0];

  if (stage.isUnoccupied(next.x, next.y)) {
    stage.moveEntityTo(entity, next.x, next.y);
  } else {
    const entities = stage.entitiesAt(next.x, next.y);
    const player = entities.find(e => e === target);
    entity.bump(player);
  }
}
```

Finally, update `volition.js` to pick the monster’s next move based on whether it is in the player FOV or not. If the monster is visible to the player, then attempt a melee attack. Otherwise, wander drunkenly through the dungeon.

```js
import { drunkenWalk, meleeCharge } from "./behavior";

class Volition {
  takeTurn(stage) {
    if (stage.isVisible(this.owner.x, this.owner.y)) {
      meleeCharge(this.owner, stage.player, stage);
    } else {
      drunkenWalk(this.owner, stage);
    }
  }
}
```

This isn’t very clever AI, but it’s enough to set up the chasing behavior. If you run into a few monsters and look at the console, you’ll see the combat working behind the scenes.

## That was exhausting

That was hopefully the longest and most complex tutorial part to get through. We added a whole lot of structure to form the foundation of entity management and AI behavior and expanded the stage to support it.

Moving the player around the map, you’ll notice a few glaring things that are missing. Combat is totally invisible. Entities remain on the stage after their health reaches 0, with no way of escaping or doing anything further when they pin the player into a tight space.

Some of this relates to stage management and gameplay but a good portion of it involves giving feedback to the player. Which means for Part 7, it’s time to shift focus away from the underlying components and start building out the UI to represent an actual game rather than just a generic map.
