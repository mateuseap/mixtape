<div align="center">

# 🎵 Mixtape

**Your MP3s, your server, a 3D player.**
Open, no-login library · Upload and stream your own files · No subscriptions.

[![CI](https://github.com/mateuseap/mixtape/actions/workflows/ci.yml/badge.svg)](https://github.com/mateuseap/mixtape/actions)
[![Publish Images](https://github.com/mateuseap/mixtape/actions/workflows/publish-images.yml/badge.svg)](https://github.com/mateuseap/mixtape/actions)
[![version](https://badgen.net/github/tag/mateuseap/mixtape?label=version&color=96bc4b)](https://github.com/mateuseap/mixtape/releases)
[![license](https://badgen.net/github/license/mateuseap/mixtape?color=5ba3b0)](LICENSE)
[![stars](https://badgen.net/github/stars/mateuseap/mixtape)](https://github.com/mateuseap/mixtape/stargazers)
[![visitors](https://visitor-badge.laobi.icu/badge?page_id=mateuseap.mixtape)](https://github.com/mateuseap/mixtape)

<br />

<img src="docs/assets/preview.png" width="720" alt="Mixtape: an interactive 3D MP3 player" />

<br />

</div>

---

## Why Mixtape?

Streaming services do not keep your files, and existing self-hosted media servers are built for entire collections with transcoding, users, and settings you do not need for a personal MP3 folder. Mixtape is a small, single-purpose alternative: upload MP3s, get a real-time 3D player, keep everything on your own server.

- **Your files.** MP3s live on your server, not a third party's.
- **Interactive 3D UI.** A WebGL device you can drag to rotate, with a live LCD readout of the current track. The click wheel is genuinely clickable: center to play/pause, and up/down/left/right for volume and skip, like a real click wheel, instead of a generic table.
- **Open library.** No accounts, no password gate. Anyone with access to the app can add or play tracks.

## Features

|  |  |
|--|--|
| 🎛 **Clickable 3D device** | A draggable, auto-rotating WebGL click wheel with printed icons at every zone: play/pause in the center, volume and skip at top/bottom/left/right, exactly like a real click wheel |
| 📤 **Drop-in uploads** | Pick an MP3 and it appears in the library immediately, no form fields required |
| 🏷 **Automatic tagging** | ID3 title/artist/album/duration parsed on upload, falls back to the filename |
| ⏩ **Real seeking** | HTTP Range-request streaming, so scrubbing does not need the whole file downloaded |
| 🔀 **Shuffle & repeat** | Standard playback modes, no page reload |
| 🌍 **Open by default** | No accounts, no password, anyone with the link can add and play |

## Quick Start

```bash
git clone https://github.com/mateuseap/mixtape && cd mixtape
pnpm install
cp .env.example server/.env
pnpm dev
```

Open `http://localhost:5173`, no login step needed.

## How It Works

A single Node/Express service serves the built client and a small JSON API from one process. Uploaded MP3 files and a SQLite metadata database live on disk (`DATA_DIR`, mounted from a persistent volume in production). ID3 tags are parsed on upload for title, artist, album, and duration, falling back to the filename when tags are missing. Playback uses HTTP Range requests so seeking and scrubbing work without loading the whole file.

## Stack

| Layer | Technology |
|-------|-----------|
| Server | Node 22, Express, better-sqlite3, multer, music-metadata |
| Client | Vite, vanilla JavaScript, no framework, three.js |
| Auth | None, open access library |
| Tests | vitest, supertest |
| Deploy | Docker, GitHub Actions to GHCR |

## Documentation

| Doc | Description |
|-----|------------|
| [Design Spec](https://github.com/mateuseap/homelab/blob/main/docs/specs/2026-07-25-mixtape-design.md) | Architecture decisions and rationale |
| [Deployment Manifests](https://github.com/mateuseap/homelab/tree/main/apps/mixtape) | Kubernetes Deployment, Service, Ingress, PVC |

Mixtape's design docs live in the [homelab](https://github.com/mateuseap/homelab) repo, alongside every other app it deploys, rather than in this repo.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a PR. Branch from `develop`, use Conventional Commits, keep the test suite green, and assign **@mateuseap** for review.

## License

MIT, see [LICENSE](LICENSE).
