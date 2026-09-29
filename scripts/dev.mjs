import { spawn } from "node:child_process";
const children = [
  spawn(process.execPath, ["--watch", "src/index.js"], {
    cwd: "server",
    stdio: "inherit",
    env: { ...process.env, PORT: process.env.SOLVAA_API_PORT || "3008" },
  }),
  spawn(
    process.execPath,
    ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1"],
    { stdio: "inherit" },
  ),
];
function stop(signal = "SIGTERM") {
  children.forEach((child) => child.kill(signal));
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
children.forEach((child) =>
  child.on("exit", (code) => {
    stop();
    process.exitCode = code || 0;
  }),
);
