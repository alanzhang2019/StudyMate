-- Bootstrap missing camp_* tables in the production SQLite database.
--
-- 背景: applyMigrations() 里的 camp_* 建表语句被一个外层 try/catch 静默吞掉,
-- 导致生产库里 camp_students / camp_class_logs / camp_works 三张表从未真正建出.
-- 本脚本镜像 db.ts:642-709 那段 SQL, 用 sqlite3 CLI 直接跑.
--
-- 用法 (在部署机上):
--   cd /home/ubuntu/studymate
--   DB_DIR=$(docker compose exec -T frontend sh -c 'echo $STUDYMATE_DB_DIR')
--   docker compose exec -T frontend sh -c "sqlite3 \"$DB_DIR/studymate.db\" < /app/scripts/2026-08-31-bootstrap-camp-tables.sql"
-- (把脚本先 scp 到容器里, 或者用下面的单行 in-line)
--
-- 或者最省事的一行 (直接 exec 进容器, 跑下面的 sqlite3 块):

CREATE TABLE IF NOT EXISTS camp_students (
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
);
CREATE INDEX IF NOT EXISTS idx_camp_students_class_status
  ON camp_students (className, status, createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_camp_students_name ON camp_students (name);

CREATE TABLE IF NOT EXISTS camp_class_logs (
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
);
CREATE INDEX IF NOT EXISTS idx_camp_logs_date_desc
  ON camp_class_logs (classDate DESC);
CREATE INDEX IF NOT EXISTS idx_camp_logs_class_date
  ON camp_class_logs (className, classDate DESC);

CREATE TABLE IF NOT EXISTS camp_works (
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
);
CREATE INDEX IF NOT EXISTS idx_camp_works_status_created
  ON camp_works (status, createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_camp_works_student_created
  ON camp_works (studentId, createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_camp_works_featured
  ON camp_works (featured DESC, sortOrder, createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_camp_works_class_date
  ON camp_works (className, createdAt DESC);
