import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { AgentProcess, AgentEvent } from "./AgentProcess";
import { ConfigManager } from "./ConfigManager";

export class NexCodePanel implements vscode.WebviewViewProvider {
  public static readonly viewType = "nex-code.chatView";

  private view?: vscode.WebviewView;
  private agent: AgentProcess;
  private config: ConfigManager;
  private context: vscode.ExtensionContext;

  constructor(
    context: vscode.ExtensionContext,
    agent: AgentProcess,
    config: ConfigManager,
  ) {
    this.context = context;
    this.agent = agent;
    this.config = config;

    agent.on("event", (event: AgentEvent) => {
      this.view?.webview.postMessage(event);
    });
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, "out"),
      ],
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((msg) => {
      switch (msg.type) {
        case "chat":
          // Validate input to prevent crash on empty input
          if (msg.text && msg.text.trim().length > 0) {
            this.agent.send(msg.text);
          }
          break;
        case "confirm":
          this.agent.confirm(msg.id, msg.answer);
          break;
        case "cancel":
          this.agent.cancel();
          break;
        case "clear":
          this.agent.clearChat();
          break;
      }
    });
  }

  private getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "out", "webview.js"),
    );
    const nonce = getNonce();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; img-src ${webview.cspSource} data:; font-src ${webview.cspSource};">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nex Code</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce() {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
