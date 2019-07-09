const defaultFlags = {
  blocking: true
}

class Entity {
  constructor(x, y, name, flags) {
    this.x = x;
    this.y = y;
    this.name = name;
    this.flags = {...defaultFlags, ...flags};
    this.action = null;
  }

  isBlocking() {
    return this.flags.blocking;
  }

  bump(target) {
    console.log(`${this.name} kicks ${target.name} in the shins`);
  }

  takeTurn() {
    console.log(`${this.name} ponders the meaning of its existence`);
  }
}

export default Entity;
