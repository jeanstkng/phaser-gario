import { v4 as uuidv4 } from "uuid";

class Globe {
  constructor(game, x, y) {
    this.userId = uuidv4();
    this.score = 1;
    this.initialSize = 36;
    this.zoomDisminution = 0.01;
    this.speed = 200;
    this.game = game;
    this.gameObject;
    this.actualPointerPos;

    if (x) {
      this.x = x;
    } else {
      this.x = Phaser.Math.RND.integerInRange(200, 3900);
    }
    if (y) {
      this.y = y;
    } else {
      this.y = Phaser.Math.RND.integerInRange(200, 3900);
    }
  }

  initialize() {
    this.gameObject = this.game.physics.add
      .image(this.x, this.y, "ball")
      .setDisplaySize(this.initialSize, this.initialSize)
      .setCircle(this.initialSize)
      .setName("globe")
      .setCollideWorldBounds(true)
      .setDepth(this.score);

    this.gameObject.body.onCollide = true;

    this.game.input.on("pointermove", (pointer) => {
      this.actualPointerPos = this.game.cam.getWorldPoint(pointer.x, pointer.y);
      this.game.physics.moveToObject(
        this.gameObject,
        this.actualPointerPos,
        this.speed
      );
    });
  }
}

export default Globe;
