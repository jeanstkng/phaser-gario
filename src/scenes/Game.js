import { Scene } from "phaser";

export class Game extends Scene {
  constructor() {
    super("Game");
  }

  create() {
    this.add.image(0, 0, "grid").setOrigin(0);

    const cursors = this.input.keyboard.createCursorKeys();

    const controlConfig = {
      camera: this.cameras.main,
      left: cursors.left,
      right: cursors.right,
      up: cursors.up,
      down: cursors.down,
      acceleration: 0.02,
      drag: 0.0005,
      maxSpeed: 1.0,
    };

    this.controls = new Phaser.Cameras.Controls.SmoothedKeyControl(
      controlConfig
    );
    const cam = this.cameras.main;

    cam.setBounds(0, 0, 4096, 4096).setZoom(1);
  }

  update(time, delta) {
    this.controls.update(delta);
  }
}
