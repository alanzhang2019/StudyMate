const http = require("node:http");

const req = http.get("http://127.0.0.1:3001", (res) => {
  console.log(`STATUS ${res.statusCode}`);
  res.resume();
  process.exit(res.statusCode === 200 ? 0 : 1);
});

req.on("error", (error) => {
  console.error(`ERROR ${error.code || error.message}`);
  process.exit(2);
});

req.setTimeout(3000, () => {
  console.error("ERROR TIMEOUT");
  req.destroy();
  process.exit(3);
});
