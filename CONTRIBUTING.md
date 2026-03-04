# Contributing to nex-code

Thanks for your interest in contributing!

## Getting Started

```bash
1. git clone https://github.com/hybridpicker/nex-code.git
2. cd nex-code
3. npm install
4. npm run build    # Build the high-performance bundle
5. cp .env.example .env
6. npm run install-hooks
```

> **Users** don't need to clone — just run `npx nex-code` or `npm install -g nex-code`.

## Development Workflow

1. Create a feature branch: `git checkout -b feat/my-feature`
2. Make your changes
3. Run the tests: `npm test`
4. Ensure all 1780+ tests pass and coverage stays above 85%
5. Build the bundle: `npm run build`
6. Commit with a descriptive message (e.g. `feat: add X`, `fix: resolve Y`)
7. Push and open a Pull Request against `main`

## Running Tests

```bash
npm test              # full suite with coverage
npm run test:watch    # watch mode during development
```

## Code Style

- No external linter config — keep it consistent with existing code
- Use `const` over `let` where possible
- Prefer early returns over deep nesting
- Keep functions focused and short

## Project Structure

```
bin/nex-code.js       # CLI entrypoint (wrapper)
cli/                  # All source code
cli/index-engine.js   # Fast file indexing (ripgrep/fallback)
cli/providers/        # Provider implementations
dist/                 # Final bundled CLI scripts
tests/                # Jest test files
```

## Adding a New Provider

1. Create `cli/providers/your-provider.js` extending `BaseProvider`
2. Register it in `cli/providers/registry.js`
3. Add pricing to `cli/costs.js`
4. Add model tiers to `cli/tool-tiers.js`
5. Write tests in `tests/providers/your-provider.test.js`

## Commit Convention

```
feat: add new feature
fix: resolve bug
docs: update documentation
test: add or update tests
refactor: restructure without behavior change
```

## Pull Requests

- Keep PRs focused — one feature or fix per PR
- Include tests for new functionality
- Update README if adding user-facing features
- All CI checks must pass before merge

## Reporting Issues

Use [GitHub Issues](https://github.com/hybridpicker/nex-code/issues) with:
- Steps to reproduce
- Expected vs actual behavior
- Node version and OS
- Provider and model (if relevant)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
