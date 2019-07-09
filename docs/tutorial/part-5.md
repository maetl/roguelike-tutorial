# Part 5: Placing monsters and bumping them around

The map is an empty and lifeless place without anything to interact with. Before we can get monsters moving around the map, chasing the player and dishing out damage, we’ll need to put some structure in place for representing entities on the stage and placing them in rooms when the dungeon first loads.

## Refactoring the player reference

As we discussed in Part 2, the player-controlled and computer-controlled entities share most of their behaviour in common—with the main difference being that the player entity is controlled by keyboard input, rather than AI decisions.

For input and action decision-making, we want to treat the player as a special case, but for the rest of the time, we shouldn’t need to distinguish it from the rest of the live entities.

We’ll need to put a bit of groundwork in place to support this. In the constructor of `stage.js`, replace the `this.player` assignments with a call to a new method `initializeEntities`.

```js
class Stage {
  constructor(width, height, player) {
    // ...
    this.initializeEntities(player, start);
    this.initializeVisibility();
  }

  // ...

  initializeEntities(player, start) {
    player.x = start.x;
    player.y = start.y;
    this.player = player;
  }
}
```

Next, we’ll set up the stage to store the list of entities currently on the map. The player is the only one we have so far, so we’ll push it into the list first.

```js
class Stage {
  // ...

  initializeEntities(player, start) {
    this.entities = [];

    player.x = start.x;
    player.y = start.y;
    this.player = player;

    this.entities.push(player);
  }
}
```

## (Re)place the player on the map

First, let’s address an oversight from the initial implementation of the dungeon generator which treated the starting player position as a special case. Instead, we’ll move control over this decision into `initializeEntities`.

In `dungeon.js`, remove the calculation of the `start` position and its returned value.

```js

// Delete this line
//const start = rooms[0].center();

return {
  rooms,
  tiles
}
```

In `stage.js`, instead of passing `start` into `initializeEntities`, we’ll pass the list of rooms.

```js
class Stage {
  constructor() {
    // ...
    const { tiles, rooms } = generateDungeon(width, height);
    // ...
    this.initializeEntities(player, rooms);
    // ...
  }

  // ...
}
```

The `initializeEntities` method now has to look up the player start position from the list of rooms.

```js
class Stage {
  // ...

  function initializeEntities(player, rooms) {
    this.entities = [];

    const startAt = rooms[0].center();
    player.x = startAt.x;
    player.y = startAt.y;
    this.player = player;

    this.entities.push(player);
  }
}
```

## Place monsters on the map

We now have everything we need set up to start placing monsters.

The following code loops through the list of rooms passed to `initializeEntities` and spawns a monster in the center for a certain percentage of rooms (note that this iterates from `1` rather than `0`, to avoid pushing monsters into the same starting room as the player).

```js
class Stage {
  // ...

  function initializeEntities(player, rooms) {
    // ...

    for (let r=1; r<rooms.length; r++) {
      if (Math.random() < 0.6) {
        const spawnAt = rooms[r].center();
        this.entities.push(new Entity(spawnAt.x, spawnAt.y));
      }
    }
  }
}
```

This is not very interesting or fun yet, but we can refine it later.

## Render all entities within the FOV

We’re spawning entities on the stage, but not yet showing them on the screen. To support our polymorphic concept of entities representing the player and monsters, we can replace the special case player rendering with a more general method that renders all the visible entities.

In `screen.js`, add a glyph to represent the placeholder monsters.

```js
const Glyphs = {
  // ...
  MONSTER: Cell("M", "#0C9"),
  // ...
}
```

Next, add the basic scaffolding to render all visible entities on the map.

```js
class Screen {
  // ...

  renderPlayer(player) {
    this.grid.writeCell(player.x, player.y, Glyphs.PLAYER);
  }

  renderEntities(stage) {
    for (let entity of stage.entities) {
      if (stage.isVisible(entity.x, entity.y)) {
        this.grid.writeCell(entity.x, entity.y, Glyphs.MONSTER)
      }
    }
  }

  render(stage) {
    this.renderMap(stage);
    this.renderEntities(stage);
    this.renderPlayer(stage.player);
    this.grid.render();
  }
}
```

At this point, we have a basic visual representation of all the entities and the player can move around and see them on the map.

