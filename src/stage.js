import Tiles from "./tiles";
import { generateDungeon } from "./dungeon";

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

  canMoveTo(x, y) {
    return !this.map[y][x].blocking;
  }
}

export default Stage;
