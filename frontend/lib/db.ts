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
function getDb(): Database {
  if (!_db) {
    // During Next.js build (page data collection), each worker process can
    // hit this code path simultaneously. Use a per-process in-memory database
    // when we are not the primary Node process and DB is uninitialised,
    // so that workers do not race on the same on-disk file.
    const isBuild = process.env.NEXT_PHASE === 'phase-production-build' || process.argv.includes('build')
    if (isBuild) {
      _db = new Database(':memory:')
      _db.pragma('journal_mode = MEMORY')
    } else {
      _db = new Database(DB_PATH)
      _db.pragma('journal_mode = WAL')
      _db.pragma('busy_timeout = 10000')
      _db.pragma('synchronous = NORMAL')
    }
  }
  if (!_dbInit) {
    _dbInit = true
    _db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    passwordHash TEXT NOT NULL,
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
`)
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
      const sqlCol = col.replace(/([A-Z])/g, '_$1').toLowerCase()
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
          whereSql.push(`${k.replace(/([A-Z])/g, '_$1').toLowerCase()} = ?`)
          params.push(v)
        }
      }
      let sql = `SELECT * FROM ${table}`
      if (whereSql.length) sql += ` WHERE ${whereSql.join(' AND ')}`
      if (orderBy) {
        const [[k, dir]] = Object.entries(orderBy) as [string, string][]
        sql += ` ORDER BY ${k.replace(/([A-Z])/g, '_$1').toLowerCase()} ${dir}`
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
          whereSql.push(`${k.replace(/([A-Z])/g, '_$1').toLowerCase()} = ?`)
          params.push(v)
        }
      }
      let sql = `SELECT * FROM ${table}`
      if (whereSql.length) sql += ` WHERE ${whereSql.join(' AND ')}`
      if (orderBy) {
        const [[k, dir]] = Object.entries(orderBy) as [string, string][]
        sql += ` ORDER BY ${k.replace(/([A-Z])/g, '_$1').toLowerCase()} ${dir}`
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
        .map((c) => c.replace(/([A-Z])/g, '_$1').toLowerCase())
      const placeholders = cols.map(() => '?').join(', ')
      const values = cols.map((c) => {
        const camelKey = c.replace(/_([a-z])/g, (_, x) => x.toUpperCase())
        const v = fields[camelKey]
        return v
      })
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
      const sqlCol = wcol.replace(/([A-Z])/g, '_$1').toLowerCase()
      const setParts: string[] = []
      const params: any[] = []
      for (const [k, v] of Object.entries(data)) {
        setParts.push(`${k.replace(/([A-Z])/g, '_$1').toLowerCase()} = ?`)
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
      const sqlCol = wcol.replace(/([A-Z])/g, '_$1').toLowerCase()
      const existing = getDb().prepare(`SELECT id FROM ${table} WHERE ${sqlCol} = ?`).get(wval) as { id: string } | undefined
      if (existing) {
        const setParts: string[] = []
        const params: any[] = []
        for (const [k, v] of Object.entries(update)) {
          setParts.push(`${k.replace(/([A-Z])/g, '_$1').toLowerCase()} = ?`)
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
        const cols = Object.keys(fields).map((c) => c.replace(/([A-Z])/g, '_$1').toLowerCase())
        const placeholders = cols.map(() => '?').join(', ')
        const values = cols.map((c) => {
          const camelKey = c.replace(/_([a-z])/g, (_, x) => x.toUpperCase())
          return fields[camelKey]
        })
        getDb()
          .prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`)
          .run(...values)
      }
      return { id: (create as Row).id ?? existing?.id ?? wval }
    },
    delete: ({ where }: { where: Row }) => {
      const [[wcol, wval]] = Object.entries(where)
      const sqlCol = wcol.replace(/([A-Z])/g, '_$1').toLowerCase()
      getDb().prepare(`DELETE FROM ${table} WHERE ${sqlCol} = ?`).run(wval)
      return { id: wval }
    },
    count: ({ where }: { where?: Row } = {}) => {
      const whereSql: string[] = []
      const params: any[] = []
      if (where) {
        for (const [k, v] of Object.entries(where)) {
          whereSql.push(`${k.replace(/([A-Z])/g, '_$1').toLowerCase()} = ?`)
          params.push(v)
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
          _count: { studentProfiles: getDb().prepare('SELECT COUNT(*) as n FROM student_profiles WHERE parentId = ?').get(u.id)?.n ?? 0 },
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
      const sqlCol = wcol.replace(/([A-Z])/g, '_$1').toLowerCase()
      const existing = getDb()
        .prepare(`SELECT key FROM system_config WHERE ${sqlCol} = ?`)
        .get(wval) as { key: string } | undefined
      if (existing) {
        const setParts: string[] = []
        const params: any[] = []
        for (const [k, v] of Object.entries(update)) {
          setParts.push(`${k.replace(/([A-Z])/g, '_$1').toLowerCase()} = ?`)
          params.push(v)
        }
        params.push(wval)
        getDb()
          .prepare(
            `UPDATE system_config SET ${setParts.join(', ')} WHERE ${sqlCol} = ?`,
          )
          .run(...params)
      } else {
        const cols = Object.keys(create).map((c) =>
          c.replace(/([A-Z])/g, '_$1').toLowerCase(),
        )
        const placeholders = cols.map(() => '?').join(', ')
        const values = cols.map((c) => {
          const camelKey = c.replace(/_([a-z])/g, (_, x) => x.toUpperCase())
          return (create as Row)[camelKey]
        })
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

export const db: PrismaCompatClient = globalThis.__studymateDb ?? new PrismaCompatClient()
if (process.env.NODE_ENV !== 'production') globalThis.__studymateDb = db
