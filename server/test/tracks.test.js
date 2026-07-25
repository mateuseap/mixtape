import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db.js';
import { createSessionToken, COOKIE_NAME } from '../src/auth.js';

let dataDir;
let app;
let sessionCookie;
const SECRET = 'test-secret';

beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mixtape-int-'));
  const db = createDb(path.join(dataDir, 'mixtape.db'));
  app = createApp({
    db,
    sessionSecret: SECRET,
    passwordHash: '$irrelevant$',
    tracksDir: path.join(dataDir, 'tracks'),
  });
  sessionCookie = `${COOKIE_NAME}=${createSessionToken(SECRET)}`;
});

afterEach(() => {
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe('tracks API', () => {
  it('rejects requests without a valid session', async () => {
    await request(app).get('/api/tracks').expect(401);
  });

  it('uploads an mp3, lists it, streams it, then deletes it', async () => {
    const fixture = path.join(dataDir, 'fixture.mp3');
    fs.writeFileSync(fixture, Buffer.from([0xff, 0xfb, 0x90, 0x00]));

    const upload = await request(app)
      .post('/api/tracks')
      .set('Cookie', sessionCookie)
      .attach('file', fixture, { filename: 'My Song.mp3', contentType: 'audio/mpeg' })
      .expect(201);

    expect(upload.body.title).toBe('My Song');
    const id = upload.body.id;

    const list = await request(app).get('/api/tracks').set('Cookie', sessionCookie).expect(200);
    expect(list.body).toHaveLength(1);

    await request(app).get(`/api/tracks/${id}/stream`).set('Cookie', sessionCookie).expect(200);

    await request(app).delete(`/api/tracks/${id}`).set('Cookie', sessionCookie).expect(204);
    const after = await request(app).get('/api/tracks').set('Cookie', sessionCookie).expect(200);
    expect(after.body).toHaveLength(0);
  });

  it('rejects non-mp3 uploads', async () => {
    const fixture = path.join(dataDir, 'fixture.txt');
    fs.writeFileSync(fixture, 'not audio');
    await request(app)
      .post('/api/tracks')
      .set('Cookie', sessionCookie)
      .attach('file', fixture, { filename: 'notes.txt', contentType: 'text/plain' })
      .expect(400);
  });

  it('returns 404 deleting a track that does not exist', async () => {
    await request(app).delete('/api/tracks/missing').set('Cookie', sessionCookie).expect(404);
  });
});
