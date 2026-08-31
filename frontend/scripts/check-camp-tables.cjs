const db = require('better-sqlite3')(process.env.STUDYMATE_DB_DIR + '/studymate.db');
const names = ['camp_students', 'camp_class_logs', 'camp_works'];
for (const n of names) {
  const info = db
    .prepare("SELECT name FROM sqlite_master WHERE type IN ('table','index') AND (name = ? OR name LIKE ?) ORDER BY type DESC, name")
    .all(n, n + '_%');
  console.log(n + ':', info.map((x) => x.name).join(', ') || '(NONE)');
}
