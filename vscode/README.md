# Nex Code — VS Code Extension

Agentic AI coding assistant powered by [nex-code](https://github.com/hybridpicker/nex-code).

## Features

- Sidebar chat panel with full agentic loop
- Tool use: file read/write, shell commands, web search, browser control
- Multi-provider support: Ollama, DeepSeek, Anthropic, OpenAI, Gemini
- Session branching, context compression, visual dev tools

## Requirements

Install the `nex-code` CLI first:

```bash
npm install -g nex-code
```

## Configuration

| Setting | Default | Description |
|---|---|---|
| `nexCode.executablePath` | `nex-code` | Path to nex-code binary |
| `nexCode.defaultProvider` | `ollama` | LLM provider |
| `nexCode.defaultModel` | `devstral-2:123b` | Model name |
| `nexCode.ollamaBaseUrl` | _(empty)_ | Ollama base URL |

## Usage

1. Click the Nex Code icon in the activity bar
2. Type your request in the chat panel
3. The agent will read/write files, run commands, and iterate until done
