# nex-code Roadmap

This roadmap reflects the features most requested by users and gaps identified in competitive analysis.
Items are ordered by expected impact. Community contributions are welcome on all of them.

---

## Priority 1 — High Impact

### VS Code Extension
IDE integration is the biggest UX gap vs Claude Code and Gemini CLI.
A VS Code extension that embeds the nex-code REPL or exposes it as a sidebar panel would close this gap entirely.
- Status: **Planned**
- Issue: open for contributors

### Browser Agent (Playwright / Puppeteer)
Frontend workflows require browser automation — screenshot capture, DOM inspection, visual regression.
- Status: **Shipped** (v0.3.15) — `browser_open`, `browser_screenshot`, `browser_click`, `browser_fill` tools. Requires: `npm install playwright && npx playwright install chromium`. Gracefully degrades if not installed.

### PTY Support (interactive commands)
`vim`, `top`, `htop`, `less`, `ssh` and other interactive commands need a PTY to work correctly inside the agent loop.
- Status: **Shipped** (v0.3.14) — interactive commands auto-detected and spawned with `stdio:inherit`

---

## Priority 2 — Medium Impact

### Google Search / Perplexity Grounding
Web search via DuckDuckGo is already built in. Perplexity adds AI-summarized, cited results.
- Status: **Shipped** (v0.3.15) — set `PERPLEXITY_API_KEY` in `.env` to enable. Falls back to DuckDuckGo automatically.

### GitHub Actions Native Integration
Tools for interacting with GitHub Actions from within the agent.
- Status: **Shipped** (v0.3.15) — `gh_run_list`, `gh_run_view`, `gh_workflow_trigger` tools. Requires `gh` CLI authenticated.

---

## Priority 3 — Nice to Have

| Feature | Notes |
|---|---|
| Onboarding wizard on first start | Guide new users through provider setup |
| Web dashboard for sessions/costs | Browser UI showing session history, token spend |
| Docker tool (`container_logs`, `container_exec`) | First-class Docker/K8s workflow support |
| Multi-repo agent | Span agent context across multiple git repos |

---

## Recently Shipped

See [CHANGELOG](https://github.com/hybridpicker/nex-code/releases) or recent commits for what just landed.

---

## Contributing

Pick any **Planned** item above and open a PR. Check [CONTRIBUTING.md](CONTRIBUTING.md) for the dev setup.
For discussion on any roadmap item, open a GitHub Issue.
