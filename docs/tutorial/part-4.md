# Part 4: Field of View

## Revealing the map through exploration

Are we really exploring the dungeon if the entire map is visible from the start? Restricting the visible parts of the map to what the player can see is an extremely common pattern in all videogames, but roguelikes in particular make this a central part of their design.

Unlike hunger clocks, which drive exploration by penalising players for staying in one place, revealing the map through moving around it rewards players for exploration and risk-taking, adding excitement and tension. What’s down that passage? What’s on the other side of that wall? It’s much more fun if you have to go there to find out.

## Shadow casting

Shadow casting is a popular method of calculating FOV that builds up a list of hidden tiles by scanning outwards from a single point on a 2D grid and using line slopes to calculate whether or not each tile casts a shadow onto the rows of tiles behind it. To incorporate this into our game, we will need to hook into this algorithm and store some state that marks any tile not hidden as visible.

This tutorial won’t go into detail about how this all works, but if you’re really interested, the implementation here is based on a combination of ideas and code from [SquidLib](https://github.com/SquidPony/SquidLib) and [Hauberk](https://github.com/munificent/hauberk), [as discussed in detail here](http://journal.stuffwithstuff.com/2015/09/07/what-the-hero-sees/). For a more comprehensive analysis, this exploration of [different roguelike vision algorithms](http://www.adammil.net/blog/v125_roguelike_vision_algorithms.html) provides a lot of useful detail.

Create a new file `src/fov.js` and add the following code. I’ve set it up so it’s self-contained with no dependencies on the code in this tutorial or calls to external libraries. You can use this as a utility to get started quickly or as a template for writing something better.

```js
const octantTransforms = [
  { xx: 1, xy: 0, yx: 0, yy: 1 },
  { xx: 1, xy: 0, yx: 0, yy: -1 },
  { xx: -1, xy: 0, yx: 0, yy: 1 },
  { xx: -1, xy: 0, yx: 0, yy: -1 },
  { xx: 0, xy: 1, yx: 1, yy: 0 },
  { xx: 0, xy: 1, yx: -1, yy: 0 },
  { xx: 0, xy: -1, yx: 1, yy: 0 },
  { xx: 0, xy: -1, yx: -1, yy: 0 }
];

function createFOV(width, height, reveal, isOpaque) {
  function castShadows(originX, originY, row, start, end, transform, radius) {
    let newStart = 0;
    if (start < end) return;

    let blocked = false;

    for (let distance = row; distance < radius && !blocked; distance++) {
      let deltaY = -distance;
      for (let deltaX = -distance; deltaX <= 0; deltaX++) {
        let currentX = originX + deltaX * transform.xx + deltaY * transform.xy;
        let currentY = originY + deltaX * transform.yx + deltaY * transform.yy;

        let leftSlope = (deltaX - 0.5) / (deltaY + 0.5);
        let rightSlope = (deltaX + 0.5) / (deltaY - 0.5);

        if (
          !(
            currentX >= 0 &&
            currentY >= 0 &&
            currentX < width &&
            currentY < height
          ) ||
          start < rightSlope
        ) {
          continue;
        } else if (end > leftSlope) {
          break;
        }

        if (Math.sqrt(deltaX * deltaX + deltaY * deltaY) <= radius) {
          reveal(currentX, currentY);
        }

        if (blocked) {
          if (isOpaque(currentX, currentY)) {
            newStart = rightSlope;
            continue;
          } else {
            blocked = false;
            start = newStart;
          }
        } else {
          if (isOpaque(currentX, currentY) && distance < radius) {
            blocked = true;
            castShadows(
              originX,
              originY,
              distance + 1,
              start,
              leftSlope,
              transform,
              radius
            );
            newStart = rightSlope;
          }
        }
      }
    }
  }

  return function refresh(originX, originY, radius) {
    reveal(originX, originY);
    for (let octant of octantTransforms) {
      castShadows(originX, originY, 1, 1, 0, octant, radius);
    }
  }
}

export {
  createFOV
}
```

There are two parts to this API. First, import the `createFOV` function and use it to set up the FOV by passing the width and height of the map or viewport and then two callback functions that plug in to your game state and map: `reveal` and `isOpaque`.

Calling `createFOV` will return a `refresh` function which you can call repeatedly to generate the FOV area. Pass it the `x` and `y` coordinates and a `radius` value and it will repeatedly call `reveal` with all the coordinates that should be visible from that point.

## Flagging which areas of the map are see-through

To see this in action, we can incorporate field of view in `stage.js`. First, we need to define a function to reveal map tiles that are flagged visible and a function to test their visibility. Since we already have an `opaque` property associated with each tile, we can wrap this with a predicate method.

```js
class Stage {
  // ...

  isOpaque(x, y) {
    return this.map[y][x].opaque;
  }

  // ...
}
```

## Defining the visible set of tiles

Next, we need to define the visible set of tiles that represents the FOV radius at any given location and point in time. To keep the stage in a valid state, this needs to be run as part of the constructor. Rather than add additional detail there, we’ll wrap it in its own initialization method.

```js
class Stage {
  constructor() {
    // ...
    this.initializeVisibility();
  }

  isVisible(x, y) {
    return this.visible.has(`${x},${y}`);
  }

  initializeVisibility() {
    this.visible = new Set();
  }

  // ...
}
```

Here, we use a `Set` data structure and use it to handle the `isVisible` check.

## Revealing visible tiles

We also need a method of adding tiles that are revealed as visible during the FOV computation step.

```js
class Stage {
  // ...

  revealTile(x, y) {
    this.visible.add(`${x},${y}`);
  }

  // ...
}
```

With this in place, we’re ready to incorporate the FOV algorithm itself. Expand `initializeVisibility` to create the FOV function, passing in the `reveal` and `isOpaque` callbacks that operate on the `visible` set.

```js
// ...
import { createFOV } from "./fov";

class Stage {
  // ...

  initializeVisibility() {
    this.visible = new Set();
    this.refreshFOV = createFOV(
      this.width,
      this.height,
      (x, y) => this.revealTile(x, y),
      (x, y) => this.isOpaque(x, y)
    );
  }

  // ...
}
```

## Refreshing the visible radius

Finally, we need a hook into the stage for actually refreshing the FOV visibility during gameplay. To do this, we clear the set, then recompute the FOV. Note that `refreshVisibility` needs to be called immediately after constructing the FOV. Otherwise, the player will start in total darkness (this is something you could experiment with if you want to introduce equippable light sources).

Here, we’re defining a light radius of `16` tiles. You might want to play around with this make things more or less claustrophobic (again, this is also something you could experiment with if you want equipment or effects to expand and contract the FOV as part of the gameplay).

```js
class Stage {
  // ...

  initializeVisibility() {
    // ...
    this.refreshVisibility();
  }

  refreshVisibility() {
    this.visible.clear();
    this.refreshFOV(this.player.x, this.player.y, 16);
  }
}
```

## Rendering it to the screen

Now we can see how it looks when we move around the dungeon. First, let’s update the tile representation in `screen.js` to include an empty out-of-range tile. This will define a null space around the visible dungeon tiles. It could also be handled with some canvas background fill trickery, but for now, it’s easiest to treat all rendering at the same scale of tile units.

```js
// ...
const Glyphs = {
  EMPTY: Cell(" "),
  WALL: Cell("#", "#aaa"),
  FLOOR: Cell(".", "#888"),
  PLAYER: Cell("@")
}
```

Now to render this change. Modify the `renderMap` function to

```js
class Screen {
  // ...

  renderMap(stage) {
    for (let y=0; y < stage.height; y++) {
      for (let x=0; x < stage.width; x++) {
        let tileType = Glyphs.EMPTY;
        if (stage.isVisible(x, y)) {
          tileType = Glyphs[stage.map[y][x].type];
        }
        this.grid.writeCell(x, y, tileType);
      }
    }
  }

  // ...
}
```

This should reduce the rendered map area to the FOV radius around the player position.

## Refreshing when the player moves

To update it when the player position changes, add the call to `refreshVisibility` immediately after the code that handles the movement. This is currently in `index.js` (though not for too much longer).

```js
function update() {
  if (action) {
    // ...

    if (stage.canMoveTo(mx, my)) {
      stage.player.x = Math.min(width - 1, Math.max(0, mx));
      stage.player.y = Math.min(height - 1, Math.max(0, my));
      stage.refreshVisibility();
    }

    // ...
  }
}
```

And now we have a complete FOV implementation in place.

## Remembering which tiles have been seen

If you move around the map now, you’ll notice there’s something quite important missing. The map *only* shows the currently computed FOV. Any previous areas visited are completely invisible if they’re out of sight.

What you do here is going to depend a lot on the particular way you want to handle exploration and map visibility and its intersection with other game mechanics. A very simple improvement here is to track the larger set of tiles that have been seen alongside the tiles that are currently visible.

To incorporate this into the game state, make the following changes to `stage.js`.

```js
class Stage {
  // ...

  isSeen(x, y) {
    return this.seen.has(`${x},${y}`);
  }

  revealTile(x, y) {
    const id = `${x},${y}`;
    this.visible.add(id);
    this.seen.add(id);
  }

  initializeVisibility() {
    this.visible = new Set();
    this.seen = new Set();
    // ...
  }

  //...
}
```

Finally, change `screen.js` to work with this information. We need a slightly more detailed color scheme for the map now that we’re distinguishing between lit/visible tiles and remembered/seen tiles.

```js
const Glyphs = {
  EMPTY: Cell(" "),
  PLAYER: Cell("@"),
  LIT: {
    WALL: Cell("#", "#aaa"),
    FLOOR: Cell(".", "#888")
  },
  UNLIT: {
    WALL: Cell("#", "#555"),
    FLOOR: Cell(".", "#333")
  }
}
```

To get all this visible on the screen, incorporate these new tiles and the `isSeen` check into the map rendering step.

```js
class Screen {
  // ...

  renderMap(stage) {
    for (let y=0; y < stage.height; y++) {
      for (let x=0; x < stage.width; x++) {
        let tileType = Glyphs.EMPTY;
        if (stage.isVisible(x, y)) {
          tileType = Glyphs.LIT[stage.map[y][x].type];
        } else if (stage.isSeen(x, y)) {
          tileType = Glyphs.UNLIT[stage.map[y][x].type];
        }
        this.grid.writeCell(x, y, tileType);
      }
    }
  }

  // ...
}
```

Test it out. Make sure it all works!

## What next?

In the summary for Part 2, we noted there were some loose edges with the `input` and `update` routines still not extracted out and the game loop not recognising any other kind of action aside from player movement.

So the next step is obvious: we’re going to add entities. And importantly, we’ll start working on making the game interactions turn-based.
