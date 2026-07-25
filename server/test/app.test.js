import { describe, it, expect } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db.js';

describe('app', () => {
  it('responds ok on the health check without auth', async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mixtape-app-'));
    const db = createDb(path.join(dataDir, 'mixtape.db'));
    const app = createApp({
      db,
      tracksDir: path.join(dataDir, 'tracks'),
    });
    await request(app).get('/api/health').expect(200, { status: 'ok' });
    fs.rmSync(dataDir, { recursive: true, force: true });
  });
});
