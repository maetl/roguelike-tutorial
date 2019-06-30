# Part 2: The render functions, the generic Entity, and the game stage

## Organizing the codebase

Now that we’ve set up a game loop with player movement, it’s tempting to start stuffing all our desired features into this basic foundation. Doing this would make sense as a sandbox to prototype standalone game mechanics and generative methods. But if we want a robust foundation for a larger game we can work on iteratively over a longer period of time, we need to add some structure before too much code accumulates.

To introduce this structure and help us stick to it as the game gets larger, we’ll start by splitting the monolithic `index.js` file into separate parts before it grows too much larger.

If we were building a prototype sandbox, it might be simplest to keep everything in `index.js` and not get too carried away with structure. What motivates us to break things apart here is that we want to build a fully-featured game with pluggable content and behaviour that is easy to add to over time.

Looking at the shape of `index.js` and our game loop right now, we can already see the broad pattern of how the game will be structured and this can inform the high level outline of our file organization.

```
input → update → render
```

As things expand, we may want to introduce a higher level grouping of concepts at more of a namespace level, perhaps separating `engine`, `world` and `interface`. For now we’ll start with modules in a single folder representing the key objects and sets of functions, and stick with this pattern until it becomes unwieldy.

The `index.js` file will still function as our top-level entry point (kind of like the `main` function in other languages), but we’ll start moving towards importing everything we need from other files.

## Object-oriented JavaScript

This is also a good time to think about JavaScript coding conventions and make a decision whether to lean towards an object-oriented or functional style.

