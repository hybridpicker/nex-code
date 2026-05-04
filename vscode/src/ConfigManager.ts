import * as vscode from "vscode";

export interface AgentEnv {
  NEX_PROVIDER?: string;
  NEX_MODEL?: string;
  OLLAMA_BASE_URL?: string;
  OLLAMA_API_KEY?: string;
  DEEPSEEK_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;
  GEMINI_API_KEY?: string;
  NEX_MAX_TURNS?: string;
  NEX_SERVER: string;
}

export class ConfigManager {
  getExecutablePath(): string {
    return vscode.workspace
      .getConfiguration("nexCode")
      .get("executablePath", "nex-code");
  }

  getModel(): string {
    return vscode.workspace
      .getConfiguration("nexCode")
      .get("defaultModel", "devstral-2:123b");
  }

  buildEnv(): AgentEnv {
    const cfg = vscode.workspace.getConfiguration("nexCode");
    const env: AgentEnv = { NEX_SERVER: "1" };

    const provider = cfg.get<string>("defaultProvider", "ollama");
    if (provider) {
      env.NEX_PROVIDER = provider;
    }

    const model = cfg.get<string>("defaultModel", "");
    if (model) {
      env.NEX_MODEL = model;
    }

    const ollamaUrl = cfg.get<string>("ollamaBaseUrl", "");
    if (ollamaUrl) {
      env.OLLAMA_BASE_URL = ollamaUrl;
    }

    const ollamaKey = cfg.get<string>("ollamaApiKey", "");
    if (ollamaKey) {
      env.OLLAMA_API_KEY = ollamaKey;
    }

    const anthropicKey = cfg.get<string>("anthropicApiKey", "");
    if (anthropicKey) {
      env.ANTHROPIC_API_KEY = anthropicKey;
    }

    const deepseekKey = cfg.get<string>("deepseekApiKey", "");
    if (deepseekKey) {
      env.DEEPSEEK_API_KEY = deepseekKey;
    }

    const openaiKey = cfg.get<string>("openaiApiKey", "");
    if (openaiKey) {
      env.OPENAI_API_KEY = openaiKey;
    }

    const geminiKey = cfg.get<string>("geminiApiKey", "");
    if (geminiKey) {
      env.GEMINI_API_KEY = geminiKey;
    }

    const maxTurns = cfg.get<number>("maxTurns", 50);
    if (maxTurns > 0) {
      env.NEX_MAX_TURNS = String(maxTurns);
    }

    return env;
  }
}
