import { createPathfinder } from "./pathfinder";
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

function meleeCharge(entity, target, stage) {
  const adjacentNodes = (x, y) => stage.adjacentPoints(x, y);
  const costHeuristic = (from, to) => (
    Math.abs(from.x - to.x) + Math.abs(from.y - to.y) * 1.01
  );
  const traversalCost = (x, y) => stage.movementCost(x, y);
  const isTraversable = (x, y) => stage.canMoveTo(x, y);

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

export {
  drunkenWalk,
  meleeCharge
}
