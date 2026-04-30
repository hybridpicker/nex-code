# nex-code Roadmap

This roadmap reflects the features most requested by users and the reliability gaps that matter for production CLI coding workflows.
Items are ordered by expected impact. Community contributions are welcome on all of them.

---

## Priority 1 — High Impact

### Open-Model-First Reliability

Make Ollama Cloud, local Ollama, and strong open coding models feel as dependable as premium coding tools while keeping cost predictable.

- Status: **In progress**
- Focus: setup defaults, cost-aware routing, actionable missing-provider errors, verification summaries, and benchmark coverage for false success claims

### Cost Control and Transparency

Developers should always understand which provider/model is active, whether it is an affordable/open-model path or a premium paid path, and what fallback or budget behavior occurred.

- Status: **In progress**
- Focus: token/cost summaries, provider cost labels, budget warnings, fallback labels, and JSON benchmark usage telemetry

### VS Code Extension

IDE integration is the biggest UX gap vs closed-source alternatives.
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

### SSH Server Management + Docker + Deploy

First-class remote server management for AlmaLinux 9 and macOS, plus Docker and rsync-based deployments.

- Status: **Shipped** (v0.3.23) — `ssh_exec`, `ssh_upload`, `ssh_download`, `service_manage`, `service_logs`, `container_list`, `container_logs`, `container_exec`, `container_manage`, `deploy` tools. Plus `/init` wizard, `/servers`, `/docker`, `/deploy` commands. Configure via `.nex/servers.json` and `.nex/deploy.json`.

---

## Priority 3 — Nice to Have

| Feature                              | Notes                                                  |
| ------------------------------------ | ------------------------------------------------------ |
| Session/cost reports                 | CLI-first summaries of session history and token spend |
| Multi-repo agent                     | Span agent context across multiple git repos           |
| Kubernetes tools (`kubectl` wrapper) | First-class K8s workflow support                       |

---

## Recently Shipped

See [CHANGELOG](https://github.com/hybridpicker/nex-code/releases) or recent commits for what just landed.

---

## Contributing

Pick any **Planned** item above and open a PR. Check [CONTRIBUTING.md](CONTRIBUTING.md) for the dev setup.
For discussion on any roadmap item, open a GitHub Issue.
