// All databases in this helper are disposable; never reads a real DATABASE_URL.
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { Client } = require("pg");
const run = promisify(execFile);

async function temporaryPostgres(t) {
  let url;
  if (process.env.SOLVAA_TEST_DOCKER) {
    const name = `solvaa-migration-test-${process.pid}`;
    const docker = (...args) =>
      run("docker", ["--context", process.env.SOLVAA_TEST_DOCKER, ...args], {
        timeout: 120000,
      });
    await docker(
      "run",
      "--rm",
      "-d",
      "--name",
      name,
      "-p",
      "127.0.0.1::5432",
      "-e",
      "POSTGRES_HOST_AUTH_METHOD=trust",
      "postgres:16-alpine",
    );
    t.after(() => docker("rm", "-fv", name));
    const port = (await docker("port", name, "5432/tcp")).stdout
      .trim()
      .split(":")
      .pop();
    url = `postgresql://postgres@127.0.0.1:${port}/postgres`;
  } else {
    const directory = await mkdtemp(
      path.join(tmpdir(), "solvaa-migration-test-"),
    );
    const data = path.join(directory, "data");
    const probe = net.createServer();
    await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
    const port = probe.address().port;
    await new Promise((resolve) => probe.close(resolve));
    let started = false;
    t.after(async () => {
      if (started)
        await run("pg_ctl", ["-D", data, "-m", "immediate", "-w", "stop"]);
      await rm(directory, { recursive: true, force: true });
    });
    await run("initdb", [
      "-D",
      data,
      "-A",
      "trust",
      "--no-locale",
      "-U",
      "solvaa_test",
    ]);
    await run("pg_ctl", [
      "-D",
      data,
      "-l",
      path.join(directory, "postgres.log"),
      "-o",
      `-h 127.0.0.1 -p ${port} -k ${directory}`,
      "-w",
      "start",
    ]);
    started = true;
    url = `postgresql://solvaa_test@127.0.0.1:${port}/postgres`;
  }
  for (let attempt = 0; attempt < 40; attempt++) {
    const client = new Client({
      connectionString: url,
      connectionTimeoutMillis: 1000,
    });
    client.on("error", () => {});
    try {
      await client.connect();
      await client.end();
      return { DATABASE_URL: url, NODE_ENV: "test" };
    } catch {
      await client.end().catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw Error("Temporary PostgreSQL did not become ready");
}
module.exports = { temporaryPostgres };
