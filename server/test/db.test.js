import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createDb, insertTrack, listTracks, getTrack, deleteTrackRow } from '../src/db.js';

let dbPath;
let db;

beforeEach(() => {
  dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mixtape-')), 'test.db');
  db = createDb(dbPath);
});

afterEach(() => {
  db.close();
  fs.rmSync(path.dirname(dbPath), { recursive: true, force: true });
});

describe('db', () => {
  it('inserts and lists tracks newest first', () => {
    insertTrack(db, { id: '1', title: 'A', artist: null, album: null, duration: 1, filename: 'a.mp3', uploadedAt: '2026-01-01T00:00:00.000Z' });
    insertTrack(db, { id: '2', title: 'B', artist: null, album: null, duration: 2, filename: 'b.mp3', uploadedAt: '2026-01-02T00:00:00.000Z' });
    const rows = listTracks(db);
    expect(rows.map((r) => r.id)).toEqual(['2', '1']);
  });

  it('gets a track by id', () => {
    insertTrack(db, { id: '1', title: 'A', artist: null, album: null, duration: 1, filename: 'a.mp3', uploadedAt: '2026-01-01T00:00:00.000Z' });
    expect(getTrack(db, '1').title).toBe('A');
    expect(getTrack(db, 'missing')).toBeUndefined();
  });

  it('deletes a track and reports whether it existed', () => {
    insertTrack(db, { id: '1', title: 'A', artist: null, album: null, duration: 1, filename: 'a.mp3', uploadedAt: '2026-01-01T00:00:00.000Z' });
    expect(deleteTrackRow(db, '1')).toBe(true);
    expect(deleteTrackRow(db, '1')).toBe(false);
    expect(listTracks(db)).toHaveLength(0);
  });
});
