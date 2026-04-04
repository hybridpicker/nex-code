# Release Process

This document describes the automated release process for Nex Code.

## Automated Release Workflow

1. **Development**: Features and fixes are developed on the `devel` branch
2. **Merge to Main**: Run `npm run merge-to-main` from the `devel` branch
   - Waits for CI to pass on the current devel HEAD (polls GitHub Actions)
   - Aborts immediately if CI fails — broken code never reaches main
   - Merges into main once CI is green
3. **Automatic Version Bump**: The post-merge hook bumps the patch version and pushes main
4. **Publish**: GitHub Actions Release workflow publishes to npm automatically
5. **GitHub Release**: GitHub Actions creates a release with release notes and attaches the VS Code extension `.vsix`
6. **VS Code Extension**: Built and packaged automatically — `.vsix` attached to the GitHub Release for manual install; also published to the VS Code Marketplace if `VSCE_PAT` secret is set
7. **Sync**: The post-merge hook merges the version bump back to devel (including `vscode/package.json` version sync)

## Merge Command

```bash
npm run merge-to-main
```

Must be run from the `devel` branch with a clean working tree. Requires the
`gh` CLI to be installed and authenticated (`gh auth login`).

## Manual Release Process

If you need to manually create a release:

```bash
npm run release
```

This command will:

1. Bump the patch version
2. Create a git tag
3. Push to GitHub
4. Publish to npm

## VS Code Extension

The extension in `vscode/` is built and versioned automatically:

- Version is synced from root `package.json` by the post-merge hook
- `.vsix` is attached to every GitHub Release — install via `code --install-extension nex-code-x.y.z.vsix`
- To also publish to the VS Code Marketplace, add a `VSCE_PAT` secret to the GitHub repo (Settings → Secrets → Actions)

Stale `.vsix` files must never be committed — `vscode/*.vsix` is in `.gitignore`.

## Environment Variables

- `NEX_DISABLE_UPDATE_CHECK=1` - Disable automatic update checking
- `NEX_SKIP_SECRET_CHECK=1` - Skip secret checking in pre-push hook

## Version Checking

Nex Code checks for new versions once per day when started. Users will see a notification if a new version is available.
