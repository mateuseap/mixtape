# Contributing

## Workflow

- Branch off `develop`, open a PR into `develop`.
- Releases go from `develop` to `main` via a release PR, tagged with semver (`vX.Y.Z`) on merge.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`, etc.).

## Before opening a PR

```bash
pnpm install
pnpm test
pnpm build
```

All three must pass. CI re-runs them on every PR.

## Secrets

Never commit `.env`. `.env.example` documents the required variables.