For many languages where classes are a primary building block, this question isn’t necessary, as there’s a clearly prescribed way to do things. While JavaScript now incorporates `class` and `extends` keywords, these [work in a subtly different way](http://raganwald.com/2015/05/11/javascript-classes.html) from languages with similar syntax (like C++, C#, Java, Kotlin, Dart, Python or Ruby).

This might be controversial or just common sense (hopefully the latter), but I’m going to assert here that the decision you make on whether or not to use an object-oriented style is actually less important than making the decision and sticking to it consistently in the codebase.

*It‘s perfectly fine to ignore the chorus of thought leaders loudly insisting that JavaScript OO is broken and wrong and that classes should never be used. Don’t let them make you feel bad or question your knowledge. Most of the time, their behaviour is actually motivated by selling ebooks and courses. Plenty of successful projects [have used either style](https://www.innoq.com/en/blog/fp-vs-oo/). You should go with whatever method suits your project best and what you feel most comfortable with.*

For the remainder of the tutorial, we will follow a mixed (‘multi-paradigm’) style, implementing objects central to the game engine as prototypal classes containing behaviour and data, but in some places where it makes sense to do things in a functional way, we may end up implementing the behaviour as stateless functions operating on data.

If you dislike JavaScript classes and use of the `this` keyword, feel free to come up with ways of rewriting the whole thing in a more functional style. There’s lots of interesting possibilities here.

## Extracting the render functions

The rendering layer is the first part of the game that we’ll split out. It’s useful to start with rendering because it’s currently the part of the code that has the most complex dependencies, and none of this detail needs to be shared across the rest of the codebase, so it makes sense to move it into a separate module.

Make a new file `src/screen.js` and move all the existing grid rendering code into a new class which encapsulates the grid object and provides a `render` method to update the display of the grid.

```js
import TextGrid from "overprint/overprint/text-grid";
import Font from "overprint/overprint/font";
import Cell from "overprint/overprint/cell";

class Screen {
  constructor(canvas, width, height) {
    this.grid = new TextGrid(canvas, {
      width,
      height,
      font: Font("Menlo", false, 15)
    });
  }

  render(player) {
    this.grid.clear();
    this.grid.writeCell(player.x, player.y, Cell("@"));
    this.grid.render();
  }
}

export default Screen;
```

Aside from the grid instance becoming an attribute of the object, the only difference from the original `render` function is that the `player` state is now passed in as an argument, rather than picked up from the surrounding scope.

Import `Screen` into `index.js` and change `gameLoop` to reference it.

```js
import Screen from "./screen";

// ...

const screen = new Screen(canvas, width, height);

function gameLoop() {
  update();
  screen.render(player);
  requestAnimationFrame(gameLoop);
}
```

## Introducing entities

We already know that there will be more than one entity in our game and each will share the same behaviour of having an `x,y` position and being able to move.

The first piece of game state we introduced was the player object, so we’ll start there.

```js
const player = {
  x: Math.floor(width / 2),
  y: Math.floor(height / 2)
}
```

We can think of the player as simply a special case of these entities where movement is controlled via keyboard input rather than automated via AI and pathfinding. Aside from that, we want to reuse as much code as we can for movement and other actions.

If we take an object-oriented approach, we can start with a class where the movement methods and position data are contained side-by side in the same object.

Create a new file `src/entity.js` and put the following code into it.

```js
class Entity {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }
}

export default Entity;
```

Now use this to replace the `player` object in `index.js` and update the movement behaviour to support it.

```js
import Entity from "./entity";

// ...

const player = new Entity(
  Math.floor(width / 2),
  Math.floor(height / 2)
);
```

For now, the movement stays as-is, so this doesn’t do much yet—it’s just a container for holding an `x,y` position. It will become more useful as we introduce the stage and add more entities than just the player.

## Floor and wall tiles

The core gameplay takes place on a 2D dungeon map. We can represent the the dungeon interior as a list of tiles, with each tile in a position defining whether or not entities can walk on there and whether or not they can see through it.

First, let’s get a basic representation of tiles that can block movement and visibility or allow it. Add a new file `src/tiles.js` and set up the following to construct `FLOOR` and `WALL` tiles.

```js
class Tile {
  constructor(type, blocking, opaque) {
    this.type = type;
    this.blocking = blocking;
    this.opaque = opaque;
  }
}

Tile.open = (type) => new Tile(type, false, false);
Tile.blocking = (type) => new Tile(type, true, true);

const Tiles = {
  FLOOR: Tile.open("FLOOR"),
  WALL: Tile.blocking("WALL")
}

export default Tiles;
```

## The game stage

We also need a method of managing the entities on the map. The player will be constantly moving about. Monsters will come and go. Items will be picked up and dropped. We may also want to know whether the player has crossed a certain tile, completed a quest objective, or reached a door to another level in the dungeon.

We’ll refer to the combined representation of the map and all the things that are connected to it as the `Stage`. We’ll do our stage management through an object that provides an encapsulation of this state and methods that simplify working with it.

Add a new file at `src/stage.js` and introduce the following wrapper class.

```js
import Tiles from "./tiles";

class Stage {
  constructor(width, height, player) {
    this.width = width;
    this.height = height;
    this.map = this.initializeMap();
    this.player = player;
  }

  initializeMap() {
    const tiles = [];

    for (let y=0; y < this.height; y++) {
      tiles[y] = [];
      for (let x=0; x < this.width; x++) {
        tiles[y][x] = Tiles.FLOOR;
      }
    }

    tiles[30][22] = Tiles.WALL;
    tiles[31][22] = Tiles.WALL;
    tiles[32][22] = Tiles.WALL;

    return tiles;
  }
}

export default Stage;
```

All we’ve done so far here is pass in the width and the height of the map and the player, then initialized a 2D array of tiles with a bit of throwaway code to define a tiny wall in the middle of the screen.

Let’s render this quickly, so that we can start getting it to do more interesting stuff. Create an instance of the stage in `index.js`, then pass it in to `screen.render()`.

```js
import Stage from "./stage";

// ...

const width = 80;
const height = 50;
const player = new Entity(Math.floor(width / 2), Math.floor(height / 2));
const stage = new Stage(width, height, player);

// ...

function gameLoop() {
  update();
  screen.render(stage);
  requestAnimationFrame(gameLoop);
}
```

Then in `screen.js`, add a set of text glyphs to represent each one of the tiles we’re using.

```js
const Glyphs = {
  WALL: Cell("#", "#aaa"),
  FLOOR: Cell(".", "#888"),
  PLAYER: Cell("@")
}
```

Then modify the `render` function of `Screen` to accept `stage` as an argument and delegate to two new functions, `renderMap` and `renderPlayer`.

```js
class Screen {
  // ...

  renderMap(stage) {
    for (let y=0; y < stage.height; y++) {
      for (let x=0; x < stage.width; x++) {
        this.grid.writeCell(x, y, Glyphs[stage.map[y][x].type]);
      }
    }
  }

  renderPlayer(player) {
    this.grid.writeCell(player.x, player.y, Glyphs.PLAYER);
  }

  render(stage) {
    this.renderMap(stage);
    this.renderPlayer(stage.player);
    this.grid.render();
  }
}
```

Notice the big change? There’s no more `clear` method. By overwriting every map cell on each frame, we’re doing something vaguely akin to [immediate mode rendering](https://en.wikipedia.org/wiki/Immediate_mode_(computer_graphics)), meaning that we don’t have to worry about previous entity positions being retained. We simply draw the map in its entirety before we draw the entities in their current position.

## Preventing movement through walls

Finally, we’ll add an extra check to the movement code to prevent the player from moving across tiles that are blocked.

First, add `canMoveTo` to `stage.js` with a boolean test of the given tile property.

```js
class Stage {
  // ...

  canMoveTo(x, y) {
    return !this.map[y][x].blocking;
  }

  // ...
}
```

Next, check this method from `update` in `index.js` when the player attempts to move.

```js
function update() {
  if (action) {
    const mx = stage.player.x + action.x;
    const my = stage.player.y + action.y;

    if (stage.canMoveTo(mx, my)) {
      stage.player.x = Math.min(width - 1, Math.max(0, mx));
      stage.player.y = Math.min(height - 1, Math.max(0, my));
    }

    action = null;
  }
}
```

Now you can load the map and try to move through the walls. If everything works as expected, you’ll bump into the wall tiles and get stuck.

## Loose edges

That was a lot to get through! There are still some loose edges and behaviour that isn’t well organized, particularly the `input` and `update` methods which are still passing data around using the module scoped `action` variable. We’ll need to make big changes here in order to introduce AI-driven entities and multiple actions into the game loop.

But we’re in a good position for now. Even if it doesn’t seem like much, we’ve added enough structure to the codebase to support procedurally generating dungeon levels, which we’ll move onto in Part 3.
