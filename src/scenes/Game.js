import { Scene } from "phaser";
import { getRealtimeChannel } from "../broadcast";
import Globe from "../objects/Globe";

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

  constructor() {
    super("Game");
    this.globe = new Globe(this);

    // Initialize Client and Room from Supabase Realtime Channel
    const { room, client } = getRealtimeChannel();
    this.channelA = room;
    this.clientMain = client;
  }

  create() {
    this.globe.initialize();

    this.users.push({ id: this.globe.userId });

    this.add.image(0, 0, "grid").setOrigin(0); // Set background image

    const userStatus = {
      id: this.globe.userId,
      isConnected: true,
      initialX: this.globe.gameObject.x,
      initialY: this.globe.gameObject.y,
    };

    this.channelA
      .on("presence", { event: "sync" }, () => {
        const newState = this.channelA.presenceState();

        /* Find in the local users the user that has the same id from the state received
           consider that each state has a key then data is inside an array and always
           on first position */
        const foundUsr = Object.keys(newState).find((key) =>
          this.users.find((user) => newState[key][0].id === user.id)
        );

        if (!foundUsr && Object.keys(newState).length > 1) {
          const newBall = this.physics.add
            .image(newState.initialX, newState.initialY, "ball")
            .setDisplaySize(36, 36)
            .setCircle(36)
            .setCollideWorldBounds(true);

          newBall.this.physics.add.collider(newBall);

          this.users.push({
            id: newState.user,
            userGlobe: newBall,
            x: newState.initialX,
            y: newState.initialY,
          });
        }
      })
      .on("presence", { event: "leave" }, ({ key, leftPresences }) => {
        const usersToLeave = this.users.filter(
          (user) => user.id === leftPresences.id
        );

        if (usersToLeave.length > 0) {
          this.usersToLeave.map((usr) => usr.userGlobe.destroy());
          this.users = this.users.filter(
            (user) => user.id !== leftPresences.id
          );
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
            payload.new.id !== this.globe.userId
          ) {
            const foundUser = this.users.find(
              (user) => user.id === payload.new.id
            );

            if (!foundUser) {
              const newBall = new Globe(this, x, y);
              newBall.initialize();

              this.users.push({
                id: id,
                userGlobe: newBall.gameObject,
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
          id: this.globe.userId,
          x: this.globe.gameObject.x,
          y: this.globe.gameObject.y,
          score: this.globe.score,
        });

        const { data } = await this.clientMain.from("cells").select();
        data.map((cell) => {
          if (!cell.isEaten) {
            const newCell = this.physics.add
              .image(cell.x, cell.y, "food")
              .setName("cell")
              .setDisplaySize(24, 24)
              .setCircle(24)
              .setCollideWorldBounds(true);

            newCell.setDataEnabled();
            newCell.setData("id", cell.id);

            this.physics.add.collider(this.globe.gameObject, newCell);
          }
        });

        this.isConnected = true;
        this.events.emit("connection", this.isConnected);
      });

    this.cam = this.cameras.main;

    this.cam.setBounds(0, 0, 4096, 4096).setZoom(2);
    this.physics.world.setBounds(100, 100, 4000, 4000);

    this.cam.startFollow(this.globe.gameObject);

    this.cursor = this.add.rectangle(0, 0, 20, 20);

    this.physics.world.on(
      "collide",
      async (gameObject1, gameObject2, body1, body2) => {
        if (gameObject2.name === "cell") {
          const cellId = gameObject2.getData("id");
          gameObject2.destroy();

          this.globe.score += 0.05;

          this.globe.gameObject.setDisplaySize(
            this.globe.initialSize * this.globe.score,
            this.globe.initialSize * this.globe.score
          );
          this.globe.gameObject.setCircle(
            this.globe.initialSize * this.globe.score
          );

          if (this.cam.zoom > 1) {
            this.globe.speed -= 0.025;
            this.cam.setZoom(this.cam.zoom - this.globe.zoomDisminution);
          }

          this.clientMain
            .from("cells")
            .update({
              isEaten: true,
            })
            .match({
              id: cellId,
            });
        }
      }
    );
  }

  async update(_time, delta) {
    if (this.timeElapsed >= this.timeOut) {
      this.timeElapsed = 0;
      this.canSendMovement = true;
    } else {
      this.timeElapsed += delta;
      this.canSendMovement = false;
    }

    this.users
      .filter((val) => val.id !== this.globe.userId)
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

    if (this.isConnected && this.globe.userId && this.canSendMovement) {
      await this.clientMain
        .from("players")
        .update({
          x: this.globe.gameObject.x,
          y: this.globe.gameObject.y,
          score: this.globe.score,
        })
        .match({
          id: this.globe.userId,
        });
    }
  }
}
