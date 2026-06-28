// Add the missing `createdAt` column to `parent_ai_insights` on
// the dev DB. Necessary because the earlier bootstrap script
// didn't include it and `buildFinder.create` injects it.
const Database = require('better-sqlite3');
const db = new Database('D:/tmp/studymate/studymate.sqlite');
const cols = db.prepare("PRAGMA table_info(parent_ai_insights)").all();
console.log('BEFORE:', cols.map((c) => c.name).join(', '));
if (!cols.find((c) => c.name === 'createdAt')) {
  db.exec("ALTER TABLE parent_ai_insights ADD COLUMN createdAt TEXT NOT NULL DEFAULT (datetime('now'))");
  console.log('added createdAt');
}
const after = db.prepare("PRAGMA table_info(parent_ai_insights)").all();
console.log('AFTER:', after.map((c) => c.name).join(', '));
