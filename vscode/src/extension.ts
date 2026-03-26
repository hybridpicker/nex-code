import * as vscode from "vscode";
import { NexCodePanel } from "./NexCodePanel";
import { AgentProcess } from "./AgentProcess";
import { ConfigManager } from "./ConfigManager";

let agent: AgentProcess | null = null;

export function activate(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel("Nex Code");
  const config = new ConfigManager();
  agent = new AgentProcess(outputChannel);

  // Spawn agent for the current workspace
  const cwd =
    vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();
  spawnAgent(agent, config, cwd);

  const provider = new NexCodePanel(context, agent, config);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(NexCodePanel.viewType, provider),
  );

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand("nex-code.clearChat", () => {
      agent?.clearChat();
    }),
    vscode.commands.registerCommand("nex-code.restart", () => {
      spawnAgent(agent!, config, cwd);
    }),
    vscode.commands.registerCommand("nex-code.switchModel", async () => {
      const models = [
        "devstral-2:123b",
        "devstral-small-2:24b",
        "kimi-k2.5",
        "kimi-k2:1t",
        "qwen3-coder:480b",
        "minimax-m2.7:cloud",
        "claude-sonnet-4-6",
        "gpt-4o",
      ];
      const picked = await vscode.window.showQuickPick(models, {
        placeHolder: "Select model",
      });
      if (picked) {
        await vscode.workspace
          .getConfiguration("nexCode")
          .update("defaultModel", picked, vscode.ConfigurationTarget.Workspace);
        spawnAgent(agent!, config, cwd);
        vscode.window.showInformationMessage(`Nex Code: switched to ${picked}`);
      }
    }),
  );

  context.subscriptions.push({
    dispose: () => agent?.kill(),
  });
}

function spawnAgent(agent: AgentProcess, config: ConfigManager, cwd: string) {
  const executable = config.getExecutablePath();
  const model = config.getModel();
  const env = config.buildEnv() as Record<string, string>;
  agent.spawn(executable, model, cwd, env);
}

export function deactivate() {
  agent?.kill();
}
