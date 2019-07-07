import Tiles from "./tiles";
import { generateDungeon } from "./dungeon";
import { createFOV } from "./fov";

class Stage {
  constructor(width, height, player) {
    this.width = width;
    this.height = height;
    const { tiles, start } = generateDungeon(width, height);
    this.map = tiles;
    this.player = player;
    this.player.x = start.x;
    this.player.y = start.y;
    this.initializeVisibility();
  }

  canMoveTo(x, y) {
    return !this.map[y][x].blocking;
  }

  isOpaque(x, y) {
    return this.map[y][x].opaque;
  }

  isVisible(x, y) {
    return this.visible.has(`${x},${y}`);
  }

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
    this.refreshFOV = createFOV(
      this.width,
      this.height,
      (x, y) => this.revealTile(x, y),
      (x, y) => this.isOpaque(x, y)
    );
    this.refreshVisibility();
  }

  refreshVisibility() {
    this.visible.clear();
    this.refreshFOV(this.player.x, this.player.y, 16);
  }
}

export default Stage;
