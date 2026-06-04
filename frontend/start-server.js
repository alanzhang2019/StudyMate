const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const projectRoot = __dirname;
const outPath = path.join(projectRoot, "server-out.log");
const errPath = path.join(projectRoot, "server-err.log");
const pidPath = path.join(projectRoot, "server-pid.txt");
const nextBin = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");

const out = fs.openSync(outPath, "a");
const err = fs.openSync(errPath, "a");

fs.appendFileSync(outPath, `[${new Date().toISOString()}] starting Next dev on 3001\n`);
fs.appendFileSync(errPath, `[${new Date().toISOString()}] launcher initialized\n`);

const child = spawn(process.execPath, [nextBin, "dev", "--webpack", "--port", "3001"], {
  cwd: projectRoot,
  detached: true,
  windowsHide: true,
  shell: false,
  stdio: ["ignore", out, err],
});

child.on("error", (error) => {
  fs.appendFileSync(errPath, `[${new Date().toISOString()}] spawn error: ${error.stack || error.message}\n`);
});

child.unref();

fs.writeFileSync(pidPath, `${child.pid}\n`);
