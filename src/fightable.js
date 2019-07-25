import Random from "rung/src/random";

const rng = new Random(Math.random);

class Fightable {
  constructor(health, attack, defence) {
    this.maxHealth = this.health = health;
    this.attack = attack;
    this.defence = defence;
  }

  meleeAttack(target) {
    const attackRoll = this.attack + rng.integer(1, 100);
    const defensiveScore = target.defence + 50;

    if (attackRoll > defensiveScore) {
      const damage = target.dealDamage();
      console.log(`${this.owner.name} hit ${target.owner.name} for ${damage} damage`);
    } else {
      console.log(`${this.owner.name} was blocked by ${target.owner.name}`);
    }
  }

  dealDamage() {
    const damage = rng.integer(1, 6);
    this.health -= damage;
    return damage;
  }
}

export default Fightable;
