import { v4 as uuidv4 } from "uuid";

class Globe {
  constructor(game, x, y, id, isMainPlayer = true) {
    this.userId = id ?? uuidv4();
    this.score = 1;
    this.initialSize = 36;
    this.zoomDisminution = 0.01;
    this.speed = 200;
    this.timeElapsed = 0;
    this.timeOut = 50;
    this.canSendMovement = false;
    this.game = game;
    this.client = game.mainClient;
    this.gameObject;
    this.actualPointerPos;
    this.isMainPlayer = isMainPlayer;

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

    this.gameObject.body.onOverlap = true;

    if (this.isMainPlayer) {
      this.cam = this.game.cameras.main;

      this.cam.setBounds(0, 0, 4096, 4096).setZoom(2);

      this.cam.startFollow(this.gameObject);

      this.game.input.on("pointermove", (pointer) => {
        this.actualPointerPos = this.cam.getWorldPoint(pointer.x, pointer.y);
        this.game.physics.moveToObject(
          this.gameObject,
          this.actualPointerPos,
          this.speed
        );
      });

      this.game.physics.world.on(
        "overlap",
        async (gameObject1, gameObject2, _body1, _body2) => {
          switch (gameObject2.name) {
            case "cell":
              const cellId = gameObject2.getData("id");
              gameObject2.destroy();

              this.game.cells = this.game.cells.filter(
                (val) => val.id !== cellId
              );

              this.score += 0.05;

              this.gameObject.setDisplaySize(
                this.initialSize * this.score,
                this.initialSize * this.score
              );
              this.gameObject.setCircle(this.initialSize * this.score);

              if (this.cam.zoom > 1) {
                this.speed -= 0.025;
                this.cam.setZoom(this.cam.zoom - this.zoomDisminution);
              }

             await this.client
                .from("cells")
                .update({
                  isEaten: true,
                })
                .match({
                  id: cellId,
                });
              break;

            case "globe":
              if (gameObject1.depth > gameObject2.depth) {
                console.log("El diablaso");
              }

              break;

            default:
              break;
          }
        }
      );
    }
  }

  async update(isConnected, delta) {
    if (this.timeElapsed >= this.timeOut) {
      this.timeElapsed = 0;
      this.canSendMovement = true;
    } else {
      this.timeElapsed += delta;
      this.canSendMovement = false;
    }

    if (isConnected && this.userId && this.canSendMovement) {
      await this.client
        .from("players")
        .update({
          x: this.gameObject.x,
          y: this.gameObject.y,
          score: this.score,
        })
        .match({
          id: this.userId,
        });
    }
  }
}

export default Globe;
