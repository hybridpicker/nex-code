/**
 * cli/ollama.js — Ollama API Client (Backward-compatible wrapper)
 *
 * This module now delegates to the provider system (cli/providers/).
 * Exports the same API for backward compatibility.
 */

const registry = require('./providers/registry');

const MODELS = {
  'kimi-k2.5': { id: 'kimi-k2.5', name: 'Kimi K2.5', max_tokens: 16384 },
  'qwen3-coder:480b': { id: 'qwen3-coder:480b', name: 'Qwen3 Coder 480B', max_tokens: 16384 },
};

function getActiveModel() {
  return registry.getActiveModel();
}

function setActiveModel(name) {
  return registry.setActiveModel(name);
}

function getModelNames() {
  return registry.getModelNames();
}

/**
 * Parse tool call arguments with fallback strategies.
 * This is a utility function, not provider-specific.
 */
function parseToolArgs(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    /* continue */
  }
  try {
    const fixed = raw.replace(/,\s*([}\]])/g, '$1').replace(/'/g, '"');
    return JSON.parse(fixed);
  } catch {
    /* continue */
  }
  const match = raw.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {
      /* continue */
    }
  }

  // Strategy 4: Fix unquoted keys (common in OS models)
  try {
    const fixedKeys = raw.replace(/(\{|,)\s*([a-zA-Z_]\w*)\s*:/g, '$1"$2":');
    return JSON.parse(fixedKeys);
  } catch {
    /* continue */
  }

  // Strategy 5: Strip markdown code fences (DeepSeek R1, Llama wrap JSON in ```json)
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      /* give up */
    }
  }

  return null;
}

/**
 * @deprecated Use providers/registry.callStream() instead.
 * Streaming call through the active provider.
 */
async function callOllamaStream(messages, tools) {
  const { C } = require('./ui');
  const { Spinner } = require('./ui');

  const spinner = new Spinner('Thinking...');
  spinner.start();
  let firstToken = true;
  let contentStr = '';

  try {
    const result = await registry.callStream(messages, tools, {
      onToken: (text) => {
        if (firstToken) {
          spinner.stop();
          process.stdout.write(`${C.blue}`);
          firstToken = false;
        }
        process.stdout.write(text);
        contentStr += text;
      },
    });

    if (firstToken) {
      spinner.stop();
    } else {
      process.stdout.write(`${C.reset}\n`);
    }

    return result;
  } catch (err) {
    spinner.stop();
    throw err;
  }
}

/**
 * @deprecated Use providers/registry.callChat() instead.
 * Non-streaming call through the active provider.
 */
async function callOllama(messages, tools) {
  return registry.callChat(messages, tools);
}

module.exports = {
  MODELS,
  getActiveModel,
  setActiveModel,
  getModelNames,
  callOllamaStream,
  callOllama,
  parseToolArgs,
};
