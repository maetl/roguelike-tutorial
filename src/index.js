import Entity from "./entity";
import Stage from "./stage";
import Screen from "./screen";

const canvas = document.querySelector("#game");

const width = 80;
const height = 50;
const player = new Entity(Math.floor(width / 2), Math.floor(height / 2), "player");
const stage = new Stage(width, height, player);

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

let playerTurn = true;

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

const screen = new Screen(canvas, width, height);

function gameLoop() {
  update();
  screen.render(stage);
  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
