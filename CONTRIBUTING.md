# Contributing to Mixtape

Thank you for considering a contribution!

## Getting Started

1. Fork the repository.
2. `pnpm install`, then `pnpm dev` (server on `:3000`, Vite client on `http://localhost:5173`).
3. Read [docs/specs](https://github.com/mateuseap/homelab/tree/main/docs/specs) in the `homelab` repo for the design decisions behind this app.

## What to Work On

- Check the open [GitHub Issues](https://github.com/mateuseap/mixtape/issues).
- Feature requests are welcome. Open an issue to discuss before implementing anything large.
- Bug reports: include steps to reproduce, expected vs. actual behavior, and browser/OS.

## Workflow

- Branch off `develop`, open a PR into `develop`.
- Releases go from `develop` to `main` via a release PR, tagged with semver (`vX.Y.Z`) on merge. Every push to `main` builds and publishes `ghcr.io/mateuseap/mixtape`.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`, etc.). Do not add AI attribution or co-author footers.

## Code Style

- Plain JavaScript, no TypeScript, no framework on the client. Keep it that way; this app's whole point is a small surface area.
- Immutable player state: `client/src/player.js` returns new state objects, never mutates.
- Many small, focused files over large ones.
- No `console.log` in production paths, and no secrets in code.

## Before Opening a PR

```bash
pnpm install
pnpm test
pnpm build
```

All three must pass. CI re-runs them on every PR. If your change touches `client/src/scene.js`, also do a manual visual check (`pnpm --filter client dev`, open the browser, confirm the device renders and drag-to-rotate works) since the 3D scene has no automated visual regression test.

## Pull Request Process

1. Branch from `develop`.
2. Ensure `pnpm test` and `pnpm build` both pass.
3. Confirm no secrets or `.env` files are committed (`.env.example` documents the required variables, there is no password to manage since the app has no auth).
4. Open a PR targeting `develop`. Assign **@mateuseap** as reviewer.
5. Give the PR a clear title (Conventional Commits style) and a description with a **Summary** and a **Test plan**.

## Reporting Security Issues

Do not open a public issue for a security vulnerability. Email `mateuseap@mateuseap.com` with details.

## License

By contributing, you agree your contributions are licensed under the [MIT License](./LICENSE).
