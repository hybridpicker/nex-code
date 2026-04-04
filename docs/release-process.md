# Release Process

This document describes the automated release process for Nex Code.

## Automated Release Workflow

1. **Development**: Features and fixes are developed on the `devel` branch
2. **Merge to Main**: Run `npm run merge-to-main` from the `devel` branch
   - Waits for CI to pass on the current devel HEAD (polls GitHub Actions)
   - Aborts immediately if CI fails — broken code never reaches main
   - Merges into main once CI is green
3. **Automatic Version Bump**: The post-merge hook bumps the patch version
   - Syncs version to `vscode/package.json` automatically
   - Pushes main — triggers GitHub Actions
4. **npm Publish**: GitHub Actions Release workflow publishes to npm
5. **GitHub Release**: Release notes generated from commit log
6. **VS Code Extension**: Built and packaged by GitHub Actions
   - `.vsix` attached to the GitHub Release as a downloadable asset
   - Also published to VS Code Marketplace if `VSCE_PAT` secret is set
7. **Sync**: Version bump merged back to devel, dist rebuilt and committed

## Merge Command

```bash
npm run merge-to-main
```

Must be run from the `devel` branch with a clean working tree. Requires the
`gh` CLI to be installed and authenticated (`gh auth login`).

## Pre-Push Checks

The pre-push hook runs three checks in order:

| Check | Local | CI | Bypass |
|---|---|---|---|
| Secret scan | always | always | `NEX_SKIP_SECRET_CHECK=1` |
| Unit tests (fast) | fast suite only | full suite | `NEX_SKIP_TESTS=1` |
| Benchmark gate | always | always | `NEX_SKIP_BENCHMARK=1` |

**Fast vs slow tests:** Integration tests (`git`, `ssh`, `hooks`, `tools`) spawn
real processes and take 80s+ locally. They are skipped in the local pre-push hook
but always run in CI. To force the full suite locally:

```bash
NEX_SLOW_TESTS=1 git push
```

Skip all checks (use only after CI has already validated the commit):

```bash
NEX_FAST_PUSH=1 git push
```

## VS Code Extension

The extension in `vscode/` is built and versioned automatically:

- Version is synced from root `package.json` by the post-merge hook on every release
- `.vsix` is attached to every GitHub Release — install via:
  ```bash
  code --install-extension nex-code-x.y.z.vsix
  ```
- To also publish to the VS Code Marketplace, add a `VSCE_PAT` secret:
  GitHub repo → Settings → Secrets and variables → Actions → `VSCE_PAT`

Stale `.vsix` files must never be committed — `vscode/*.vsix` is in `.gitignore`.

## Environment Variables

| Variable | Effect |
|---|---|
| `NEX_SKIP_SECRET_CHECK=1` | Skip secret scan in pre-push hook |
| `NEX_SKIP_TESTS=1` | Skip all tests in pre-push hook |
| `NEX_SLOW_TESTS=1` | Run full test suite locally (incl. integration tests) |
| `NEX_SKIP_BENCHMARK=1` | Skip benchmark gate in pre-push hook |
| `NEX_FAST_PUSH=1` | Skip all pre-push checks |
| `NEX_DISABLE_UPDATE_CHECK=1` | Disable automatic update checking at startup |

## Version Checking

Nex Code checks for new versions once per day when started. Users will see a
notification if a new version is available on npm.
