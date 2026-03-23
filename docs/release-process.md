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
5. **GitHub Release**: GitHub Actions creates a release with release notes
6. **Sync**: The post-merge hook merges the version bump back to devel

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

## Environment Variables

- `NEX_DISABLE_UPDATE_CHECK=1` - Disable automatic update checking
- `NEX_SKIP_SECRET_CHECK=1` - Skip secret checking in pre-push hook

## Version Checking

Nex Code checks for new versions once per day when started. Users will see a notification if a new version is available.
