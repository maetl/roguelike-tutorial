import { drunkenWalk, meleeCharge } from "./behavior";

class Volition {
  takeTurn(stage) {
    if (stage.isVisible(this.owner.x, this.owner.y)) {
      meleeCharge(this.owner, stage.player, stage);
    } else {
      drunkenWalk(this.owner, stage);
    }
  }
}

export default Volition;
