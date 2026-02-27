# Security Policy

## Reporting Vulnerabilities

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public GitHub issue
2. Email: security@schoensgibl.com
3. Include: description, reproduction steps, and potential impact
4. Allow up to 72 hours for initial response

## Security Features

### Permission System
Every tool has a configurable permission level (`allow`, `ask`, `deny`). Destructive tools default to `ask`, requiring explicit user confirmation. Configure in `.nex/config.json`.

### Safety Patterns
Two-tier command filtering protects against dangerous operations:
- **Forbidden** (blocked, no override): `rm -rf /`, fork bombs, `curl|sh`, credential access, reverse shells, code injection — 30+ patterns
- **Dangerous** (requires confirmation): `git push`, `npm publish`, `sudo`, `wget`, `pip install -g` — 14 patterns

### Shell Injection Protection
All tool implementations that execute external commands use `execFileSync` with argument arrays (not string interpolation) to prevent shell injection from LLM-generated arguments.

### MCP Environment Isolation
MCP server subprocesses receive only a safe allowlist of environment variables (`PATH`, `HOME`, `USER`, `SHELL`, `LANG`, `TERM`, `NODE_ENV`). API keys and secrets from `process.env` are never leaked to MCP servers.

## Known Limitations

- **LLM-generated commands**: The `bash` tool executes shell commands suggested by the LLM. While safety patterns block many dangerous commands, the pattern list is not exhaustive. Always review commands before confirming execution.
- **File access**: The LLM can read and write files within the working directory. The permission system can restrict this, but defaults allow read access.
- **Network access**: `web_fetch` and `web_search` tools can make HTTP requests. These can be disabled via the permission system.

## Recommendations

- Run nex-code in a sandboxed environment (Docker, VM) for untrusted codebases
- Review `.nex/config.json` permissions before use
- Keep `bash`, `write_file`, and `edit_file` on `ask` mode (default)
- Do not store API keys in project directories — use environment variables
