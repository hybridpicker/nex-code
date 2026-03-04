# Development Workflow for Nex-Code

## Branch Strategy

- **main**: Production-ready code (stable releases)
- **devel**: Development branch for ongoing work and testing
- **feature branches**: Optional, for complex features (branched off devel)

## Workflow Process

1. Create feature branches from `devel` for significant changes
2. Develop and test in feature branches or directly in `devel`
3. Merge completed features into `devel`
4. Thoroughly test in `devel` environment
5. When ready for release, merge `devel` into `main`
6. Tag releases and publish to npm from `main`

## Version Management

- Use semantic versioning (MAJOR.MINOR.PATCH)
- **Auto-bump**: When merging `devel` into `main`, the `post-merge` hook automatically runs `npm version patch` and commits the bump
- Manual version changes are only needed for minor/major bumps
- Document changes in commit messages

## Testing Process

1. Run unit tests: `npm test`
2. Ensure coverage remains high (>90% statements)
3. Manual testing of CLI functionality
4. Integration testing with different providers

## Release Process

1. Ensure all tests pass in `devel`
2. Merge `devel` into `main`: `git checkout main && git merge devel`
3. Version is automatically bumped (patch) by the `post-merge` hook
4. For minor/major bumps: manually run `npm version minor` or `npm version major`
5. Create git tag: `git tag -a vX.Y.Z -m "Release X.Y.Z"`
6. Push to repository: `git push origin main --tags`
7. Publish to npm: `npm publish`
8. Return to development: `git checkout devel && git merge main`

## Handling Merge Conflicts

If merge conflicts occur during the merge from `devel` to `main`:

1. Checkout to main: `git checkout main`
2. Attempt merge: `git merge devel`
3. Resolve conflicts manually in conflicted files
4. **Important**: Stage resolved files with `git add <resolved-files>` — forgetting this causes the merge to stay incomplete
5. Complete merge: `git commit`
6. Push changes: `git push origin main`

**Startup detection**: nex-code detects unresolved merge conflicts at startup and displays a red warning listing affected files. The LLM context also includes conflict info so the agent won't attempt edits on conflicted files.

## Git Hooks

Install all hooks with:
```bash
npm run install-hooks
```

| Hook | Purpose |
|------|---------|
| `pre-push` | Scans pushed commits for secrets (API keys, tokens, private keys) and blocks the push if found |
| `post-merge` | On `devel→main` merge: auto-bumps patch version and commits. On any merge with `package.json` changes: runs `npm install` |