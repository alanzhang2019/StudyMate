const Database = require('better-sqlite3');
const db = new Database('D:/tmp/studymate/studymate.sqlite', { readonly: true });
const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
  .all();
console.log('TABLES:', tables.map((t) => t.name).join('\n'));
const check = db.prepare("SELECT name FROM sqlite_master WHERE name = 'parent_invite_codes'").get();
console.log('parent_invite_codes EXISTS:', !!check);
