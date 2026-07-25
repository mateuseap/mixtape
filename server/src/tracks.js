import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseFile } from 'music-metadata';
import { insertTrack, listTracks, getTrack, deleteTrackRow } from './db.js';
import { streamTrackFile } from './stream.js';

function isMp3(file) {
  return file.mimetype === 'audio/mpeg' || file.originalname.toLowerCase().endsWith('.mp3');
}

export function createTracksRouter({ db, tracksDir }) {
  const router = Router();
  fs.mkdirSync(tracksDir, { recursive: true });

  const upload = multer({
    storage: multer.diskStorage({
      destination: tracksDir,
      filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}.mp3`),
    }),
    fileFilter: (req, file, cb) => cb(null, isMp3(file)),
    limits: { fileSize: 100 * 1024 * 1024 },
  });

  router.get('/', (req, res) => {
    res.json(listTracks(db));
  });

  router.post('/', upload.single('file'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'a .mp3 file is required' });
    }
    let title = path.parse(req.file.originalname).name;
    let artist = null;
    let album = null;
    let duration = null;
    try {
      const meta = await parseFile(req.file.path);
      title = meta.common.title || title;
      artist = meta.common.artist || null;
      album = meta.common.album || null;
      duration = meta.format.duration || null;
    } catch {
      // unreadable id3 tags: keep the filename-derived title
    }
    const track = insertTrack(db, {
      id: crypto.randomUUID(),
      title,
      artist,
      album,
      duration,
      filename: req.file.filename,
      uploadedAt: new Date().toISOString(),
    });
    res.status(201).json(track);
  });

  router.get('/:id/stream', (req, res) => {
    const track = getTrack(db, req.params.id);
    if (!track) return res.status(404).json({ error: 'not found' });
    const filePath = path.join(tracksDir, track.filename);
    const { size } = fs.statSync(filePath);
    streamTrackFile(req, res, filePath, size);
  });

  router.delete('/:id', (req, res) => {
    const track = getTrack(db, req.params.id);
    if (!track) return res.status(404).json({ error: 'not found' });
    fs.rmSync(path.join(tracksDir, track.filename), { force: true });
    deleteTrackRow(db, req.params.id);
    res.status(204).end();
  });

  return router;
}
