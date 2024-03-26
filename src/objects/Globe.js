import { v4 as uuidv4 } from "uuid";

class Globe {
  constructor(game, x, y, id, isMainPlayer = true) {
    this.name = "globe";
    this.userId = id ?? uuidv4();
    this.score = 1;
    this.initialSize = 36;
    this.initialCircle = 130;
    this.zoomDisminution = 0.015;
    this.originalScale = 0;
    this.speed = 200;
    this.timeElapsed = 0;
    this.timeOut = 50;
    this.canSendMovement = false;
    this.game = game;
    this.client = game.mainClient;
    this.room = game.channel;
    this.isMainPlayer = isMainPlayer;
    this.gameObject;
    this.actualPointerPos;

    this.x = x ? x : Phaser.Math.RND.integerInRange(200, 3900);

    this.y = y ? y : Phaser.Math.RND.integerInRange(200, 3900);
  }

  initialize() {
    this.gameObject = this.game.physics.add
      .image(this.x, this.y, "ball")
      .setDisplaySize(this.initialSize, this.initialSize)
      .setCircle(this.initialCircle)
      .setName(this.name)
      .setCollideWorldBounds(true);

    this.originalScale = this.gameObject.scale;
    this.score = this.originalScale;

    this.gameObject.setDepth(this.score);

    this.gameObject.setDataEnabled();
    this.gameObject.setData("id", this.userId);

    this.gameObject.body.onOverlap = true;

    if (!this.isMainPlayer) return;

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

            this.gameObject.setScale(this.score, this.score);

            if (this.cam.zoom > 0.25)
              this.cam.setZoom(this.cam.zoom - this.zoomDisminution);

            if (this.speed > 25) this.speed -= 0.5;

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
            if (gameObject2.depth > gameObject1.depth) {
              const overlappedObjId = gameObject1.getData("id");
              if (overlappedObjId === this.userId) {
                this.gameObject.alpha = 0;
                this.speed = 200;
                this.score = this.originalScale;

                this.gameObject.setScale(
                  this.originalScale,
                  this.originalScale
                );

                this.cam.setZoom(2);
                this.gameObject.x = Phaser.Math.RND.integerInRange(200, 3900);
                this.gameObject.y = Phaser.Math.RND.integerInRange(200, 3900);

                this.gameObject.alpha = 1;

                await this.client
                  .from("players")
                  .update({
                    x: this.gameObject.x,
                    y: this.gameObject.y,
                    score: this.score,
                    speed: this.speed,
                  })
                  .match({
                    id: this.userId,
                  });
                this.room.send({
                  type: "broadcast",
                  event: "overlap",
                  payload: {
                    winner: gameObject2.getData("id"),
                    loser: overlappedObjId,
                    loserScore: this.score / 3,
                  },
                });
              }
            }
            break;
        }
      }
    );
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
      this.gameObject.setDepth(this.score);
      await this.client
        .from("players")
        .update({
          x: this.gameObject.x,
          y: this.gameObject.y,
          score: this.score,
          speed: this.speed,
        })
        .match({
          id: this.userId,
        });
    }
  }

  updateOtherMovement(delta, usr) {
    const dx = usr.x - usr.userGlobe.gameObject.x;
    const dy = usr.y - usr.userGlobe.gameObject.y;

    // Calculate the distance to move this frame based on speed and delta
    const distanceToMove = (usr.speed * delta) / 1000;

    // Calculate the angle towards the target position
    const angleToTarget = Math.atan2(dy, dx);

    // Calculate the movement for this frame along x and y axes
    const moveX = Math.cos(angleToTarget) * distanceToMove;
    const moveY = Math.sin(angleToTarget) * distanceToMove;

    // Update the position of the game object
    usr.userGlobe.gameObject.x += moveX;
    usr.userGlobe.gameObject.y += moveY;
  }
}

export default Globe;
