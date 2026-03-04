# Release Process

This document describes the automated release process for Nex Code.

## Automated Release Workflow

1. **Development**: Features and fixes are developed on the `devel` branch
2. **Merge to Main**: When ready, `devel` is merged to `main`
3. **Automatic Version Bump**: The post-merge hook automatically bumps the patch version
4. **Publish**: The updated package is automatically published to npm
5. **GitHub Release**: GitHub Actions creates a release with release notes

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