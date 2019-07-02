# Part 3: Generating a dungeon

## In context

Interesting and distinctive dungeon generators are one of the things that defines a compelling roguelike experience and sets it apart from others.

Since this tutorial isn’t really focused on game design, we won’t go too deeply into the conceptual side of procedural generation and level design. Depending on what you want to get out of this process, you might want to start thinking about worldbuilding and the kind of exploration flow and challenges your game will provide, so you can experiment with generative methods that best support it.

We’ll start off by implementing a basic generator that operates on a grid of walled off tiles and digs out a set of rectangular rooms and connected passages.

## Filling in the space

Create a new file `src/dungeon.js` and add the following generator stub that returns a grid filled with wall tiles.

```js
import Tiles from "./tiles";

function generateDungeon(width, height) {
  const tiles = [];

  for (let y=0; y < height; y++) {
    tiles[y] = [];
    for (let x=0; x < width; x++) {
      tiles[y][x] = Tiles.WALL;
    }
  }

  return tiles
}

export {
  generateDungeon
}
```

We start with the map filled in by default so we can structure the generator around digging out moveable space.

Before we go any further, let’s render this out so we can get a visual feedback loop for iteratively testing and tweaking the generator.

In `stage.js`, delete the `initializeMap` function and replace it with `generateDungeon`, imported from `dungeon.js`.

```js
import { generateDungeon } from "./dungeon";

class Stage {
  constructor(width, height, player) {
    this.width = width;
    this.height = height;
    this.map = generateDungeon(width, height);
    this.player = player;
  }

  // ...
}
```

Test this out and make sure the entire grid is now covered in wall tiles. At this point, the player can no longer move! We’ll change that very soon, but first we need some additional support structures.

## Install a PRNG

