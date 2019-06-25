import TextGrid from "overprint/overprint/text-grid";
import Font from "overprint/overprint/font";
import Cell from "overprint/overprint/cell";

const canvas = document.querySelector("#game");

const width = 80;
const height = 50;

const player = {
  x: Math.floor(width / 2),
  y: Math.floor(height / 2)
}

const grid = new TextGrid(canvas, {
  width,
  height,
  font: Font("Menlo", false, 15)
});

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
    player.x = Math.min(width - 1, Math.max(0, player.x + action.x));
    player.y = Math.min(height - 1, Math.max(0, player.y + action.y));
    action = null;
  }
}

function render() {
  grid.clear();
  grid.writeCell(player.x, player.y, Cell("@"));
  grid.render();
}

function gameLoop() {
  update();
  render();
  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
