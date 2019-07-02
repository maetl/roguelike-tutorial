import rung from "rung/src/rung";
import Tiles from "./tiles";

class Rect {
  constructor(x, y, width, height) {
    this.x1 = x;
    this.y1 = y;
    this.x2 = x + width;
    this.y2 = y + height;
  }

  forEach(callback) {
    for (let y=this.y1+1; y < this.y2-1; y++) {
      for (let x=this.x1+1; x < this.x2-1; x++) {
        callback(x, y);
      }
    }
  }

  intersects(rect) {
    return (
      this.x1 <= rect.x2 &&
      this.x2 >= rect.x1 &&
      this.y1 <= rect.y2 &&
      this.y2 >= rect.y1
    );
  }

  center() {
    const x = Math.round((this.x1 + this.x2) / 2);
    const y = Math.round((this.y1 + this.y2) / 2);
    return { x, y }
  }
}

function digHorizontalPassage(tiles, x1, x2, y) {
  const start = Math.min(x1, x2);
  const end = Math.max(x1, x2) + 1;
  let x = start;

  while (x < end) {
    tiles[y][x] = Tiles.FLOOR;
    x++;
  }
}

function digVerticalPassage(tiles, y1, y2, x) {
  const start = Math.min(y1, y2);
  const end = Math.max(y1, y2) + 1;
  let y = start;

  while (y < end) {
    tiles[y][x] = Tiles.FLOOR;
    y++;
  }
}

const defaultConfig = {
  maxRoomCount: 30,
  minRoomSize: 6,
  maxRoomSize: 16
}

function generateDungeon(width, height, configuration) {
  const config = { ...defaultConfig, ...configuration };
  const tiles = [];

  for (let y=0; y < height; y++) {
    tiles[y] = [];
    for (let x=0; x < width; x++) {
      tiles[y][x] = Tiles.WALL;
    }
  }

  const rng = rung();
  const rooms = [];

  for (let r of Array(config.maxRoomCount).keys()) {
    let w = rng.integer(config.minRoomSize, config.maxRoomSize);
    let h = rng.integer(config.minRoomSize, config.maxRoomSize);
    let x = rng.integer(1, width - w - 1);
    let y = rng.integer(1, height - h - 1);

    const candidate = new Rect(x, y, w, h);

    if (!rooms.some(room => room.intersects(candidate))) {
      rooms.push(candidate);
    }
  }

  let prevRoom = null;

  for (let room of rooms) {
    room.forEach((x, y) => tiles[y][x] = Tiles.FLOOR);

    if (prevRoom) {
      const prev = prevRoom.center();
      const curr = room.center();

      if (rng.boolean()) {
        digHorizontalPassage(tiles, prev.x, curr.x, curr.y);
        digVerticalPassage(tiles, prev.y, curr.y, prev.x);
      } else {
        digVerticalPassage(tiles, prev.y, curr.y, curr.x);
        digHorizontalPassage(tiles, prev.x, curr.x, prev.y);
      }
    }

    prevRoom = room;
  }

  const start = rooms[0].center();

  return {
    rooms,
    tiles,
    start
  }
}

export {
  generateDungeon
}
