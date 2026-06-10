const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname.replace(/\\/g, '/');
const FRONTEND = path.join(ROOT, 'frontend').replace(/\\/g, '/');
const BACKEND = path.join(ROOT, 'backend').replace(/\\/g, '/');

console.log(`[runner] frontend: ${FRONTEND}`);
console.log(`[runner] backend:  ${BACKEND}`);

try { fs.unlinkSync('fe-run.log'); } catch {}
try { fs.unlinkSync('be-run.log'); } catch {}

const fe = exec(`pnpm dev --webpack -p 3001`, { cwd: FRONTEND });
fe.stdout.on('data', d => { process.stdout.write(`[FE] ${d}`); fs.appendFileSync('fe-run.log', d); });
fe.stderr.on('data', d => { process.stderr.write(`[FE] ${d}`); fs.appendFileSync('fe-run.log', d); });

const be = exec(`npm run dev`, { cwd: BACKEND });
be.stdout.on('data', d => { process.stdout.write(`[BE] ${d}`); fs.appendFileSync('be-run.log', d); });
be.stderr.on('data', d => { process.stderr.write(`[BE] ${d}`); fs.appendFileSync('be-run.log', d); });

const shutdown = () => { try { fe.kill(); } catch {} try { be.kill(); } catch {} process.exit(0); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
