import { createApp } from './app.js';
import { createDb } from './db.js';

const dataDir = process.env.DATA_DIR || '/data';
const port = process.env.PORT || 3000;
const sessionSecret = process.env.SESSION_SECRET;
const passwordHash = process.env.PASSWORD_HASH;

if (!sessionSecret || !passwordHash) {
  console.error('SESSION_SECRET and PASSWORD_HASH must be set');
  process.exit(1);
}

const db = createDb(`${dataDir}/mixtape.db`);
const app = createApp({
  db,
  sessionSecret,
  passwordHash,
  tracksDir: `${dataDir}/tracks`,
});

app.listen(port, () => {
  console.log(`mixtape listening on :${port}`);
});
