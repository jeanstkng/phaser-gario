import { Scene } from "phaser";
import { getRealtimeChannel } from "../broadcast";
import Globe from "../objects/Globe";

export class Game extends Scene {
  globe;
  cursor;
  users = [];
  cells = [];
  isConnected = false;

  constructor() {
    super("Game");

    // Initialize Client and Room from Supabase Realtime Channel
    const { room, client } = getRealtimeChannel();
    this.channelA = room;
    this.mainClient = client;
    this.globe = new Globe(this);
  }

  create() {
    this.globe.initialize();

    this.users.push({ id: this.globe.userId });

    this.add.image(0, 0, "grid").setOrigin(0); // Set background image

    const userStatus = {
      id: this.globe.userId,
      initialX: this.globe.gameObject.x,
      initialY: this.globe.gameObject.y,
    };

    this.channelA
      .on("presence", { event: "sync" }, () => {
        const newState = this.channelA.presenceState();

        const foundUsr = this.users.find((user) =>
          Object.keys(newState).find(
            (key) =>
              newState[key][0].id === user.id &&
              newState[key][0].id !== this.globe.userId
          )
        );

        if (!foundUsr && Object.keys(newState).length > 1) {
          Object.keys(newState).map((key) => {
            const usrState = newState[key][0];
            if (usrState.id === this.globe.userId) return;

            const newBall = new Globe(
              this,
              usrState.initialX,
              usrState.initialY,
              usrState.id,
              false
            );
            newBall.initialize();

            this.physics.add.overlap(this.globe.gameObject, newBall.gameObject);

            this.users.push({
              id: usrState.id,
              userGlobe: newBall.gameObject,
              x: usrState.initialX,
              y: usrState.initialY,
            });
          });
        }
      })
      .on("presence", { event: "leave" }, ({ key, leftPresences }) => {
        const usersToLeave = this.users.filter((user) =>
          leftPresences.find((elem) => elem.id === user.id)
        );

        if (usersToLeave.length > 0) {
          usersToLeave.map((usr) => usr.userGlobe.destroy());
          this.users = this.users.filter((user) =>
            leftPresences.find((elem) => elem.id !== user.id)
          );
        }
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players" },
        (payload) => this.handlePlayersTableChanges(payload)
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "cells" },
        (payload) => this.handleCellsTableUpdate(payload)
      )
      .subscribe(async (status) => {
        if (status !== "SUBSCRIBED") {
          this.isConnected = false;
          this.events.emit("connection", this.isConnected);
          return null;
        }

        await this.channelA.track(userStatus); // Send presence status
        await this.mainClient.from("players").insert({
          id: this.globe.userId,
          x: this.globe.gameObject.x,
          y: this.globe.gameObject.y,
          score: this.globe.score,
        });

        const { data } = await this.mainClient.from("cells").select();
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

            this.physics.add.overlap(this.globe.gameObject, newCell);
            this.cells.push({ id: cell.id, gameObject: newCell });
          }
        });

        this.isConnected = true;
        this.events.emit("connection", this.isConnected);
      });

    this.physics.world.setBounds(100, 100, 4000, 4000);

    this.cursor = this.add.rectangle(0, 0, 20, 20);
  }

  update(_time, delta) {
    this.users
      .filter((val) => val.id !== this.globe.userId)
      .map((usr) => {
        // if (
        //   Phaser.Math.Distance.Between(
        //     usr.userGlobe.x,
        //     usr.userGlobe.y,
        //     usr.x,
        //     usr.y
        //   ) <= 2
        // ) {
        //   usr.userGlobe.body.reset(usr.x, usr.y);
        // } else {
        this.physics.moveTo(usr.userGlobe, usr.x, usr.y, 200);
        // }
      });

    this.globe.update(this.mainClient, this.isConnected, delta);
  }

  handlePlayersTableChanges(payload) {
    const { x, y, id, score } = payload.new;

    switch (payload.eventType) {
      case "UPDATE":
        this.users.map((usr) => {
          if (usr.id === id && this.globe.userId !== id) {
            usr.x = x;
            usr.y = y;
            usr.userGlobe.setDepth(score);

            usr.userGlobe.setDisplaySize(
              this.globe.initialSize * score,
              this.globe.initialSize * score
            );
            usr.userGlobe.setCircle(this.globe.initialSize * score);
          }
        });
        break;

      case "INSERT":
        if (payload.new.id !== this.globe.userId) {
          const foundUser = this.users.find(
            (user) => user.id === payload.new.id
          );

          if (foundUser) {
            foundUser.x = x;
            foundUser.y = y;
            return;
          }

          const newBall = new Globe(this, x, y, id, false);
          newBall.initialize();

          this.physics.add.overlap(this.globe.gameObject, newBall.gameObject);

          this.users.push({
            id: id,
            userGlobe: newBall.gameObject,
            x: x,
            y: y,
          });
        }
        break;
    }
  }

  handleCellsTableUpdate(payload) {
    const { id, isEaten, x, y } = payload.new;

    const existingCell = this.cells.find((cell) => cell.id === id);

    if (existingCell && isEaten) {
      this.cells = this.cells.filter((cell) => cell.id !== id);
      existingCell.gameObject.destroy();
    } else if (!isEaten) {
      const newCell = this.physics.add
        .image(x, y, "food")
        .setName("cell")
        .setDisplaySize(24, 24)
        .setCircle(24)
        .setCollideWorldBounds(true);

      newCell.setDataEnabled();
      newCell.setData("id", id);

      this.physics.add.overlap(this.globe.gameObject, newCell);
      this.cells.push({ id: id, gameObject: newCell });
    }
  }
}
