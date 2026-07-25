<div align="center">

# 🎵 Mixtape

**Your MP3s, your server, a retro player.**
Password-gated library · Upload and stream your own files · No subscriptions.

[![CI](https://github.com/mateuseap/mixtape/actions/workflows/ci.yml/badge.svg)](https://github.com/mateuseap/mixtape/actions)
[![version](https://img.shields.io/github/v/tag/mateuseap/mixtape?sort=semver&style=flat-square&label=version&color=35d0a5)](https://github.com/mateuseap/mixtape/releases)
[![license](https://img.shields.io/github/license/mateuseap/mixtape?style=flat-square&color=5ba3b0)](LICENSE)
[![stars](https://img.shields.io/github/stars/mateuseap/mixtape?style=flat-square)](https://github.com/mateuseap/mixtape/stargazers)

<br />

</div>

---

## Why Mixtape?

Streaming services do not keep your files, and existing self-hosted media servers are built for entire collections with transcoding, users, and settings you do not need for a personal MP3 folder. Mixtape is a small, single-purpose alternative: upload MP3s, get a retro player, keep everything on your own server.

- **Your files.** MP3s live on your server, not a third party's.
- **Retro UI.** A player styled after 2000s MP3 players, not a generic table.
- **One password.** No accounts, no OAuth, just a shared password gate.

## Quick start

```bash
git clone https://github.com/mateuseap/mixtape && cd mixtape
pnpm install
cp .env.example server/.env # fill in SESSION_SECRET and PASSWORD_HASH
pnpm dev
```

`PASSWORD_HASH` is a bcrypt hash: `node -e "require('bcryptjs').hash('your-password', 10).then(console.log)"`.

## How it works

A single Node/Express service serves the built client and a small JSON API from one process. Uploaded MP3 files and a SQLite metadata database live on disk (`DATA_DIR`, mounted from a persistent volume in production). ID3 tags are parsed on upload for title, artist, album, and duration, falling back to the filename when tags are missing. Playback uses HTTP Range requests so seeking and scrubbing work without loading the whole file.

## Stack

| Layer | Technology |
|-------|-----------|
| Server | Node 22, Express, better-sqlite3, multer, music-metadata |
| Client | Vite, vanilla JavaScript, no framework |
| Auth | Single shared password, signed httpOnly session cookie |
| Tests | vitest, supertest |
| Deploy | Docker, GitHub Actions to GHCR |

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a PR.

## License

MIT, see [LICENSE](LICENSE).
