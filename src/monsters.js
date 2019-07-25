import Entity from "./entity";
import Fightable from "./fightable";
import Volition from "./volition";

function spawnMonster(x, y) {
  const components = {
    fightable: new Fightable(20, 0, 0),
    volition: new Volition()
  }
  return new Entity(x, y, "monster", {}, components);
}

export {
  spawnMonster
}
