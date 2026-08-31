// App entry point: registers each screen with the router and boots it.
Router.register("intro", {
  onEnter: () => console.log("[intro] entered"),
  onExit: () => console.log("[intro] exited"),
});

Router.register("map", {
  onEnter: () => console.log("[map] entered"),
  onExit: () => console.log("[map] exited"),
});

Router.register("case", {
  onEnter: () => console.log("[case] entered"),
  onExit: () => console.log("[case] exited"),
});

Router.register("simulator", {
  onEnter: () => console.log("[simulator] entered"),
  onExit: () => console.log("[simulator] exited"),
});

Router.register("boss", {
  onEnter: () => console.log("[boss] entered"),
  onExit: () => console.log("[boss] exited"),
});

Router.setDefault("intro");
Router.init();
