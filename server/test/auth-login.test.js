import { describe, it, expect } from 'vitest';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db.js';

describe('POST /api/auth/login', () => {
  it('sets a session cookie for the correct password and rejects a wrong one', async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mixtape-auth-'));
    const db = createDb(path.join(dataDir, 'mixtape.db'));
    const passwordHash = await bcrypt.hash('correct-horse', 10);
    const app = createApp({ db, sessionSecret: 'secret', passwordHash, tracksDir: path.join(dataDir, 'tracks') });

    const ok = await request(app).post('/api/auth/login').send({ password: 'correct-horse' }).expect(200);
    expect(ok.headers['set-cookie'][0]).toContain('mixtape_session=');

    await request(app).post('/api/auth/login').send({ password: 'wrong' }).expect(401);

    fs.rmSync(dataDir, { recursive: true, force: true });
  });
});
