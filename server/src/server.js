import { createApp } from './app.js';
import { createDb } from './db.js';

const dataDir = process.env.DATA_DIR || '/data';
const port = process.env.PORT || 3000;

const db = createDb(`${dataDir}/mixtape.db`);
const app = createApp({
  db,
  tracksDir: `${dataDir}/tracks`,
});

app.listen(port, () => {
  console.log(`mixtape listening on :${port}`);
});
