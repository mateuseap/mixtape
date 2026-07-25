import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTracksRouter } from './tracks.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp({ db, tracksDir }) {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
  app.use('/api/tracks', createTracksRouter({ db, tracksDir }));

  const publicDir = path.join(__dirname, '..', 'public');
  app.use(express.static(publicDir));
  app.get('*', (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  return app;
}
