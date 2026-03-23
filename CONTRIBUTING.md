# Contributing to nex-code

Thanks for your interest in contributing! nex-code is an open, multi-provider CLI coding agent. We welcome contributions of all kinds.

## Quick Start

```bash
git clone https://github.com/hybridpicker/nex-code.git
cd nex-code
npm install
npm run build
cp .env.example .env
npm run install-hooks
npm test  # verify everything works
```

> **Users** don't need to clone — just run `npx nex-code` or `npm install -g nex-code`.

## Development Setup

### Prerequisites

- Node.js 20+
- npm 9+
- Git
- Optional: `gh` CLI for GitHub Actions tools

### Environment Variables

Copy `.env.example` to `.env` and configure at least one provider:

| Variable            | Description                            | Required     |
| ------------------- | -------------------------------------- | ------------ |
| `ANTHROPIC_API_KEY` | Anthropic API key                      | One of these |
| `OPENAI_API_KEY`    | OpenAI API key                         | is required  |
| `GEMINI_API_KEY`    | Google Gemini API key                  | for testing  |
| `OLLAMA_HOST`       | Ollama server URL (default: localhost) | Optional     |

### Running Tests

```bash
npm test                    # Full suite with coverage (~2000+ tests)
npm run test:watch          # Watch mode during development
npx jest tests/tools.test.js  # Run specific test file
npx jest --testPathPattern fuzzy  # Run tests matching pattern
```

Tests use Jest. Coverage target is >85%. All tests must pass before PR merge.

### Building

```bash
npm run build    # Build the dist bundle
```

The build creates `dist/nex-code.js` — a single-file bundle. Always rebuild after changing source files.

## Development Workflow

1. **Branch from `devel`**: `git checkout -b feat/my-feature devel`
2. **Make changes** in `cli/` directory
3. **Write tests** in `tests/` directory
4. **Run tests**: `npm test`
5. **Build**: `npm run build`
6. **Commit** with conventional message: `feat: add X`, `fix: resolve Y`
7. **Push** and open a Pull Request against `devel`

> Note: `main` is the release branch. PRs should target `devel`.

## Project Structure

```
bin/nex-code.js          # CLI entrypoint (wrapper)
cli/                     # All source code
  index.js               # Main REPL + slash commands
  agent.js               # Agentic loop (streaming + tool execution)
  tools.js               # Tool definitions + handlers (44 tools)
  tool-tiers.js          # Model capability tiers + edit modes
  tool-validator.js      # Tool argument validation
  context-engine.js      # Token management + context compression
  providers/             # Provider implementations
    registry.js          # Provider dispatch + model management
    anthropic.js         # Anthropic/Claude provider
    openai.js            # OpenAI provider
    gemini.js            # Google Gemini provider
    ollama.js            # Ollama provider
    local.js             # Local model provider
  skills.js              # Skills system (prompt + script skills)
  brain.js               # Knowledge base with keyword retrieval
  file-history.js        # Undo/redo + persistent history
  session.js             # Session save/load/resume
  diff.js                # Diff display + confirmation
  ssh.js                 # SSH connection management
  deploy-config.js       # Named deployment configs
  index-engine.js        # File index + content index
  plugins.js             # Plugin API (registerTool/registerHook)
  audit.js               # Tool execution audit logging
dist/                    # Built bundle
tests/                   # Jest test files
.nex/                    # Project-local config (gitignored)
```

## Adding a New Tool

1. Add the tool definition to `TOOL_DEFINITIONS` in `cli/tools.js`
2. Add the handler in the `_executeToolInner()` switch statement
3. Add the tool to appropriate tier lists in `cli/tool-tiers.js`
4. Write tests in `tests/tools.test.js`
5. Update the tool count in `tests/tool-format.test.js` if it uses exact count

## Adding a New Provider

1. Create `cli/providers/your-provider.js` extending `BaseProvider`
2. Register it in `cli/providers/registry.js`
3. Add pricing to `cli/costs.js`
4. Add model tiers to `cli/tool-tiers.js`
5. Add edit mode defaults to `getEditMode()` in `cli/tool-tiers.js`
6. Write tests in `tests/providers/your-provider.test.js`

## Creating Skills

Skills extend nex-code's capabilities. Place them in `.nex/skills/`:

- **Prompt Skills** (`.md`): Inject instructions into the system prompt
- **Script Skills** (`.js`): Provide commands, tools, and handlers

See `examples/skills/` for examples.

## Code Style

- No external linter — keep consistent with existing code
- `const` over `let` where possible
- Early returns over deep nesting
- Keep functions focused and short
- Comments only where logic isn't self-evident
- All code, comments, and commits in English

## Commit Convention

```
feat: add new feature
fix: resolve bug
docs: update documentation
test: add or update tests
refactor: restructure without behavior change
chore: maintenance tasks
```

## Pull Requests

- Keep PRs focused — one feature or fix per PR
- Include tests for new functionality
- Target `devel` branch (not `main`)
- All CI checks must pass
- Update CONTRIBUTING.md if adding new architectural components

## Reporting Issues

Use [GitHub Issues](https://github.com/hybridpicker/nex-code/issues) with:

- Steps to reproduce
- Expected vs actual behavior
- Node version and OS
- Provider and model (if relevant)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
