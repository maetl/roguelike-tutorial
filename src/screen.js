import TextGrid from "overprint/overprint/text-grid";
import Font from "overprint/overprint/font";
import Cell from "overprint/overprint/cell";

const Glyphs = {
  WALL: Cell("#", "#aaa"),
  FLOOR: Cell(".", "#888"),
  PLAYER: Cell("@")
}

class Screen {
  constructor(canvas, width, height) {
    this.grid = new TextGrid(canvas, {
      width,
      height,
      font: Font("Menlo", false, 15)
    });
  }

  renderMap(stage) {
    for (let y=0; y < stage.height; y++) {
      for (let x=0; x < stage.width; x++) {
        this.grid.writeCell(x, y, Glyphs[stage.map[y][x].type]);
      }
    }
  }

  renderPlayer(player) {
    this.grid.writeCell(player.x, player.y, Glyphs.PLAYER);
  }

  render(stage) {
    this.renderMap(stage);
    this.renderPlayer(stage.player);
    this.grid.render();
  }
}

export default Screen;
