// dev-local.js — 启动本地 dev server
const { spawn } = require("child_process");

const dev = spawn("npx", ["next", "dev", ...process.argv.slice(2)], {
  stdio: "inherit",
  shell: true,
});

process.on("SIGINT", () => {
  dev.kill();
  process.exit(0);
});
process.on("SIGTERM", () => {
  dev.kill();
  process.exit(0);
});
