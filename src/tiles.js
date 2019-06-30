class Tile {
  constructor(type, blocking, opaque) {
    this.type = type;
    this.blocking = blocking;
    this.opaque = opaque;
  }
}

Tile.open = (type) => new Tile(type, false, false);
Tile.blocking = (type) => new Tile(type, true, true);

const Tiles = {
  FLOOR: Tile.open("FLOOR"),
  WALL: Tile.blocking("WALL")
}

export default Tiles;
