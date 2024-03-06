import { Scene } from "phaser";

export class Game extends Scene {
  globe;
  cursor;
  cam;

  constructor() {
    super("Game");
  }

  create() {
    this.add.image(0, 0, "grid").setOrigin(0);

    this.globe = this.physics.add
      .image(this.cameras.main.centerX, this.cameras.main.centerY, "ball")
      .setCircle(45)
      .setCollideWorldBounds(true);

    this.cam = this.cameras.main;

    this.cam.setBounds(0, 0, 4096, 4096).setZoom(1);
    this.physics.world.setBounds(100, 100, 4000, 4000);

    this.cam.startFollow(this.globe);

    this.cursor = this.add.rectangle(0, 0, 20, 20);

    this.physics.add.collider(this.globe);

    this.input.on("pointermove", (pointer) => {
      let p = this.cam.getWorldPoint(pointer.x, pointer.y);

      this.physics.moveToObject(this.globe, p, 200);
    });
  }
}
