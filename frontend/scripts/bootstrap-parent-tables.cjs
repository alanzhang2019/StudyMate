// One-off schema bootstrap. Adds the three parent_* tables that
// were introduced after the SQLite file was first created on this
// dev box, so that hot-reloaded API routes can talk to them.
const Database = require('better-sqlite3');
const db = new Database('D:/tmp/studymate/studymate.sqlite');
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS parent_invite_codes (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    studentVisitorId TEXT NOT NULL,
    expiresAt TEXT NOT NULL,
    usedAt TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_invite_codes_code
    ON parent_invite_codes (code);
  CREATE INDEX IF NOT EXISTS idx_invite_codes_student
    ON parent_invite_codes (studentVisitorId, createdAt DESC);

  CREATE TABLE IF NOT EXISTS parent_bindings (
    id TEXT PRIMARY KEY,
    parentVisitorId TEXT NOT NULL,
    studentVisitorId TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    revokedAt TEXT,
    revokedBy TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_parent_bindings_parent
    ON parent_bindings (parentVisitorId, revokedAt);
  CREATE INDEX IF NOT EXISTS idx_parent_bindings_student
    ON parent_bindings (studentVisitorId, revokedAt);

  CREATE TABLE IF NOT EXISTS parent_ai_insights (
    id TEXT PRIMARY KEY,
    studentVisitorId TEXT NOT NULL,
    content TEXT NOT NULL,
    mistakeHash TEXT NOT NULL,
    generatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_ai_insights_student_generated
    ON parent_ai_insights (studentVisitorId, generatedAt DESC);
`);
const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'parent_%' ORDER BY name")
  .all();
console.log('Created:', tables.map((t) => t.name).join(', '));
