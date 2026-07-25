import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireAuth, createAuthRouter } from './auth.js';
import { createTracksRouter } from './tracks.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp({ db, sessionSecret, passwordHash, tracksDir }) {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
  app.use('/api/auth', createAuthRouter({ sessionSecret, passwordHash }));
  app.use('/api/tracks', requireAuth(sessionSecret), createTracksRouter({ db, tracksDir }));

  const publicDir = path.join(__dirname, '..', 'public');
  app.use(express.static(publicDir));
  app.get('*', (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  return app;
}
