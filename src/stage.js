import Tiles from "./tiles";
import Entity from "./entity";
import { generateDungeon } from "./dungeon";
import { createFOV } from "./fov";

class Stage {
  constructor(width, height, player) {
    this.width = width;
    this.height = height;
    const { tiles, rooms } = generateDungeon(width, height);
    this.map = tiles;
    this.initializeEntities(player, rooms);
    this.initializeVisibility();
  }

  canMoveTo(x, y) {
    return !this.map[y][x].blocking;
  }

  isUnoccupied(x, y) {
    return !this.entitiesMap[y][x].some(e => e.isBlocking())
  }

  entitiesAt(x, y) {
    return this.entitiesMap[y][x];
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

  initializeEntities(player, rooms) {
    this.entities = [];
    this.entitiesMap = Array(this.height)
      .fill(null)
      .map(() =>
        Array(this.width)
          .fill(null)
          .map(() => [])
      );

    const startAt = rooms[0].center();
    player.x = startAt.x;
    player.y = startAt.y;
    this.player = player;

    this.addEntity(player);

    for (let r=1; r<rooms.length; r++) {
      if (Math.random() > 0.6) continue;
      const spawnAt = rooms[r].center();
      this.addEntity(new Entity(spawnAt.x, spawnAt.y, "monster"));
    }
  }

  addEntity(entity) {
    this.entities.push(entity);
    this.entitiesMap[entity.y][entity.x].push(entity);
  }

  moveEntityTo(entity, x, y) {
    this.entitiesMap[entity.y][entity.x] = this.entitiesMap[entity.y][
      entity.x
    ].filter(e => e !== entity);
    entity.x = x;
    entity.y = y;
    this.entitiesMap[y][x].push(entity);
  }

  removeEntity(entity) {
    this.entitiesMap[entity.y][entity.x] = this.entitiesMap[entity.y][
      entity.x
    ].filter(e => e !== entity);
    this.entities = this.entities.filter(e => e !== entity);
  }
}

export default Stage;
