import Database from "better-sqlite3";
import path from "path";
import type { GameId, ScoreEntry } from "./types";

const DB_PATH = path.join(process.cwd(), "data", "cuddle.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    const fs = require("fs");
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.exec(`
      CREATE TABLE IF NOT EXISTS scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game TEXT NOT NULL,
        nickname TEXT NOT NULL,
        score INTEGER NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);
  }
  return _db;
}

export function saveScore(entry: Omit<ScoreEntry, "id" | "created_at">) {
  const db = getDb();
  db.prepare(
    "INSERT INTO scores (game, nickname, score) VALUES (?, ?, ?)"
  ).run(entry.game, entry.nickname, entry.score);
}

export function getTop10(game: GameId): ScoreEntry[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT game, nickname, MAX(score) as score
       FROM scores WHERE game = ?
       GROUP BY nickname
       ORDER BY score DESC
       LIMIT 10`
    )
    .all(game) as ScoreEntry[];
}
