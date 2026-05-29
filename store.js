// Persistent thread store for the local Express server.
// Primary backend: node:sqlite (Node >= 22.5) -> data/threads.db (survives restarts).
// Set DATA_DIR to relocate the database file (e.g. a mounted volume / external disk).
// Falls back to an in-memory Map if node:sqlite is unavailable (older Node).
const path = require("path");
const fs = require("fs");

let impl;
try {
  const { DatabaseSync } = require("node:sqlite");
  const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const dbPath = path.join(DATA_DIR, "threads.db");
  const db = new DatabaseSync(dbPath);
  db.exec(`CREATE TABLE IF NOT EXISTS threads (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    title        TEXT    NOT NULL,
    body         TEXT    NOT NULL,
    replies      TEXT    NOT NULL DEFAULT '[]',
    opName       TEXT    NOT NULL DEFAULT '',
    opId         TEXT    NOT NULL DEFAULT '',
    isPublic     INTEGER NOT NULL DEFAULT 0,
    isSafetyMode INTEGER NOT NULL DEFAULT 0,
    isSensitive  INTEGER NOT NULL DEFAULT 0,
    createdAt    TEXT    NOT NULL
  )`);
  // Migrate older DBs that predate the opName/opId columns
  const cols = db.prepare("PRAGMA table_info(threads)").all().map((c) => c.name);
  if (!cols.includes("opName")) db.exec("ALTER TABLE threads ADD COLUMN opName TEXT NOT NULL DEFAULT ''");
  if (!cols.includes("opId")) db.exec("ALTER TABLE threads ADD COLUMN opId TEXT NOT NULL DEFAULT ''");

  const row = (r) => r && {
    id: r.id, title: r.title, body: r.body,
    replies: JSON.parse(r.replies || "[]"),
    opName: r.opName || "", opId: r.opId || "",
    isPublic: !!r.isPublic, isSafetyMode: !!r.isSafetyMode, isSensitive: !!r.isSensitive,
    createdAt: r.createdAt,
  };

  impl = {
    backend: "node:sqlite",
    saveThread(t) {
      const info = db
        .prepare("INSERT INTO threads (title,body,replies,opName,opId,isPublic,isSafetyMode,isSensitive,createdAt) VALUES (?,?,?,?,?,?,?,?,?)")
        .run(t.title, t.body, JSON.stringify(t.replies || []), t.opName || "", t.opId || "",
          t.isPublic ? 1 : 0, t.isSafetyMode ? 1 : 0, t.isSensitive ? 1 : 0,
          new Date().toISOString());
      return Number(info.lastInsertRowid);
    },
    getThreads() {
      return db.prepare("SELECT * FROM threads ORDER BY id DESC").all().map(row);
    },
    getThread(id) {
      return row(db.prepare("SELECT * FROM threads WHERE id=?").get(id)) || null;
    },
    deleteThread(id) {
      db.prepare("DELETE FROM threads WHERE id=?").run(id);
    },
    setVisibility(id, pub) {
      db.prepare("UPDATE threads SET isPublic=? WHERE id=?").run(pub ? 1 : 0, id);
    },
    getPublicThreads(q) {
      q = (q || "").toLowerCase();
      const rows = q
        ? db.prepare("SELECT * FROM threads WHERE isPublic=1 AND lower(title) LIKE ? ORDER BY id DESC").all("%" + q + "%")
        : db.prepare("SELECT * FROM threads WHERE isPublic=1 ORDER BY id DESC").all();
      return rows.map(row);
    },
  };
  console.log("[store] node:sqlite ->", dbPath);
} catch (e) {
  console.warn("[store] node:sqlite unavailable, using ephemeral in-memory store:", e.message);
  const threads = new Map();
  let nextId = 1;
  impl = {
    backend: "memory",
    saveThread(t) { const id = nextId++; threads.set(id, { ...t, replies: t.replies || [], createdAt: new Date().toISOString() }); return id; },
    getThreads() { const a = []; threads.forEach((v, k) => a.push({ id: k, ...v })); return a.sort((x, y) => y.id - x.id); },
    getThread(id) { const v = threads.get(id); return v ? { id, ...v } : null; },
    deleteThread(id) { threads.delete(id); },
    setVisibility(id, pub) { const v = threads.get(id); if (v) v.isPublic = !!pub; },
    getPublicThreads(q) {
      q = (q || "").toLowerCase();
      const a = [];
      threads.forEach((v, k) => { if (v.isPublic && (!q || v.title.toLowerCase().includes(q))) a.push({ id: k, ...v }); });
      return a.sort((x, y) => y.id - x.id);
    },
  };
}

module.exports = impl;
