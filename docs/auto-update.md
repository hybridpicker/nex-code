# Automatic Update System

Nex Code includes an automatic update checking system that notifies users when a new version is available.

## How It Works

1. Once per day, when you start Nex Code, it checks the npm registry for the latest version
2. If a newer version is available, you'll see a notification like:
   ```
   💡 New version available! Run npm update -g nex-code to upgrade from 0.3.4 to 0.3.5
   ```
3. The check happens in the background and doesn't slow down startup significantly

## Configuration

The update checker creates a file `.nex/last-version-check` to remember when it last checked for updates. This prevents excessive API calls to the npm registry.

## Disabling Update Checks

If you want to disable the update check, you can set an environment variable:

```bash
NEX_DISABLE_UPDATE_CHECK=1 nex-code
```

## Automatic Publishing Workflow

When merging from `devel` to `main`, the following happens automatically:

1. Version is bumped (patch increment)
2. Changes are committed
3. Package is published to npm
4. GitHub Actions creates a release

This workflow ensures that every merge to main results in a new version being published.