const { spawn } = require("child_process");
const path = require("path");

const nextBin = path.join(__dirname, "node_modules", "next", "dist", "bin", "next");

const child = spawn(process.execPath, [nextBin, "dev", "--webpack", "--port", "3001"], {
  cwd: __dirname,
  stdio: "inherit",
});

child.on("exit", (code) => {
  console.log(`Next.js process exited with code ${code}`);
  process.exit(code);
});

setInterval(() => {}, 10000);
