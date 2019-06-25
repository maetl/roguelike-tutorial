# Part 1: Drawing the ‘@’ symbol and moving it around

## Drawing to a canvas

[Overprint](https://www.npmjs.com/package/overprint) is a library for drawing text characters in grid cells to an [HTML canvas element](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API).

Install it into the project using the following command:

```
npm install overprint
```

To initialize the grid renderer, Overprint requires a canvas element to be passed in. To do this, we could use the `document.createElement` DOM API, but instead, we’ll create a canvas tag in our HTML file and pass it in to the grid renderer once the page has loaded.

Make the following changes to `src/index.html`:

```html
<body>
  <canvas id="game"></canvas>
  <script src="./index.js"></script>
</body>
```

In `src/index.js` get a reference to the canvas element using `getElementById` or `querySelector`:

```js
const canvas = document.querySelector("#game");
```

With a reference to this DOM element, we can construct a default `TextGrid` and render it to the screen:

```js
import TextGrid from "overprint/overprint/text-grid";

const canvas = document.querySelector("#game");

const grid = new TextGrid(canvas);

grid.render();
```

This should draw a big black grid canvas, but we need to do a little more than that to complete the first major step of getting the ‘@’ character on screen and moving.

## Setting dimensions and fonts

First, let’s customize the default grid dimensions and add a font. To do this, pass a config object as the second argument to the `TextGrid` constructor.

To get things started, I’m going with a 1.6 aspect ratio and using `Menlo` as the font with a 15px cell size. Note that the `Font` constructor needs to be imported from the `overprint` package before it can be used in the config.

```js
import Font from "overprint/overprint/font";
```

The config setup looks like this:

```js
const grid = new TextGrid(canvas, {
  width: 80,
  height: 50,
  font: Font("Menlo", false, 15)
});
```

## Drawing characters on the grid

To make sure everything is working, let’s render a static `@` symbol before we wire it up to input handling and movement.

First, import the `Cell` constructor from `overprint`.

```js
import Cell from "overprint/overprint/cell";
```

The coordinate origin for the grid (0,0) is at the top left corner. The X axis moves right in the postive direction and the Y axis moves down in the positive direction. So this case, the center of the grid is `40,25`. Use `writeCell` to draw a cell there.

```js
grid.writeCell(40, 25, Cell("@"));

grid.render();
```

Run this in the browser and you should see a white `@` symbol on screen. If you want to try a different color, pass a second argument to the `Cell`.

```js
grid.writeCell(40, 25, Cell("@", "#f90"));
```

Note the explicit order of steps here. First we construct a grid object, then we write cells to it, then we render to the live canvas in the browser.

This separation of writing and rendering is going to become important soon when we start responding to input and redrawing the canvas based on what has changed.

## Tracking player position

To start tracking movement, we need to store a reference to the player position so that we know where to draw it and can update it over time.

Before doing this, let’s pull the dimensions out of the config into separate variables so we don’t end up duplicating these numbers in too many places. In new-style JavaScript, `{ rows }` is a shorthand for `{ rows: rows }`, which only works if we have a variable with that exact name.

```js
const width = 40;
const height = 30;

const grid = new TextGrid(canvas, {
  width,
  height,
  font: Font("Menlo", false, 15)
});
```

To calculate the player starting point in the center of the grid, divide the grid dimensions by two (making sure to floor the result to handle odd numbered division).

```js
const player = {
  x: Math.floor(width / 2),
  y: Math.floor(height / 2)
}
```

Replace the hard-coded values with the player position.

```js
grid.writeCell(player.x, player.y, Cell("@"));
```

## Adding a game loop

At this point, we’re ready to add a basic game loop and start responding to input.

A traditional game loop runs continuously, accepting input, updating the game state and rendering. Turn based games might block waiting for player input or skip the update step until the next player turn is taken, but the principle is more or less the same.

Ignoring time step sequencing for simplicity, we’d generally be working with something like the following.

```c
while (gameRunning) {
  input();
  update();
  render();
}
```

This works for most imperative programming languages but it won’t work in JavaScript where our code is already running inside a rendering loop and input is recieved via asynchronous event handlers.

The solution here requires an inversion of control. Instead of our code explicitly triggering a render at each step, we give the browser a hook to our rendering code and ask it to trigger the hook on its next rendering step. Browsers try to render at roughly 60 frames per second, so—unless other things are blocking and frames are being skipped—the hook will be called at roughly 16ms intervals.

The browser hook for this is `requestAnimationFrame`. To set it up, we assign our game loop function to this property in order to render on the next available frame. To run continuously, we need to recursively reassign the function to chain it frame by frame.

```js
function gameLoop() {
  grid.render();
  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
```

We’re now drawing continuously to the canvas but we won’t see any changes until we start updating the state of the grid over time. Let’s do that now.

First, let’s modify the animation frame hook to correspond more closely to a traditional game loop. `render` will simply be a wrapper to handle redrawing the grid and `update` will encapsulate the bulk of our game logic that runs per-turn.

```js
function update() {
  // player movement will go here
}

function render() {
  grid.writeCell(player.x, player.y, Cell("@"));
  grid.render();
}

function gameLoop() {
  update();
  render();
  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
```

At this point, everything should look identical to how we first set it up. We can’t see it yet, but we’re now reading the player position and drawing it to the canvas on every frame.

## Generating actions from keyboard input

With all this in place, we’re ready to introduce keyboard event handling.

For simplicities sake, I’ll start with the arrow keys for movement. You might want to use WASD or the Vim keys instead.

```js
let action;

function input(key) {
  switch(key) {
    case "ArrowUp": action = { x: 0, y: -1 }; break;
    case "ArrowDown": action = { x: 0, y: 1 }; break;
    case "ArrowLeft": action = { x: -1, y: 0 }; break;
    case "ArrowRight": action = { x: 1, y: 0 }; break;
  }
}

document.addEventListener("keydown", (ev) => input(ev.key));

function update() {
  if (action) {
    player.x = player.x + action.x;
    player.y = player.y + action.y;
    action = null;
  }
}

function render() {
  grid.clear();
  grid.writeCell(player.x, player.y, Cell("@"));
  grid.render();
}
```

We now have movement up and running! Press the arrow keys and watch the `@` move around the screen.

It all hinges on the `action` var declared in the outer scope. When a `keydown` event is detected, the event listener dispatches to the `input` function which assigns a unit vector to `action` depending on the direction of movement selected.

On every frame, the `update` function is called. The first thing it does is check to see if `action` has a value. If not, the update is skipped on that frame and the code moves on to rendering. If action does have a value, we know it’s come directly from `input`, so on that basis we can use add the `action.x` and `action.y` properties to `player.x` and `player.y` to get the new player position. Once we consume the action we reset it to null so that it doesn’t end up being reused and creating a mess.

There’s one more small but important detail here. Before writing the `@` cell in `render`, we now call `grid.clear` to clear the grid to a blank slate. If you can’t figure out why from reading the code, comment out that line then move the `@` around. Each time we redraw in a new position, we need to clear the old position first, otherwise we’ll see a trail around the screen, rather than discrete movement from cell to cell.

## Keeping the player on the grid

So, is that everything?

Not quite. There is a glaring bug with the movement here. If you didn’t notice it in the code, try moving the `@` all the way to the edge of the grid and see what happens.

There are several different ways we can solve this, depending on how we want the movement to work and how the edges of our map are defined in our game.

The simplest and easiest way to handle this without adding additional logic and comparison operators is to use `Math.max` and `Math.min` to clamp the positions to within the boundaries of the map.

```js
player.x = Math.min(width - 1, Math.max(0, player.x + action.x));
player.y = Math.min(height - 1, Math.max(0, player.y + action.y));
```

An interesting alternative would be to create wraparound movement: if x or y is less than zero, then set it to the value of width. If x or y is greater than width, then set it to zero. When players move off one side of the grid they reappear on the other.

Or else we can just leave the overflowing movement as-is, and solve it later on using walkable and blocking tiles with dungeon maps set up in such a way that players are never able to leave the bounds of the map.

## The @ is moving!

Once all this is working and you can move the `@` around the screen, we can continue to Part 2 and start looking at the big picture of how to structure the game around entities placed on a map.