## Taking up space

Notice what happens when you run the player glyph over a monster tile. Nothing.

To pave the way for bump combat and displacement, we need to enable entities to take up space so that other entities can’t occupy the same tile. We don’t necessarily want this for all entities—only those we want to model as taking up space (monsters, NPCs, fixed traps, etc).

Some game architectures will see this differently and make a more explicit distinction between entities with movement and behaviour (‘actors’) and static objects that can be stacked and moved over the top of (‘items’). There’s no right or wrong answer here. The choice comes down to both personal preference and game mechanics.

We’ll add this capability to the game in two steps. First, we’ll represent the blocking property on the entity itself. Then, we’ll add a spatial lookup method to the stage so we can check whether any entities exist on the target tile before the player tries to move there.

## Flag entities as blocking

Adding a full-blown entity-component model to a game of this size and scope is probably an exercise in overengineering. At the same time, we don’t want to overload the entity class with all sorts of special case behaviours or introduce a brittle class hierarchy for the different kinds of entities.

A reasonable compromise we can make that balances the tradeoff between flexibility and cohesion is to group together all the behavioural predicates of an entity. In plain English, we want a way of populating each individual entity with a bundle of flags that can be true or false.

Let’s start by populating each individual entity with a name and a bundle of flags that can be true or false, then later, refactor towards the [type object pattern](https://gameprogrammingpatterns.com/type-object.html) or a variation of the [prototype pattern](https://gameprogrammingpatterns.com/prototype.html) that leverages idiomatic JavaScript.

```js
const defaultFlags = {
  blocking: true
}

class Entity {
  constructor(x, y, name, flags) {
    this.x = x;
    this.y = y;
    this.name = name;
    this.flags = {...flags};
    this.action = null;
  }

  isBlocking() {
    return this.flags.blocking;
  }
}
```

Since we’ve changed the constructor we now need to change the points where it gets instanciated.

In `index.js`.

```js
const player = new Entity(Math.floor(width / 2), Math.floor(height / 2), "player");
```

And `stage.js`.

```js
this.entities.push(new Entity(spawnAt.x, spawnAt.y, "monster"));
```

## Index entities by tile

To check whether or not an entity exists on a tile we could loop through the entire list of entities each time we want to move but this seems wasteful and annoying. A better way is to add some bookkeeping to the stage that tracks the current position of all the entities, indexed by their tile location.

In `stage.js`, add an additional 2D array to `initializeEntities` and ensure that everywhere we call `this.entities.push`, we also sync the entity in this new array. To avoid potential bugs from forgetting to manage this coordination, we can wrap entity registration in an `addEntity` method that handles both data structures.

```js
class Stage {
  // ...

  initializeEntities(player, rooms) {
    this.entities = [];
    this.entitiesMap = Array(this.height)
      .fill(null)
      .map(() =>
        Array(this.width)
          .fill(null)
          .map(() => [])
      );

    const startAt = rooms[0].center();
    player.x = startAt.x;
    player.y = startAt.y;
    this.player = player;

    this.addEntity(player);

    for (let r=1; r<rooms.length; r++) {
      if (Math.random() > 0.6) continue;
      const spawnAt = rooms[r].center();
      this.addEntity(new Entity(spawnAt.x, spawnAt.y, "monster"));
    }
  }

  addEntity(entity) {
    this.entities.push(entity);
    this.entitiesMap[entity.y][entity.x].push(entity);
  }
}
```

We’ll do the same for entity movement, wrapping it in a method of the `Stage` that coordinates both data structures. This is a bit more annoying to implement due to JavaScript’s language-level decision not to provide a method like `Array.prototype.remove`.

```js
class Stage {
  // ...

  moveEntityTo(entity, x, y) {
    this.entitiesMap[entity.y][entity.x] = this.entitiesMap[entity.y][
      entity.x
    ].filter(e => e !== entity);
    entity.x = x;
    entity.y = y;
    this.entitiesMap[y][x].push(entity);
  }
}
```

While we’re here, we might as well implement the `removeEntity` method that’s symmetric to `addEntity`.

```js
class Stage {
  // ...

  removeEntity(entity) {
    this.entitiesMap[entity.y][entity.x] = this.entitiesMap[entity.y][
      entity.x
    ].filter(e => e !== entity);
    this.entities = this.entities.filter(e => e !== entity);
  }
}
```

## Blocking movement to an occupied tile

Now we can test out our blocking flag, preventing the player from moving into an occupied tile.

In `index.js`, add the `isUnoccupied` check and modify the movement routine to ensure the player position is properly tracked by the stage. We no longer need the min and max checks as the map walls are now doing the work of keeping the movement within bounds.

```js
function update() {
  if (action) {
    const mx = stage.player.x + action.x;
    const my = stage.player.y + action.y;

    if (stage.canMoveTo(mx, my) && stage.isUnoccupied(x, y)) {
      stage.moveEntityTo(player, mx, my);
      stage.refreshVisibility();
    }

    action = null;
  }
}
```

From here, adding the blocking behaviour just requires a small modification to `stage.js`.

```js
class Stage {
  // ...

  isUnoccupied(x, y) {
    return !this.entitiesMap[y][x].some(e => e.isBlocking())
  }
}
```

Test this out. The player is now prevented from running over the top of the monsters.

## Things that go bump

The problem with our current implementation is that it doesn’t allow us to distinguish between bumping into a wall or bumping into a monster. We need to break this up into separate branches so we can treat bumping the monster as a behaviour with its own special logic.

What our `update` function needs to do is something more like this.

```js
function update() {
  if (action) {
    const mx = stage.player.x + action.x;
    const my = stage.player.y + action.y;

    for (let entity of stage.entitiesAt(mx, my)) {
      if (entity.isBlocking()) {
        stage.player.bump(entity);
        action = null;
        return;
      }
    }

    if (stage.canMoveTo(mx, my)) {
      stage.moveEntityTo(player, mx, my);
      stage.refreshVisibility();
    }

    action = null;
  }
}
```

Getting this to work requires an accessor method to lookup entities at a tile location in `stage.js`.

```js
class Stage {
  // ...

  entitiesAt(x, y) {
    return this.entitiesMap[y][x];
  }
}
```

We also need to introduce the `bump` hook to the entity class. As a placeholder, we’ll just print out the sender and reciever to the console.

```js
class Entity {
  // ...

  bump(target) {
    console.log(`${this.name} kicks ${target.name} in the shins`);
  }
}
```

Now when you run into a monster you should see this message printed out to the console in your browser’s Developer Tools.

## The update loop

We’re close to getting the core turn loop under control. Let’s start here with a naive and brute force approach for iterating through the entities and running updates, then morph it into a more robust form in Part 6.

First, let’s add a function to the entity which will get called to process each turn. For now, it should do the same thing as `bump`, printing a line to the console.

```js
class Entity {
  // ...

  takeTurn() {
    console.log(`${this.name} ponders the meaning of its existence`);
  }
}
```

To bounce input control between the player and monsters in `index.js`, we’ll add a temporary variable `playerTurn` which will be `true` when the player can act and `false` when the monsters can act.

```js
let playerTurn = true;

function update() {
  if (action && playerTurn) {
    // ...
  }
}
```

We need to pull the movement code out of `update` and into a new function `handleAction`. The simplest way might be to rename `update` then delete the parts that are not needed.

```js
function handleAction(action) {
  const mx = stage.player.x + action.x;
  const my = stage.player.y + action.y;

  if (stage.canMoveTo(mx, my)) {
    for (let occupant of stage.entitiesAt(mx, my)) {
      if (occupant.isBlocking()) {
        stage.player.bump(occupant);
        return;
      }
    }

    stage.moveEntityTo(player, mx, my);
    stage.refreshVisibility();
  }
}
```

The new `update` function which bounces control between players and monsters looks like this.

```js
function update() {
  if (action && playerTurn) {
    handleAction(action);
    action = null;
    playerTurn = false;
  }

  if (!playerTurn) {
    for (let entity of stage.entities) {
      if (entity !== stage.player) {
        entity.takeTurn();
      }
    }
    playerTurn = true;
  }
}
```

Run around the map and you’ll see the monsters taking their turn each time you move the player.

## Not standing still

The monsters can take turns but they can’t go anywhere. They’re standing still, waiting to be bumped into. Fortunately, there’s now enough structure in place that we’re ready to add movement and start to flesh out the monster AI a little bit, which is what Part 6 is all about.