By default, JavaScript’s `Math.random()` generates a value on the [half open interval](https://en.wikipedia.org/wiki/Interval_(mathematics)#Terminology) which is useful in many places but becomes quite clumsy to use when dealing with integers like the coordinates of our grid maps. What we want is to be able to pass the min and max numbers of an integer range to the random generator and have it return an integer in that range. There’s nothing like this in the JavaScript language, so we have to provide it in code.

If you want to keep dependencies to a minimum or set up your own libraries, you can skip this step and instead, add a utils module with your preferred random number helper functions. Otherwise, you can [scour the registry for a PRNG package](https://www.npmjs.com/search?q=random) that has an API style you like and install that.

For the remainder of the tutorial, we’ll be using [Rung](https://www.npmjs.com/package/rung).

Install it into the project using the following command.

```
npm install rung
```

Then import it into `dungeon.js`.

```js
import rung from "rung/src/rung";
```

## Putting up scaffolding

To simplify the process of digging out the rooms, it’s useful to have a representation of a rectangular shape.

Add the following `Rect` class to `dungeon.js` with the `x,y` arguments to the constructor representing the top/left corner and the `width,height` arguments representing the size of the edges extending towards the right and bottom.

```js
class Rect {
  constructor(x, y, width, height) {
    this.x1 = x;
    this.y1 = y;
    this.x2 = x + width;
    this.y2 = y + height;
  }
}
```

To fill areas of the map with these rectangles, it’s useful to be able to iterate through each grid cell covered by the rectangle. There are a number of different ways we could do this—from juggling range variables in nested inline loops, to implementing the [iterable protocol](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols#Iterator_examples). or using a generator function. My personal preference probably leans towards iterators and generators but what we’ll do here is add a `forEach` function to the `Rect` class that iterates through each point and triggers a callback, as it’s simple to understand and fast to implement.

```js
class Rect {
  // ...

  forEach(callback) {
    for (let y=this.y1+1; y < this.y2-1; y++) {
      for (let x=this.x1+1; x < this.x2-1; x++) {
        callback(x, y);
      }
    }
  }
}
```

Notice that we’re only iterating through the inner box and not including the points of the outer border here. This helps ensure that there are walls around the box when other boxes and passages are placed beside it.

To test that this is working as expected, we can introduce it in `generateDungeon` to dig out a 30x20 rectangle in the center of the map.

```js
function generateDungeon(width, height) {
  // ...

  const room = new Rect(width / 2 - 10, height / 2 - 10, 30, 20);

  room.forEach((x, y) => tiles[y][x] = Tiles.FLOOR);

  return tiles;
}
```

Because the rectangle is positioned from its top right corner, there’s a bit of manipulation required to calculate its starting point in relation to the center of the map. Note that the rectangle won’t be precisely centered if we’re working with even numbered dimensions, but that’s fine for now, since we’re just testing that it works.

## Digging out a dungeon

Now we can start to experiment with placing multiple multiple rooms of different sizes and connecting passages between them.

First, we’ll add a `configuration` argument to `generateDungeon` and merge it with a `defaultConfig` object to make it easier to configure the generator with a bundle of parameters.

```js
const defaultConfig = {
  maxRoomCount: 30,
  minRoomSize: 6,
  maxRoomSize: 12
}

function generateDungeon(width, height, configuration) {
  const config = { ...defaultConfig, ...configuration };

  // ...
}
```

Create an instance of the random number generator that will be unique to each run of the dungeon generator. Later on, we can extract this out to support seeding and make things easier to test, but it’s fine to make hide it inside the dungeon generator for now.

```js
function generateDungeon(width, height, configuration) {
  // ...

  const rng = rung();

  // ...
}
```

Modify the room placement code we created above with the following loop that generates a list of randomly sized rooms.

```js
function generateDungeon(width, height, configuration) {
  // ...

  const rooms = [];

  for (let r of Array(config.maxRoomCount).keys()) {
    let w = rng.integer(config.minRoomSize, config.maxRoomSize);
    let h = rng.integer(config.minRoomSize, config.maxRoomSize);
    let x = rng.integer(1, width - w - 1);
    let y = rng.integer(1, height - h - 1);

    rooms[r] = new Rect(x, y, w, h);
  }

  for (let room of rooms) {
    room.forEach((x, y) => tiles[y][x] = Tiles.FLOOR);
  }

  return tiles;
}
```

This should give us a bunch of overlapping boxes scattered across the map. Surprisingly, it doesn’t look all that bad, but there’s still a fair bit of work needed to turn it into a somewhat playable level.

## Skip overlapping rooms

What we’ll do here is check each new room to see if it intersects with the others and only add it to the map if it doesn’t overlap anything.

This is a decision that has aesthetic as well as gameplay and architectural implications. It moves us towards a more traditional roguelike layout with a set of isolated rooms connected by narrow passageways.

To check the intersection of two rectangles, we’ll start with a new method in the `Rect` class.

```js
class Rect {
  // ...

  intersects(rect) {
    return (
      this.x1 <= rect.x2 &&
      this.x2 >= rect.x1 &&
      this.y1 <= rect.y2 &&
      this.y2 >= rect.y1
    );
  }
}
```

Now we can modify `generateDungeon` to throw out any generated rooms that overlap. Instead of looping over the `rooms` array, we’ll use `Array.prototype.some` to test if any intersections match.

```js
function generateDungeon(width, height, configuration) {
  // ...

  for (let r of Array(config.maxRoomCount).keys()) {
    // ...

    const candidate = new Rect(x, y, w, h);

    if (!rooms.some(room => room.intersects(candidate))) {
      rooms.push(candidate);
    }
  }

  // ...
}
```

We should now see far fewer rooms, with each rectangle distributed around the map and not touching any others. You might want to play around with the config here to see which parameters look best.

## Connecting rooms with passages

It’s time to connect the rooms up. We’ll achieve this by ...

First, let’s add a method to the `Rect` class for calculating the center.

```js
class Rect {
  // ...

  center() {
    const x = Math.round((this.x1 + this.x2) / 2);
    const y = Math.round((this.y1 + this.y2) / 2);
    return { x, y }
  }
}
```

Next, add a couple of helper functions for digging out horizontal and vertical passages.

```js
function digHorizontalPassage(tiles, x1, x2, y) {
  const start = Math.min(x1, x2);
  const end = Math.max(x1, x2) + 1;
  let x = start;

  while (x < end) {
    tiles[y][x] = Tiles.FLOOR;
    x++;
  }
}

function digVerticalPassage(tiles, y1, y2, x) {
  const start = Math.min(y1, y2);
  const end = Math.max(y1, y2) + 1;
  let y = start;

  while (y < end) {
    tiles[y][x] = Tiles.FLOOR;
    y++;
  }
}
```

Now we’re ready to start digging the passageways. Create a placeholder variable `prevRoom` to use as a reference to the preceeding room when we select a new room. It will always be empty on the first iteration. Loop through the list of placed rooms, and after digging the floor tiles for the room, interleave the horizontal and vertical passage functions, aiming for the center of `prevRoom`.

You can also mix up the order of the passage generation using a boolean coin toss. This may have an impact on how passageways overlap and cross each other.

```js
function generateDungeon(width, height, configuration) {
  // ...

  let prevRoom = null;

  for (let room of rooms) {
    room.forEach((x, y) => tiles[y][x] = Tiles.FLOOR);

    if (prevRoom) {
      const prev = prevRoom.center();
      const curr = room.center();

      if (rng.boolean()) {
        digHorizontalPassage(tiles, prev.x, curr.x, curr.y);
        digVerticalPassage(tiles, prev.y, curr.y, prev.x);
      } else {
        digVerticalPassage(tiles, prev.y, curr.y, prev.x);
        digHorizontalPassage(tiles, prev.x, curr.x, curr.y);
      }
    }

    prevRoom = room;
  }

  return tiles;
}
```

This is currently being done in its own separate loop. It could also be incorporated into the initial range loop where the intersection check happens and the candidate rooms are assigned.

## Place the player entity

One last thing! We need to make sure the player entity gets placed on the map in a location that makes sense. Right now, we’re not even checking whether the player starts out on a walkable tile. Now’s a good time to fix this.

The way we’ll do it is by returning a more structured object from the dungeon generator, containing the list of rooms and our tile map alongside the player start position.

We could pick either the first or the last room in our list as a starting point. We might want to calculate this start point in the `Stage` eventually, but we’ll do it in `generateDungeon` for now and come back to this when we look at adding up and down stairs to each level.

We can choose either the first or last item in the rooms list as our starting point.

```js
function generateDungeon(width, height, configuration) {
  // ...

  const start = rooms[0].center();

  return {
    rooms,
    tiles,
    start
  }
}
```

In the places where we call `generateDungeon`, we need to take this new return value into account.

```js
class Stage {
  constructor(width, height, player) {
    this.width = width;
    this.height = height;
    const { tiles, start } = generateDungeon(width, height);
    this.map = tiles;
    this.player = player;
    this.player.x = start.x;
    this.player.y = start.y;
  }

  // ...
}
```

Now we should see the player pop up in the center of the first assigned room. We can move again!

## Wrapping up

This is a very simple and featureless dungeon generator. It provides enough to get started, but it’s probably the first thing you’re going to want to change when building a real game with its own unique locations, themes and structure of progression.

In Part 4, we’ll incorporate a field of view on the map, which will have an interesting impact on the appearance of the dungeon.
