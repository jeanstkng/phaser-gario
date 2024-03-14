import { Scene } from "phaser";
import { getRealtimeChannel } from "../broadcast";
import { v4 as uuidv4 } from "uuid";

export class Game extends Scene {
  globe;
  cursor;
  cam;
  isConnected = false;
  channelA;
  clientMain;
  userId;
  users = [];
  timeElapsed = 0;
  timeOut = 50;
  canSendMovement = false;
  actualPointerPos;
  score = 1;

  constructor() {
    super("Game");
  }

  create() {
    this.userId = uuidv4();
    this.users.push({ id: this.userId });

    const { room, client } = getRealtimeChannel();
    this.channelA = room;
    this.clientMain = client;

    this.add.image(0, 0, "grid").setOrigin(0);

    const spawnRandPosX = Phaser.Math.RND.integerInRange(200, 3900);
    const spawnRandPosY = Phaser.Math.RND.integerInRange(200, 3900);

    this.globe = this.physics.add
      .image(spawnRandPosX, spawnRandPosY, "ball")
      .setDisplaySize(24, 24)
      .setCircle(24)
      .setCollideWorldBounds(true);

    const userStatus = {
      id: this.userId,
      isConnected: true,
      initialX: this.globe.x,
      initialY: this.globe.y,
    };

    this.channelA
      .on("presence", { event: "sync" }, () => {
        const newState = this.channelA.presenceState();
        console.log(newState, "newState pa");

        const foundUsr = Object.keys(newState).find((key) =>
          this.users.find((user) => newState[key][0].id === user.id)
        );

        if (!foundUsr && Object.keys(newState).length > 1) {
          console.log("chi", Object.keys(newState).length);
          const newBall = this.physics.add
            .image(newState.initialX, newState.initialY, "ball")
            .setDisplaySize(24, 24)
            .setCircle(24)
            .setCollideWorldBounds(true);

          newBall.this.physics.add.collider(newBall);

          this.users.push({
            id: newState.user,
            userGlobe: newBall,
            x: newState.initialX,
            y: newState.initialY,
          });
        }
        console.log("sync", newState);
      })
      .on("presence", { event: "leave" }, ({ key, leftPresences }) => {
        console.log("leave", key, leftPresences);
        const usersToLeave = this.users.filter(
          (user) => user.id === leftPresences.id
        );

        if (usersToLeave.length > 0) {
          this.usersToLeave.map((usr) => usr.userGlobe);
        }
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players" },
        (payload) => {
          const { x, y, id } = payload.new;

          if (payload.eventType === "UPDATE") {
            this.users.map((usr) => {
              if (usr.id === id) {
                usr.x = x;
                usr.y = y;
              }
            });
          }

          if (
            payload.eventType === "INSERT" &&
            payload.new.id !== this.userId
          ) {
            const foundUser = this.users.find(
              (user) => user.id === payload.new.id
            );

            if (!foundUser) {
              const newBall = this.physics.add
                .image(x, y, "ball")
                .setDisplaySize(24, 24)
                .setCircle(24)
                .setCollideWorldBounds(true);
              this.physics.add.collider(newBall);

              this.users.push({
                id: id,
                userGlobe: newBall,
                x: x,
                y: y,
              });
            } else {
              foundUser.x = x;
              foundUser.y = y;
              // this.physics.moveTo(foundUser.userGlobe, payload.x, payload.y, 200);
            }
          }
        }
      )
      .subscribe(async (status) => {
        if (status !== "SUBSCRIBED") {
          this.isConnected = false;
          this.events.emit("connection", this.isConnected);
          return null;
        }

        await this.channelA.track(userStatus); // Send presence status
        await this.clientMain.from("players").insert({
          id: this.userId,
          x: this.globe.x,
          y: this.globe.y,
          score: this.score,
        });

        this.isConnected = true;
        this.events.emit("connection", this.isConnected);
      });

    this.cam = this.cameras.main;

    this.cam.setBounds(0, 0, 4096, 4096).setZoom(2);
    this.physics.world.setBounds(100, 100, 4000, 4000);

    this.cam.startFollow(this.globe);

    this.cursor = this.add.rectangle(0, 0, 20, 20);

    this.physics.add.collider(this.globe);

    this.input.on("pointermove", (pointer) => {
      this.actualPointerPos = this.cam.getWorldPoint(pointer.x, pointer.y);
      this.physics.moveToObject(this.globe, this.actualPointerPos, 200);
    });
  }

  async update(time, delta) {
    if (this.timeElapsed >= this.timeOut) {
      this.timeElapsed = 0;
      this.canSendMovement = true;
    } else {
      this.timeElapsed += delta;
      this.canSendMovement = false;
    }

    this.users
      .filter((val) => val.id !== this.userId)
      .map((usr) => {
        if (
          Phaser.Math.Distance.Between(
            usr.userGlobe.x,
            usr.userGlobe.y,
            usr.x,
            usr.y
          ) <= 10
        ) {
          usr.userGlobe.body.reset(usr.x, usr.y);
        } else {
          this.physics.moveTo(usr.userGlobe, usr.x, usr.y, 200);
        }
      });

    if (this.isConnected && this.userId && this.canSendMovement) {
      await this.clientMain
        .from("players")
        .update({
          x: this.globe.x,
          y: this.globe.y,
          score: this.score,
        })
        .match({
          id: this.userId,
        });
    }
  }
}
