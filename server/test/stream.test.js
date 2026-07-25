import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { streamTrackFile } from '../src/stream.js';

let filePath;
const content = Buffer.from('0123456789');

beforeAll(() => {
  filePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mixtape-stream-')), 'f.mp3');
  fs.writeFileSync(filePath, content);
});

afterAll(() => {
  fs.rmSync(path.dirname(filePath), { recursive: true, force: true });
});

function fakeRes() {
  const stream = new PassThrough();
  return Object.assign(stream, {
    statusCode: null,
    headers: null,
    writeHead(status, headers) {
      this.statusCode = status;
      this.headers = headers;
    },
  });
}

function collect(stream) {
  return new Promise((resolve) => {
    const chunks = [];
    stream.on('data', (c) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

describe('streamTrackFile', () => {
  it('returns the whole file with 200 when no Range header is sent', async () => {
    const res = fakeRes();
    streamTrackFile({ headers: {} }, res, filePath, content.length);
    const body = await collect(res);
    expect(res.statusCode).toBe(200);
    expect(body.toString()).toBe('0123456789');
  });

  it('returns a 206 partial slice for a valid Range header', async () => {
    const res = fakeRes();
    streamTrackFile({ headers: { range: 'bytes=2-4' } }, res, filePath, content.length);
    const body = await collect(res);
    expect(res.statusCode).toBe(206);
    expect(res.headers['Content-Range']).toBe('bytes 2-4/10');
    expect(body.toString()).toBe('234');
  });

  it('returns 416 for an out-of-range Range header', async () => {
    const res = fakeRes();
    streamTrackFile({ headers: { range: 'bytes=50-60' } }, res, filePath, content.length);
    expect(res.statusCode).toBe(416);
  });
});
