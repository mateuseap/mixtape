import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

export function createDb(dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS tracks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      artist TEXT,
      album TEXT,
      duration REAL,
      filename TEXT NOT NULL,
      uploaded_at TEXT NOT NULL
    )
  `);
  return db;
}

export function insertTrack(db, track) {
  db.prepare(`
    INSERT INTO tracks (id, title, artist, album, duration, filename, uploaded_at)
    VALUES (@id, @title, @artist, @album, @duration, @filename, @uploadedAt)
  `).run(track);
  return track;
}

export function listTracks(db) {
  return db
    .prepare('SELECT id, title, artist, album, duration, filename, uploaded_at as uploadedAt FROM tracks ORDER BY uploaded_at DESC')
    .all();
}

export function getTrack(db, id) {
  return db
    .prepare('SELECT id, title, artist, album, duration, filename, uploaded_at as uploadedAt FROM tracks WHERE id = ?')
    .get(id);
}

export function deleteTrackRow(db, id) {
  const result = db.prepare('DELETE FROM tracks WHERE id = ?').run(id);
  return result.changes > 0;
}
