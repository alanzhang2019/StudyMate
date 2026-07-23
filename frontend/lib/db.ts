// @ts-nocheck -- TypeScript types in this compatibility shim are not worth pinning down.
// Runtime behaviour is exercised by the app/api routes.

// Implements the minimum surface that the app/api routes rely on
// (user / studentProfile / mistakeRecord / systemConfig) without
// requiring prisma generate or a schema file.

import Database from 'better-sqlite3'
import path from 'path'
import { randomUUID } from 'crypto'
import { mkdirSync, existsSync } from 'fs'

type Row = Record<string, any>

const DB_DIR = process.env.STUDYMATE_DB_DIR ?? '/tmp/studymate'
const DB_PATH = path.join(DB_DIR, 'studymate.sqlite')

if (!existsSync(DB_DIR)) {
  mkdirSync(DB_DIR, { recursive: true })
}

let _db: Database | null = null
let _dbInit: boolean = false

function tableExists(db: Database, name: string): boolean {
  try {
    db.prepare(`SELECT 1 FROM ${name} LIMIT 1`).get()
    return true
  } catch {
    return false
  }
}

function getDb(): Database {
  if (!_db) {
    // During Next.js's `next build` (page data collection), each worker
    // process can hit this code path simultaneously. Use a per-process
    // in-memory database in that exact phase so the workers do not race
    // on the same on-disk file.
    //
    // IMPORTANT: only match on the explicit `NEXT_PHASE` env var that
    // Next.js sets to `phase-production-build` while running `next build`.
    // We previously also checked `process.argv.includes('build')`, which
    // silently matched the runtime command line of `next start` (the
    // Node process tree of `pnpm start` happens to contain the substring
    // "build") and sent every production request at a throwaway
    // `:memory:` database — which is why `/api/admin/config` returned
    // 500s even though the route compiled cleanly.
    const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build'
    if (isBuildPhase) {
      _db = new Database(':memory:')
      _db.pragma('journal_mode = MEMORY')
    } else {
      _db = new Database(DB_PATH)
      _db.pragma('journal_mode = WAL')
      _db.pragma('busy_timeout = 10000')
      _db.pragma('synchronous = NORMAL')
    }
  }
  if (!_dbInit || !tableExists(_db, 'parent_invite_codes')) {
    _dbInit = false
    _db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    passwordHash TEXT NOT NULL,
    name TEXT,
    -- role: 'parent' (default for legacy accounts), 'student' (direct-login
    -- student account for /csp-lecture and similar), 'admin' (backstage).
    -- Backward-compat: existing rows have NULL and the helper getRole()
    -- below returns 'parent' for them.
    role TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS student_profiles (
    id TEXT PRIMARY KEY,
    parentId TEXT NOT NULL,
    name TEXT NOT NULL,
    grade INTEGER NOT NULL,
    teachingStyle TEXT NOT NULL,
    ttsVoice TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (parentId) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_student_profiles_parentId ON student_profiles(parentId);

  -- mistake_book: a per-visitor "favourites" / "saved mistakes" list.
  -- Separate from mistake_records (which is bound to a logged-in
  -- parent/student pair) so anonymous users can still build up a
  -- personal collection before signing in. Once a visitor signs in,
  -- a future migration can copy rows whose visitorId matches their
  -- account into mistake_records if the user wants them merged.
  CREATE TABLE IF NOT EXISTS mistake_book (
    id TEXT PRIMARY KEY,
    visitorId TEXT NOT NULL,
    imageUrl TEXT,
    problemText TEXT NOT NULL,
    userAnswer TEXT,
    correctAnswer TEXT,
    classroomId TEXT,
    sessionId TEXT,
    subject TEXT,
    grade TEXT,
    title TEXT,
    isResolved INTEGER NOT NULL DEFAULT 0,
    resolvedAt TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_mistake_book_visitor_created
    ON mistake_book (visitorId, createdAt DESC);
  CREATE INDEX IF NOT EXISTS idx_mistake_book_visitor_resolved
    ON mistake_book (visitorId, isResolved);

  CREATE TABLE IF NOT EXISTS mistake_records (
    id TEXT PRIMARY KEY,
    studentId TEXT NOT NULL,
    parentId TEXT NOT NULL,
    question TEXT NOT NULL,
    userAnswer TEXT NOT NULL,
    correctAnswer TEXT NOT NULL,
    isResolved INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (studentId) REFERENCES student_profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (parentId) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_mistake_records_studentId ON mistake_records(studentId);

  CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS usage_events (
    id TEXT PRIMARY KEY,
    eventName TEXT NOT NULL,
    payload TEXT,
    visitorId TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_usage_events_name_time
    ON usage_events (eventName, createdAt);
  CREATE INDEX IF NOT EXISTS idx_usage_events_visitor_time
    ON usage_events (visitorId, createdAt);

  -- parent_invite_codes: short-lived binding codes (6 digits, 10 min)
  -- generated by the student to invite their parents.
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

  -- parent_bindings: durable parent ↔ student relationship created
  -- when a parent successfully redeems an invite code. parentVisitorId
  -- is auto-generated on first redeem and persisted via cookie.
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

  -- parent_ai_insights: cached KIMI-generated dashboard commentary.
  -- Validated by mistakeHash so any change to the student's mistake
  -- set automatically invalidates the cache without explicit cleanup.
  CREATE TABLE IF NOT EXISTS parent_ai_insights (
    id TEXT PRIMARY KEY,
    studentVisitorId TEXT NOT NULL,
    content TEXT NOT NULL,
    mistakeHash TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    generatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_ai_insights_student_generated
    ON parent_ai_insights (studentVisitorId, generatedAt DESC);

  -- integration_jobs: third-party integrations (e.g. Vjudge-AI-report).
  -- Each row represents one externally-submitted problem. We kick off
  -- an in-process job that prepares a mistake session, then let the
  -- browser load /generation-preview to drive the LLM + media pipeline.
  CREATE TABLE IF NOT EXISTS integration_jobs (
    id TEXT PRIMARY KEY,
    subject TEXT NOT NULL,
    source TEXT,
    requestPayload TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    stage TEXT,
    sessionId TEXT,
    classroomId TEXT,
    errorCode TEXT,
    errorMessage TEXT,
    ip TEXT,
    ua TEXT,
    expiresAt TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_integration_jobs_ip_time
    ON integration_jobs (ip, createdAt DESC);
  CREATE INDEX IF NOT EXISTS idx_integration_jobs_status
    ON integration_jobs (status, createdAt DESC);
`)

    // Idempotent column migration for usage_events. We can't add
    // it inside the CREATE TABLE block above because 'IF NOT EXISTS'
    // skips the whole statement when the table already exists.
    // Wrapping the ALTER in try/catch keeps this safe to run on
    // every boot — older better-sqlite3 throws if the column is
    // already present, which is the common case after the first
    // deploy with this migration.
    try {
      _db.exec('ALTER TABLE usage_events ADD COLUMN visitorId TEXT')
    } catch {
      // column already exists
    }

    // Idempotent column migration for users: add `name` and `role`
    // to existing databases. The CREATE TABLE above already includes
    // them for fresh installs. The role column stays nullable so
    // existing accounts don't need a backfill — application code
    // falls back to 'parent' for NULL values (see getRole helper).
    try {
      _db.exec("ALTER TABLE users ADD COLUMN name TEXT")
    } catch {
      // column already exists
    }
    try {
      _db.exec("ALTER TABLE users ADD COLUMN role TEXT")
    } catch {
      // column already exists
    }

    // Only flip the flag once the schema actually finished applying
    // — otherwise an exception from `_db.exec` would leave us in a
    // "tried but never succeeded" state and every subsequent call
    // would short-circuit straight to `return _db` with a partial
    // schema. This used to be set BEFORE the exec, which silently
    // masked a typo in the inner SQL on hot reload.
    _dbInit = true
  }
  return _db
}

const now = () => new Date().toISOString()
const cid = () => randomUUID()

function rowToCamel<T extends Row>(row: T): T {
  if (!row) return row
  const out: Row = {}
  for (const key of Object.keys(row)) {
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    out[camel] = row[key]
  }
  return out as T
}

function buildFinder(table: string, idColumn: string) {
  return {
    findUnique: ({ where, select }: { where: Row; select?: Row } = { where: {} }) => {
      const entries = Object.entries(where)
      if (entries.length !== 1) {
        throw new Error(`${table}.findUnique requires a single where clause`)
      }
      const [col, val] = entries[0]
      const sqlCol = col
      const stmt = getDb().prepare(`SELECT * FROM ${table} WHERE ${sqlCol} = ? LIMIT 1`)
      const row = stmt.get(val)
      if (!row) return null
      const camel = rowToCamel(row as Row)
      if (select) {
        const out: Row = {}
        for (const k of Object.keys(select)) {
          if (select[k] && (k in camel)) out[k] = camel[k]
        }
        return out
      }
      return camel
    },
    findFirst: ({ where, orderBy }: { where?: Row; orderBy?: Row } = {}) => {
      const whereSql: string[] = []
      const params: any[] = []
      if (where) {
        for (const [k, v] of Object.entries(where)) {
          if (v === null) {
            whereSql.push(`${k} IS NULL`)
          } else {
            whereSql.push(`${k} = ?`)
            params.push(v)
          }
        }
      }
      let sql = `SELECT * FROM ${table}`
      if (whereSql.length) sql += ` WHERE ${whereSql.join(' AND ')}`
      if (orderBy) {
        const [[k, dir]] = Object.entries(orderBy) as [string, string][]
        sql += ` ORDER BY ${k} ${dir}`
      }
      sql += ' LIMIT 1'
      const row = getDb().prepare(sql).get(...params)
      return row ? rowToCamel(row as Row) : null
    },
    findMany: ({ where, orderBy, take, select }: { where?: Row; orderBy?: Row; take?: number; select?: Row } = {}) => {
      const whereSql: string[] = []
      const params: any[] = []
      if (where) {
        for (const [k, v] of Object.entries(where)) {
          if (v === null) {
            whereSql.push(`${k} IS NULL`)
          } else {
            whereSql.push(`${k} = ?`)
            params.push(v)
          }
        }
      }
      let sql = `SELECT * FROM ${table}`
      if (whereSql.length) sql += ` WHERE ${whereSql.join(' AND ')}`
      if (orderBy) {
        const [[k, dir]] = Object.entries(orderBy) as [string, string][]
        sql += ` ORDER BY ${k} ${dir}`
      }
      if (typeof take === 'number') sql += ` LIMIT ${take}`
      const rows = getDb().prepare(sql).all(...params) as Row[]
      return rows.map((row) => {
        const camel = rowToCamel(row)
        if (select) {
          const out: Row = {}
          for (const k of Object.keys(select)) {
            if (select[k] && (k in camel)) out[k] = camel[k]
          }
          return out
        }
        return camel
      })
    },
    create: ({ data }: { data: Row }) => {
      const id = data.id ?? cid()
      const createdAt = data.createdAt ?? now()
      const fields: Row = { id, ...data, createdAt }
      const cols = Object.keys(fields)
      const placeholders = cols.map(() => '?').join(', ')
      const values = cols.map((c) => fields[c])
      getDb()
        .prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`)
        .run(...values)
      const row = getDb()
        .prepare(`SELECT * FROM ${table} WHERE id = ?`)
        .get(id) as Row
      return rowToCamel(row)
    },
    update: ({ where, data }: { where: Row; data: Row }) => {
      const [[wcol, wval]] = Object.entries(where)
      const sqlCol = wcol
      const setParts: string[] = []
      const params: any[] = []
      for (const [k, v] of Object.entries(data)) {
        setParts.push(`${k} = ?`)
        params.push(v)
      }
      params.push(wval)
      getDb()
        .prepare(`UPDATE ${table} SET ${setParts.join(', ')} WHERE ${sqlCol} = ?`)
        .run(...params)
      const row = getDb()
        .prepare(`SELECT * FROM ${table} WHERE ${sqlCol} = ?`)
        .get(wval) as Row
      return rowToCamel(row)
    },
    upsert: ({ where, update, create }: { where: Row; update: Row; create: Row }) => {
      const [[wcol, wval]] = Object.entries(where)
      const sqlCol = wcol
      const existing = getDb().prepare(`SELECT id FROM ${table} WHERE ${sqlCol} = ?`).get(wval) as { id: string } | undefined
      if (existing) {
        const setParts: string[] = []
        const params: any[] = []
        for (const [k, v] of Object.entries(update)) {
          setParts.push(`${k} = ?`)
          params.push(v)
        }
        params.push(wval)
        getDb()
          .prepare(`UPDATE ${table} SET ${setParts.join(', ')} WHERE ${sqlCol} = ?`)
          .run(...params)
      } else {
        const id = (create as Row).id ?? cid()
        const createdAt = (create as Row).createdAt ?? now()
        const fields: Row = { id, ...create, createdAt }
        const cols = Object.keys(fields)
        const placeholders = cols.map(() => '?').join(', ')
        const values = cols.map((c) => fields[c])
        getDb()
          .prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`)
          .run(...values)
      }
      return { id: (create as Row).id ?? existing?.id ?? wval }
    },
    delete: ({ where }: { where: Row }) => {
      const [[wcol, wval]] = Object.entries(where)
      const sqlCol = wcol
      getDb().prepare(`DELETE FROM ${table} WHERE ${sqlCol} = ?`).run(wval)
      return { id: wval }
    },
    count: ({ where }: { where?: Row } = {}) => {
      const whereSql: string[] = []
      const params: any[] = []
      if (where) {
        for (const [k, v] of Object.entries(where)) {
          if (v === null) {
            whereSql.push(`${k} IS NULL`)
          } else {
            whereSql.push(`${k} = ?`)
            params.push(v)
          }
        }
      }
      let sql = `SELECT COUNT(*) as n FROM ${table}`
      if (whereSql.length) sql += ` WHERE ${whereSql.join(' AND ')}`
      const row = getDb().prepare(sql).get(...params) as { n: number }
      return row?.n ?? 0
    },
  }
}

function withCount<T extends Row>(rows: T[], countField: string): (T & { _count: { [k: string]: number } })[] {
  return rows.map((r) => ({ ...r, _count: { [countField]: 0 } }))
}

class PrismaCompatClient {
  user = {
    ...buildFinder('users', 'id'),
    findMany: (args: any) => {
      const rows = buildFinder('users', 'id').findMany(args)
      if (args?.select?._count?.select?.studentProfiles) {
        return rows.map((u: any) => ({
          ...u,
          _count: { profiles: getDb().prepare('SELECT COUNT(*) as n FROM student_profiles WHERE parentId = ?').get(u.id)?.n ?? 0 },
        }))
      }
      return rows
    },
  }
  studentProfile = {
    ...buildFinder('student_profiles', 'id'),
    findUnique: (args: any) => {
      const row = buildFinder('student_profiles', 'id').findUnique(args)
      return row
    },
  }
  mistakeRecord = buildFinder('mistake_records', 'id')
  mistakeBook = buildFinder('mistake_book', 'id')
  // usage_events has no `id` column in the schema (wait — it does, it's
  // a UUID primary key), so buildFinder works as-is. The `eventName`
  // column is what we filter on in /api/admin/stats.
  usageEvent = buildFinder('usage_events', 'id')
  parentInviteCode = buildFinder('parent_invite_codes', 'id')
  parentBinding = buildFinder('parent_bindings', 'id')
  parentAiInsight = buildFinder('parent_ai_insights', 'id')
  integrationJob = buildFinder('integration_jobs', 'id')
  systemConfig = {
    ...buildFinder('system_config', 'key'),
    findUnique: (args: any) => buildFinder('system_config', 'key').findUnique(args),
    // `system_config` is keyed by `key` (TEXT PRIMARY KEY) and has no `id`
    // column, unlike the other tables that the generic `buildFinder` was
    // written for. The shared upsert helper auto-injects a synthetic `id`
    // into the `create` payload, which then explodes with
    // `SqliteError: no such column: id` at INSERT time. Implement upsert
    // locally for this table so we only ever touch the real columns.
    upsert: ({ where, update, create }: { where: Row; update: Row; create: Row }) => {
      const [[wcol, wval]] = Object.entries(where)
      const sqlCol = wcol
      const existing = getDb()
        .prepare(`SELECT key FROM system_config WHERE ${sqlCol} = ?`)
        .get(wval) as { key: string } | undefined
      if (existing) {
        const setParts: string[] = []
        const params: any[] = []
        for (const [k, v] of Object.entries(update)) {
          setParts.push(`${k} = ?`)
          params.push(v)
        }
        params.push(wval)
        getDb()
          .prepare(
            `UPDATE system_config SET ${setParts.join(', ')} WHERE ${sqlCol} = ?`,
          )
          .run(...params)
      } else {
        const cols = Object.keys(create)
        const placeholders = cols.map(() => '?').join(', ')
        const values = cols.map((c) => (create as Row)[c])
        getDb()
          .prepare(
            `INSERT INTO system_config (${cols.join(', ')}) VALUES (${placeholders})`,
          )
          .run(...values)
      }
      return { key: wval }
    },
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __studymateDb: PrismaCompatClient | undefined
}

// Hot-reload safety: when Next.js dev re-evaluates this module, the
// cached singleton (`globalThis.__studymateDb`) may pre-date the
// current class definition and therefore be missing fields that
// have been added since. Detect that case and re-instantiate so
// freshly-added properties (e.g. `parentInviteCode`) are actually
// present on the live object. This branch is dev-only — in
// production we keep the cache so multiple imports stay in sync.
let __cachedDb = globalThis.__studymateDb
if (
  process.env.NODE_ENV !== 'production' &&
  __cachedDb &&
  typeof (__cachedDb as unknown as { parentInviteCode?: unknown })
    .parentInviteCode === 'undefined'
) {
  __cachedDb = undefined
}
export const db: PrismaCompatClient = __cachedDb ?? new PrismaCompatClient()
if (process.env.NODE_ENV !== 'production') globalThis.__studymateDb = db
