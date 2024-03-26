class Cell {
  constructor(game, x, y) {
    this.name = "cell";
    this.circleRadius = 256;
    this.displaySize = 24;
    this.game = game;
    this.x = x;
    this.y = y;
    this.gameObject;
  }

  initialize(id) {
    this.gameObject = this.game.physics.add
      .image(this.x, this.y, "food")
      .setName(this.name)
      .setDisplaySize(this.displaySize, this.displaySize)
      .setCircle(this.circleRadius)
      .setCollideWorldBounds(true);

    this.gameObject.setDataEnabled();
    this.gameObject.setData("id", id);
  }
}

export default Cell;
