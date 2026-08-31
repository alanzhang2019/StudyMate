// One-shot repair: 建出 camp_students / camp_class_logs / camp_works 三张表
// + 全部索引. 镜像 lib/db.ts 里的建表 DDL, 但每条 SQL 用 better-sqlite3 的
// .exec() 逐句跑, 任意一条失败立刻 throw, 不会被 try/catch 静默吞掉.
//
// 用法 (服务器上):
//   docker compose cp frontend/scripts/bootstrap-camp-tables.cjs frontend:/tmp/bootstrap.cjs
//   docker compose exec -T frontend node /tmp/bootstrap.cjs

const Database = require('better-sqlite3');

const dbPath = process.env.STUDYMATE_DB_DIR + '/studymate.db';
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

const ddl = [
  // camp_students
  `CREATE TABLE IF NOT EXISTS camp_students (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    gender TEXT,
    grade TEXT,
    school TEXT,
    parentName TEXT,
    parentPhone TEXT,
    className TEXT,
    tags TEXT NOT NULL DEFAULT '[]',
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_camp_students_class_status
     ON camp_students (className, status, createdAt DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_camp_students_name
     ON camp_students (name)`,

  // camp_class_logs
  `CREATE TABLE IF NOT EXISTS camp_class_logs (
    id TEXT PRIMARY KEY,
    classDate TEXT NOT NULL,
    className TEXT NOT NULL,
    teacherName TEXT NOT NULL,
    topic TEXT NOT NULL,
    durationMin INTEGER NOT NULL DEFAULT 90,
    studentIdsJson TEXT NOT NULL DEFAULT '[]',
    summary TEXT,
    highlightsJson TEXT NOT NULL DEFAULT '[]',
    issuesJson TEXT NOT NULL DEFAULT '[]',
    nextPlan TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_camp_logs_date_desc
     ON camp_class_logs (classDate DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_camp_logs_class_date
     ON camp_class_logs (className, classDate DESC)`,

  // camp_works
  `CREATE TABLE IF NOT EXISTS camp_works (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    studentId TEXT NOT NULL,
    studentName TEXT,
    className TEXT,
    classLogId TEXT,
    category TEXT NOT NULL DEFAULT '作品',
    coverImage TEXT,
    linkUrl TEXT,
    description TEXT,
    techStackJson TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'pending',
    reviewNote TEXT,
    reviewedAt TEXT,
    reviewedBy TEXT,
    featured INTEGER NOT NULL DEFAULT 0,
    sortOrder INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_camp_works_status_created
     ON camp_works (status, createdAt DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_camp_works_student_created
     ON camp_works (studentId, createdAt DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_camp_works_featured
     ON camp_works (featured DESC, sortOrder, createdAt DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_camp_works_class_date
     ON camp_works (className, createdAt DESC)`,
];

for (const sql of ddl) {
  try {
    db.exec(sql);
  } catch (err) {
    console.error('[bootstrap] DDL failed:', err.message);
    console.error('[bootstrap] SQL was:', sql);
    process.exit(1);
  }
}

const names = ['camp_students', 'camp_class_logs', 'camp_works'];
for (const n of names) {
  const info = db
    .prepare("SELECT name FROM sqlite_master WHERE type IN ('table','index') AND (name = ? OR name LIKE ?) ORDER BY type DESC, name")
    .all(n, n + '_%');
  console.log(n + ':', info.map((x) => x.name).join(', ') || '(NONE)');
}

console.log('[bootstrap] done at', dbPath);
db.close();
