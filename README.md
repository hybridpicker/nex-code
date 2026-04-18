# nex-code

**A CLI coding assistant for production development workflows.**

`nex-code` is an AI-powered developer tool that works in the terminal, reasons through tasks in phases, and routes work across multiple model providers. It is built for engineers who want an assistant that can operate on a real codebase, use real tools, and stay aligned with the way software is actually built and maintained.

## Demo

[Watch the demo video](./docs/assets/nex-code-demo.mp4)


## Overview

Most AI coding tools are optimized for short demos: generate a file, suggest a snippet, answer a question. Real development work is different. It involves understanding an existing repository, planning changes, editing carefully, running verification, and working with the operational tools around the code.

`nex-code` exists to close that gap. It is designed as a serious CLI-first system that can:

- work across OpenAI, Anthropic, Gemini, Ollama, and local models
- move through a structured plan -> implement -> verify loop
- use developer tooling such as Git, SSH, Docker, and Kubernetes
- adapt model choice to the kind of work being done

The result is not just "chat in the terminal." It is an agentic workflow engine for software delivery.

## Core Concept

### Agentic Workflow: Plan -> Implement -> Verify

`nex-code` treats coding tasks as execution flows rather than single prompts.

- **Plan**: understand the request, inspect the codebase, identify the relevant files and likely change strategy
- **Implement**: make the code changes with access to the right tools and repository context
- **Verify**: run tests, inspect outputs, and loop back if the change does not hold up

This matters because the failure mode of many coding assistants is not generation quality alone. It is premature action. A useful assistant must know when to inspect first, when to change code, and when to stop and verify before claiming success.

### Multi-Model Routing

Different models are good at different things. Some are better at fast repo exploration, some at careful implementation, and some at structured verification or longer-context reasoning.

`nex-code` is built around that reality. Instead of binding the entire session to one model, it can route work by phase, task type, or provider availability. In practice, this means:

- using one model for planning and another for implementation
- switching providers without changing the workflow model
- falling back across providers when a model is unavailable or unsuitable
- benchmarking configured models to improve routing decisions over time

The goal is not provider abstraction for its own sake. The goal is to make model choice operational rather than ideological.

## Key Features

- **CLI-first operation** with low overhead and a workflow that fits existing terminal habits
- **Phase-based execution** that separates planning, implementation, and verification
- **Multi-provider support** for OpenAI, Anthropic, Gemini, Ollama Cloud, and local Ollama
- **Tool-integrated execution** across files, shell commands, Git, SSH, Docker, and Kubernetes
- **Headless and interactive modes** for both conversational use and automated task runs
- **Sub-agent orchestration** for decomposing larger tasks into parallel workstreams
- **Benchmark-driven routing** to select stronger models for specific task categories
- **Repository-aware behavior** including context from the current project, config, and Git state
- **Safety controls** around confirmations, sensitive operations, and destructive commands

## Architecture

At a high level, `nex-code` is organized as an orchestration layer on top of model providers and developer tools.

1. **CLI and session layer**
   Accepts prompts, commands, flags, and session state from the terminal or editor integration.

2. **Agent loop**
   Runs the task through a controlled execution cycle: inspect, plan, act, verify, and retry when needed.

3. **Routing and provider layer**
   Resolves which provider and model should handle the next step, based on configuration, task type, and fallback logic.

4. **Tool execution layer**
   Exposes filesystem, shell, Git, browser, SSH, Docker, Kubernetes, and related capabilities to the agent.

5. **Verification layer**
   Runs tests, evaluates outcomes, and decides whether the task is complete or needs another pass.

In practice, this makes `nex-code` closer to a local orchestration system than a thin wrapper around an LLM API.

## Example Workflow

A typical developer flow with `nex-code` looks like this:

1. Start in a repository and describe the task in plain English.
2. `nex-code` inspects the project structure, relevant files, and surrounding context.
3. It forms a plan or enters a planning phase before editing.
4. It makes the implementation changes with tool access.
5. It runs tests or other verification steps.
6. If verification fails, it loops back, adjusts the implementation, and re-runs checks.
7. When the task is complete, it leaves the repository in a verifiable state rather than stopping at code generation.

Example prompts:

```text
explain why the user creation flow is failing in production
add input validation to the createUser handler and update the tests
refactor this module to async/await and verify the endpoint behavior
review the recent changes and look for regressions before I push
```

## Design Philosophy

### CLI-first

The terminal remains the most capable interface for real development work. `nex-code` is designed to operate where developers already inspect code, run tests, check diffs, and manage environments.

### Developer-centric

The product assumes a professional engineering workflow: existing repositories, mixed tooling, imperfect environments, partial context, and the need to verify outcomes. It is meant to assist a developer, not replace the surrounding engineering discipline.

### Real-world workflows

A credible coding assistant must handle more than code generation. It needs to interact with source control, infrastructure, shells, CI-like verification, and operational context. `nex-code` is built around those constraints instead of treating them as edge cases.

## Installation / Getting Started

Quick start:

```bash
npx nex-code
```

Or install globally:

```bash
npm install -g nex-code
nex-code
```

Basic requirements:

- Node.js 18+
- at least one configured provider key, or a local Ollama setup

Typical environment configuration:

```env
OLLAMA_API_KEY=your-key
OPENAI_API_KEY=your-key
ANTHROPIC_API_KEY=your-key
GEMINI_API_KEY=your-key

DEFAULT_PROVIDER=ollama
DEFAULT_MODEL=devstral-2:123b
```

On first launch, `nex-code` can guide setup interactively. More detailed installation, provider setup, and advanced runtime configuration can be expanded here as the project documentation matures.

## Future Direction

The long-term value of `nex-code` is not only broader model support. It is better orchestration.

Likely areas of continued investment include:

- stronger benchmark-based routing across task categories
- deeper editor and automation integrations
- more robust multi-agent coordination for larger changes
- tighter verification loops for tests, diffs, and deployment workflows
- better support for persistent project knowledge and reusable team workflows

The direction is clear: make AI assistance behave more like a disciplined engineering system and less like an isolated chat interface.
