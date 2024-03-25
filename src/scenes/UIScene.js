export class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: "UIScene", active: true });
  }

  create() {
    //  Our Text object to display the Score
    const info = this.add.text(10, 10, "disconnected", {
      font: "16px Arial",
      fill: "#000",
    });

    //  Grab a reference to the Game Scene
    const mainGame = this.scene.get("Game");

    //  Listen for events from it
    mainGame.events.on(
      "connection",
      (isConnected) => {
        info.setText(isConnected ? "connected" : "disconnected");
      },
      this
    );
  }
}
