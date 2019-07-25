const defaultFlags = {
  blocking: true
}

class Entity {
  constructor(x, y, name, flags, components) {
    this.x = x;
    this.y = y;
    this.name = name;
    this.flags = {...defaultFlags, ...flags};
    this.action = null;

    for (let attribute of Object.keys(components)) {
      this[attribute] = components[attribute];
      this[attribute].owner = this;
    }
  }

  isBlocking() {
    return this.flags.blocking;
  }

  isFightable() {
    return this.hasOwnProperty("fightable");
  }

  bump(target) {
    if (target.isFightable()) {
      this.fightable.meleeAttack(target.fightable);
    }
  }

  hasVolition() {
    return this.hasOwnProperty("volition");
  }

  takeTurn(stage) {
    this.volition.takeTurn(stage);
  }
}

export default Entity;
