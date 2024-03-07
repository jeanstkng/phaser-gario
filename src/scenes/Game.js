import { Scene } from "phaser";
import { getRealtimeChannel } from "../broadcast";
import { v4 as uuidv4 } from "uuid";

export class Game extends Scene {
  globe;
  cursor;
  cam;
  isConnected = false;
  channelA;
  userId;
  users = [];
  timeElapsed = 0;
  timeOut = 200;
  canSendMovement = false;

  constructor() {
    super("Game");
  }

  create() {
    this.userId = uuidv4();
    this.channelA = getRealtimeChannel();
    this.channelA
      .on("broadcast", { event: "movement" }, ({ payload }) => {
        const foundUser = this.users.find((user) => user.id === payload.userId);

        if (!foundUser) {
          const newBall = this.physics.add
            .image(payload.x, payload.y, "ball")
            .setCircle(45)
            .setCollideWorldBounds(true);
          this.physics.add.collider(newBall);

          this.users.push({
            id: payload.userId,
            userGlobe: newBall,
          });
        } else {
          console.log(foundUser.userGlobe.x, payload.x);
          this.physics.moveTo(foundUser.userGlobe, payload.x, payload.y, 200);
        }
      })
      .subscribe((status) => {
        console.log(status);
        if (status !== "SUBSCRIBED") {
          this.isConnected = false;
          return null;
        }

        this.isConnected = true;
      });

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

  update(time, delta) {
    if (this.timeElapsed >= this.timeOut) {
      this.timeElapsed = 0;
      this.canSendMovement = true;
    } else {
      this.timeElapsed += delta;
      this.canSendMovement = false;
    }

    if (this.isConnected) {
      if (this.canSendMovement && this.userId) {
        this.channelA.send({
          type: "broadcast",
          event: "movement",
          payload: { x: this.globe.x, y: this.globe.y, userId: this.userId },
        });
      }
    } else {
      alert("Disco disco disconnected");
    }
  }
}
